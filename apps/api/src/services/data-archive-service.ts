// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 历史数据归档服务（backing service for data-archive-daily 定时任务）。
 * 迁移自旧架构 app/tasks/data_archive_task.py。
 *
 * 每日 04:30 将超过保留期的历史数据从热表迁移到归档表，
 * 减小热表体积，保持查询性能。
 *
 * 归档策略（阈值一律 `created_at < now - N天`，即恰好满 N 天的记录**仍保留**）：
 * 1. audit_logs: 保留 90 天，超期记录删除（已有审计快照在 ELK/OTel）
 * 2. messages（IM）: 保留 180 天，超期记录删除
 * 3. relay_messages（LLM 会话历史）: 保留 180 天，超期记录删除
 * 4. notifications: 保留 30 天，超期**已读**消息删除
 * 5. chat_messages（AI 对话正文 + reasoning）: 保留 365 天，超期记录删除
 * 6. conversation_message_archives（压缩前完整消息数组 jsonb）: 保留 365 天，超期记录删除
 *
 * 关于第 5/6 条 —— 这条注释本身就是一次教训的产物，记录下来别再犯：
 * 本文件的头注释从很早就写着"chat_messages: 保留 180 天，超期记录删除"，
 * 但**代码里从来没有 chat_messages 的删除分支**。一个从未兑现的承诺比没有承诺更糟：
 * 下一个读代码的人（人或 agent）看到注释就会把 chat_messages 记成"已治理"，
 * 于是全仓留存面里最大的两处敞口被长期标记为绿色。
 * 2026-10-03 实装第 5/6 条时发现，同名的第 2 条实际删的是 IM `messages` 表而非
 * `chat_messages`（见该分支内的订正说明）—— 也就是说注释里的"chat_messages"从未指向过
 * 任何真实删除逻辑。教训：**注释里出现的表名，必须能对上下面某一段 try 里的 delete 调用**。
 */

import { and, lt, lte, eq, inArray, isNotNull, sql } from 'drizzle-orm'
import type { AnyPgTable, AnyPgColumn } from 'drizzle-orm/pg-core'
import { db } from '../db/index.js'
import {
  auditLogs,
  messages,
  notifications,
  relayMessages,
  chatMessages,
  conversationMessageArchives,
  // 2026-10-03 数据出域合规整改:agent/team 记忆 6 张表(此前无任何清理路径)
  agentMultimodalMemory,
  // agentUserProfile 不在此导入:它的主键是 user_id 而非 id,走
  // purgeUserProfileExpired 里的 ctid 批量删除(见该函数注释)。
  agentSessionSummary,
  agentMetaLessons,
  teamMemories,
  agentFederatedLessons,
} from '@ihui/database'
import { logger } from '../utils/logger.js'

export interface ArchiveResult {
  auditLogsArchived: number
  messagesArchived: number
  notificationsArchived: number
  /**
   * relay_messages 归档行数(2026-10-03 数据出域合规整改新增)。
   *
   * 为什么它归到 180 天这一档而不是 llm_call_logs 的 30 天:
   * relay_messages 是**用户可见的会话历史**(web 端会话列表读的就是它),
   * 与 llm_call_logs 里"只为排障存在的原文副本"性质不同 —— 后者按 30 天清原文
   * 不影响任何用户可见功能,前者按 30 天删等于砸掉聊天记录。
   * 所以它与 IM messages 同档(180 天),而不是被塞进原文档那一档。
   */
  relayMessagesArchived: number
  /**
   * chat_messages 归档行数(2026-10-03 数据出域合规整改新增)。
   *
   * 365 天而非 180/90:它存的是**用户主动开启的 AI 长对话正文**(`content` NOT NULL
   * 外加 `reasoning` 思维链),属于用户对自己历史会话资产的连续性预期,不是日志。
   * 砍到 90 天等于替用户决定"你的会话记忆只值得留三个月"。
   */
  chatMessagesArchived: number
  /**
   * conversation_message_archives 归档行数(2026-10-03 新增)。
   *
   * 与 chat_messages 同 365 天档,且是**必须**一起清的一张:它的 `messages` jsonb
   * 存的是压缩前的**完整**消息数组(可回看),而压缩的目的正是把长会话搬出热表 ——
   * 热表里的原文被清掉、压缩档里的原文却留着,等于清理只做了一半,留存面反而更宽。
   */
  conversationMessageArchivesArchived: number
  /**
   * agent/team 记忆 6 张表到期回收行数(2026-10-03 数据出域合规整改新增)。
   *
   * 6 张表合计计在一处而非拆成 6 个字段:它们是同一票整改的产物,而监控要看的
   * 恰恰是"这票一共清了多少行"——拆开只会让调度日志更难读。
   */
  agentMemoriesPurged: number
  errors: string[]
}

/**
 * agent/team 记忆表的**过期判据**(2026-10-03 数据出域合规整改)。
 *
 * 抽成导出纯函数而不是把条件内联进 SQL,是为了能**直接测**它 —— 早先版本把
 * 判据写死在 drizzle 查询链里,测它就得 mock 整条 db 链,而 mock 链的保真度
 * 是个无底洞(表名认不出、循环轮次算错,都能造出"测试绿但线上删 0 行"的假象)。
 * 判据本身只有一行,值得一个能独立钉死的函数。
 *
 * 语义(**NULL 是"用户显式选择长期保留",不是"还没算过期"**):
 *   · expires_at 为 NULL      ⇒ 永不到期,不删
 *   · expires_at <= now       ⇒ 到期,可删
 * 用 `<=` 而非 `<`:到期那一刻即失效。留这条注释是防止将来有人改成 `<` 之后
 * "永远差一秒清不掉",而那种错在低频任务里几个月都看不出来。
 */
export function isAgentMemoryRowExpired(
  expiresAt: Date | string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (expiresAt === null || expiresAt === undefined) return false
  const t = expiresAt instanceof Date ? expiresAt.getTime() : new Date(expiresAt).getTime()
  if (Number.isNaN(t)) return false // 解析不了 ⇒ 当作"未到期",不误删用户数据
  return t <= now.getTime()
}

/**
 * 走"按 id 批删"那条路的 5 张 agent/team 记忆表(2026-10-03)。
 *
 * 导出是为了让测试能钉死"清单就是这 5 张 + user_profile 那 1 张,一张不落、
 * 一张不多" —— 这类"清单漏了一张"的错只有测试能发现,而漏掉的那张表会静默
 * 永不过期(正是本票要消除的东西)。
 *
 * 档位 90/180/365 三档按内容敏感度分(非一刀切),理由在迁移
 * 20261003180000 的列注释里。label 带档位,是为了让调度日志一眼能看出清的是哪档。
 * agent_user_profile 不在此列(主键是 user_id 而非 id,走 purgeUserProfileExpired)。
 */
export const AGENT_MEMORY_TABLES: ReadonlyArray<{
  table: AnyPgTable & { id: AnyPgColumn }
  label: string
  retentionDays: number
}> = [
  { table: agentMultimodalMemory, label: 'agent_multimodal_memory(90d)', retentionDays: 90 },
  { table: agentSessionSummary, label: 'agent_session_summary(180d)', retentionDays: 180 },
  { table: agentMetaLessons, label: 'agent_meta_lessons(180d)', retentionDays: 180 },
  { table: teamMemories, label: 'team_memories(365d)', retentionDays: 365 },
  { table: agentFederatedLessons, label: 'agent_federated_lessons(365d)', retentionDays: 365 },
]

/** 走 ctid 批删的那张(主键非 id),与其余 5 张分开处理。 */
export const AGENT_MEMORY_PROFILE_LABEL = 'agent_user_profile(180d)'

/**
 * 分批删除的单批上限。
 *
 * 取值与 `apps/api/src/jobs/pii-retention-cleanup.ts` 的 `BATCH_LIMIT` 同档(1000):
 * 一次 DELETE 删几十万行会长时间持锁并把 WAL 撑爆,批次之间让出锁给autovacuum/查询。
 */
const PURGE_BATCH_LIMIT = 1000

/**
 * 从单表按时间戳字段**分批**删除过期记录,返回删除总行数。
 *
 * 为什么这两张表走分批、而上面四段仍是单条 DELETE:
 * - `PgDeleteBase` 只有 `where` / `returning`,**没有 `.limit()`**(drizzle-orm 0.45.2 实测),
 *   所以"DELETE ... LIMIT n"这条最直白的路在类型层就不存在,只能先查主键再按主键删;
 * - `chat_messages` 是全仓写入量最大的表(每轮 AI 对话每条消息一行,还带 reasoning 全文),
 *   首次开闸时超期存量是"上线至今的全部对话",单条 DELETE 的持锁时长不可接受;
 * - 形状与 `pii-retention-cleanup.ts` 的 `purgeExpired` 一致,不发明第二套批处理写法。
 *
 * 循环终止性:每批先按 `lt` 取主键,删完这批后再取 —— 匹配集严格收缩,
 * 且不依赖事务,单批失败由外层 try/catch 记入 errors[]。
 */
async function purgeExpiredBatched(
  table: AnyPgTable & { id: AnyPgColumn },
  timestampCol: AnyPgColumn,
  threshold: Date,
): Promise<number> {
  let deleted = 0
  for (;;) {
    const rows = (await db
      .select({ id: table.id })
      .from(table)
      .where(lt(timestampCol, threshold))
      .limit(PURGE_BATCH_LIMIT)) as Array<{ id: string }>
    if (rows.length === 0) break
    await db.delete(table).where(
      inArray(
        table.id,
        rows.map((r) => r.id),
      ),
    )
    deleted += rows.length
    // 末批不足上限 ⇒ 已是全部匹配行,不必再多查一次空批
    if (rows.length < PURGE_BATCH_LIMIT) break
  }
  return deleted
}

/**
 * agent_user_profile 的到期回收(2026-10-03)。
 *
 * 为什么单独一个函数:本表主键是 **user_id**(不是 id),而
 * purgeExpiredAtColumn 走的是「先按条件取 id 批、再按 id 删」——
 * 那条路要求表有 id 列。硬套会得到一个永远删 0 行的假绿(最坏的一类:
 * 监控显示"已清理"、实际一条没清)。
 *
 * 改用 ctid(物理行号):DELETE ... WHERE ctid IN (SELECT ctid ... LIMIT n)。
 * ctid 只能在单个 SQL 语句内使用,不能跨查询持有 —— 这里恰好是单条语句,
 * 语义安全。批大小同样受 PURGE_BATCH_LIMIT 约束,循环直到不满批。
 */
async function purgeUserProfileExpired(): Promise<number> {
  const rows = (await db.execute(sql`
    DELETE FROM "agent_user_profile"
    WHERE ctid IN (
      SELECT ctid FROM "agent_user_profile"
      WHERE "expires_at" IS NOT NULL AND "expires_at" <= NOW()
      LIMIT ${PURGE_BATCH_LIMIT}
    )
    RETURNING "user_id"
  `)) as unknown as Array<{ user_id: string }>
  const deleted = Array.isArray(rows) ? rows.length : 0
  // 满批 ⇒ 可能还有,继续下一轮(不设上限:延迟一天无害,留着到期行才是敞口)
  if (deleted >= PURGE_BATCH_LIMIT) return deleted + (await purgeUserProfileExpired())
  return deleted
}

/**
 * 按表自身的 `expires_at` 列回收到期行(2026-10-03 数据出域合规整改新增)。
 *
 * 与 `purgeExpiredBatched(table, tsCol, threshold)` 的区别:那个按"传入的阈值列
 * + 外部算好的时间"删(用于 created_at 类流水),而这个**用行内自己写的过期时刻**。
 * 两者不是一回事:
 *   · 流水表(chat_messages / relay_messages):过期 = created_at + 固定档期,
 *     阈值由清理器算,行为对所有行一致;
 *   · 记忆表(agent_* / team_*):过期时刻**写在行上**(可能是用户显式选的"永不过期"
 *     ⇒ NULL),不同行不同档。外部算阈值会把这个语义抹平 —— 尤其会把
 *     expires_at IS NULL 的行(用户明确要长期保留)一起清掉,那是直接违背用户意愿。
 *
 * 所以这里必须用 `isNotNull(expiresAt) AND expiresAt <= NOW()` 的行内判据。
 * 循环终止性与批大小语义同 purgeExpiredBatched(匹配集严格收缩 + 末批不满即收工)。
 */
async function purgeExpiredAtColumn(table: AnyPgTable & { id: AnyPgColumn }): Promise<number> {
  const expiresCol = (table as unknown as { expiresAt?: AnyPgColumn }).expiresAt
  if (!expiresCol) {
    // 表没有 expires_at 列 ⇒ 交给调用方的 errors[] 记,不在这里静默返回 0
    // (静默 0 会让"忘了加列"看起来像"没有到期行",是最难查的一类假绿)。
    throw new Error('该表未定义 expiresAt 列,无法按到期回收')
  }
  let deleted = 0
  for (;;) {
    const rows = (await db
      .select({ id: table.id })
      .from(table)
      .where(and(isNotNull(expiresCol), lte(expiresCol, new Date())))
      .limit(PURGE_BATCH_LIMIT)) as Array<{ id: string }>
    if (rows.length === 0) break
    await db.delete(table).where(inArray(table.id, rows.map((r) => r.id)))
    deleted += rows.length
    if (rows.length < PURGE_BATCH_LIMIT) break
  }
  return deleted
}

/**
 * 执行每日数据归档。
 * 使用 DELETE ... WHERE created_at < threshold 语义清理过期热数据。
 * 归档前数据已被 OTel/ELK/Grafana 消费，无需单独归档表。
 */
export async function archiveDailyData(): Promise<ArchiveResult> {
  const errors: string[] = []
  const now = new Date()

  // 阈值计算
  const auditThreshold = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) // 90 天前
  const messageThreshold = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000) // 180 天前
  const notifThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) // 30 天前
  // 365 天(机主定档):AI 对话正文与其压缩档。恰满 365 天的记录**不删**(`lt` 严格小于),
  // 即保留期是"至少 365 天",与上面四段同一语义;这样边界值(恰好整 365 天)落在保留侧,
  // 宁可多留一条也不误删用户仍可能回看的会话。留存量由次日同一阈值继续收,不存在漏网。
  const chatThreshold = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000) // 365 天前

  let auditLogsArchived = 0
  let messagesArchived = 0
  let notificationsArchived = 0
  let relayMessagesArchived = 0
  let chatMessagesArchived = 0
  let conversationMessageArchivesArchived = 0
  let agentMemoriesPurged = 0

  try {
    // 归档 audit_logs（90 天前）
    const auditResult = await db
      .delete(auditLogs)
      .where(lt(auditLogs.createdAt, auditThreshold))
      .returning({ id: auditLogs.id })
    auditLogsArchived = auditResult.length
  } catch (err) {
    errors.push(`audit_logs archive failed: ${err instanceof Error ? err.message : String(err)}`)
  }

  try {
    // 归档 IM 消息（180 天前）。
    //
    // 注释订正(2026-10-03):原文写的是"归档 chat messages",但这里删的是
    // `messages`(IM 表),**不是** chat_messages(AI 对话表)。这个错名有实际
    // 代价:读代码的人会以为"AI 对话记录已有 180 天清理",而它其实一张都没清 ——
    // 于是 chat_messages 成了全仓留存面里最容易被误判为"已治理"的那张表。
    const msgResult = await db
      .delete(messages)
      .where(lt(messages.createdAt, messageThreshold))
      .returning({ id: messages.id })
    messagesArchived = msgResult.length
  } catch (err) {
    errors.push(`messages archive failed: ${err instanceof Error ? err.message : String(err)}`)
  }

  try {
    // relay_messages:用户可见的 LLM 会话历史(180 天前,同 IM messages 档)。
    //
    // 2026-10-03 新增。此前这张表**没有任何清理路径** —— 而它存的是完整对话
    // 正文(`content` NOT NULL),且 logId 外键是 onDelete:'set null',意味着
    // llm_call_logs 那边把原文purge 掉之后,**同一份原文在这里依然完整存在**,
    // 30 天原文档治理等于被这个外键绕开。堵上这个口是本次整改的一部分。
    const relayResult = await db
      .delete(relayMessages)
      .where(lt(relayMessages.createdAt, messageThreshold))
      .returning({ id: relayMessages.id })
    relayMessagesArchived = relayResult.length
  } catch (err) {
    errors.push(
      `relay_messages archive failed: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  try {
    // 归档已读通知（30 天前，仅删除已读的）
    const notifResult = await db
      .delete(notifications)
      .where(and(lt(notifications.createdAt, notifThreshold), eq(notifications.isRead, true)))
      .returning({ id: notifications.id })
    notificationsArchived = notifResult.length
  } catch (err) {
    errors.push(`notifications archive failed: ${err instanceof Error ? err.message : String(err)}`)
  }

  try {
    // chat_messages:AI 对话正文(365 天前)。
    //
    // 2026-10-03 新增,本段是本文件头注释"第 2 条 chat_messages: 保留 180 天"兑现的地方
    // —— 在此之前该承诺从未实现,详见文件头注释里的教训记录。
    // 分批删除:这张表是全仓写入量最大的留存面(每轮 AI 对话每条消息一行 + reasoning 全文),
    // 首次开闸的待删量是"上线至今全部对话",单条大 DELETE 会长时间持锁。
    chatMessagesArchived = await purgeExpiredBatched(
      chatMessages,
      chatMessages.createdAt,
      chatThreshold,
    )
  } catch (err) {
    errors.push(
      `chat_messages archive failed: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  try {
    // conversation_message_archives:压缩前的完整消息数组(365 天前,同 chat_messages 档)。
    //
    // 2026-10-03 新增,此前同样**无任何清理路径**。与 chat_messages 成对处理的原因:
    // 压缩档(`messages` jsonb,可回看压缩前原文)是热表原文的**副本**,只清热表不清它
    // 等于把同一份对话正文又完整存了一份在"归档"表里,留存面不降反升。
    conversationMessageArchivesArchived = await purgeExpiredBatched(
      conversationMessageArchives,
      conversationMessageArchives.createdAt,
      chatThreshold,
    )
  } catch (err) {
    errors.push(
      `conversation_message_archives archive failed: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  // 2026-10-03 数据出域合规整改:agent/team 记忆 6 张表的到期回收。
  // 此前这 6 张表**完全没有**清理路径(不是"有机制没开",是机制根本不存在),
  // 而它们存的是用户画像 / 经验教训 / 会话摘要 / 多模态 caption。
  // 档位 90/180/365 三档按内容敏感度分(非一刀切),理由写在迁移
  // 20261003180000 的列注释里。
  //
  // 判据:expires_at IS NOT NULL AND expires_at <= NOW()
  //   NULL = 用户显式选择长期保留 ⇒ 永不被清(与 codebase_chunks / relay_messages
  //   同一语义:NULL 表示"显式永不过期",不是"还没算过期时间")。
  //
  // 单表失败只记 error、不中断其余表:与本文件既有的"逐表 try"结构一致 ——
  // 记忆表清不掉,不该导致审计日志也清不掉。
  // 注意 agent_user_profile 的主键是 **user_id**(不是 id)⇒ 不能走
  // purgeExpiredAtColumn 那条"按 id 批删"的路,单独用 ctid 子查询删(见下)。
  for (const { table, label } of AGENT_MEMORY_TABLES) {
    try {
      const purged = await purgeExpiredAtColumn(table)
      agentMemoriesPurged += purged
      if (purged > 0) {
        // 本仓 logger 是 (msg, meta) 顺序 —— 反了会静默把对象当消息体丢掉 meta
        logger.info('agent/team 记忆到期回收', { table: label, purged })
      }
    } catch (err) {
      errors.push(`${label} purge failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  // agent_user_profile:主键是 user_id,按 ctid 删(见 purgeUserProfileExpired 注释)
  try {
    const purged = await purgeUserProfileExpired()
    agentMemoriesPurged += purged
    if (purged > 0) {
      logger.info('agent/team 记忆到期回收', { table: 'agent_user_profile(180d)', purged })
    }
  } catch (err) {
    errors.push(
      `agent_user_profile(180d) purge failed: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  return {
    auditLogsArchived,
    messagesArchived,
    notificationsArchived,
    relayMessagesArchived,
    chatMessagesArchived,
    conversationMessageArchivesArchived,
    agentMemoriesPurged,
    errors,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
