// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// agent-runtime 会话持久化存储(P0 修复,2026-09-07 立)。
// 背景:agent-runtime 路由此前只用内存 SessionManager,进程重启即丢上下文。
// clawdbot_sessions.bot_id 是 uuid 外键,无法容纳 agent-runtime 的字符串 botId('default' 等),
// 故独立建表 agent_runtime_sessions(varchar 主键),本文件为该表的读写层。
// 写入策略:write-through(fire-and-forget,失败降级内存并告警,不打断对话流);
// 读取策略:内存 miss 后从 DB 惰性恢复。

import { eq, desc, sql, type SQL, and } from 'drizzle-orm'
import { agentRuntimeSessions, type Database } from '@ihui/database'
import { coerceKnownOr } from '@ihui/types'
import type { Session, SessionStatus } from '../clawdbot/session-manager.js'

type DbHandle = Database

let dbDisabled = false
let dbCache: DbHandle | null = null

export function resetSessionStoreDbState(): void {
  dbDisabled = false
  dbCache = null
}

async function getDb(): Promise<DbHandle | null> {
  if (dbDisabled) return null
  if (dbCache) return dbCache
  try {
    const mod = await import('../../db/index.js')
    dbCache = mod.db
    return mod.db
  } catch {
    dbDisabled = true
    return null
  }
}

function toSession(row: typeof agentRuntimeSessions.$inferSelect): Session {
  const metadata = row.metadata ?? {}
  const messages = Array.isArray(row.messages) ? row.messages : []
  return {
    id: row.id,
    botId: row.botId,
    userId: row.userId,
    // G-815963:与 session-manager.toSession 同型收敛 —— 未知/未来值兜到终态 'closed',
    // 全集内联(守门 R4b 可判形状),禁 as 直转。
    status: coerceKnownOr(row.status, ['active', 'paused', 'closed'], 'closed'),
    context: {
      botId: row.botId,
      userId: row.userId,
      messages,
      metadata,
    },
    createdAt: row.createdAt.getTime(),
    lastActiveAt: row.updatedAt.getTime(),
  }
}

// G-815954:metadata 走具名成员合并 —— 本次写入点名的成员即 metadata 的自有键。
// undefined 成员归一为 null(JSON.stringify 会静默丢弃 undefined 键,不归一则"清空"意图无声丢失);
// 显式 null 与归一后的 null 都落成行内墓碑,防止重启后被旧值复活。
function namedMembersJson(metadata: Record<string, unknown>): string {
  const members: Record<string, unknown> = {}
  for (const key of Object.keys(metadata)) {
    members[key] = metadata[key] === undefined ? null : metadata[key]
  }
  return JSON.stringify(members)
}

// 写透单条会话。jsonb 列逐列声明写策略(G-815954,禁无声明整列覆盖):
// messages = 全量真相(内存 SessionManager 是转写唯一权威,显式清空即空数组整列落盘);
// metadata = 具名成员合并(不整列覆盖,否则吃掉行内"显式清空"墓碑与旧版回滚快照字段)。
export async function persistSession(session: Session): Promise<void> {
  const db = await getDb()
  if (!db) return
  try {
    await db
      .insert(agentRuntimeSessions)
      .values({
        id: session.id,
        botId: session.botId,
        userId: session.userId,
        status: session.status,
        messages: session.context.messages,
        metadata: session.context.metadata,
        createdAt: new Date(session.createdAt),
        updatedAt: new Date(session.lastActiveAt),
      })
      .onConflictDoUpdate({
        target: agentRuntimeSessions.id,
        set: {
          status: session.status,
          // messages:全量真相 —— 内存态即完整转写,整列落盘。
          messages: session.context.messages,
          // metadata:具名成员合并(`||` 右侧只含本次点名的成员):
          // 行内未被点名的旧成员是旧版回滚快照,不因本次写入未携带而被吃掉;
          // 点名为 null 的成员落成行内墓碑(下次导入不得复活旧值)。
          metadata: sql`${agentRuntimeSessions.metadata} || ${namedMembersJson(session.context.metadata)}::jsonb`,
          updatedAt: new Date(session.lastActiveAt),
        },
      })
  } catch (err) {
    dbDisabled = true
    console.warn('[agent-runtime-session-store] persist failed, fallback to memory:', err)
  }
}

// 内存 miss 时从 DB 恢复;不存在返回 null
export async function loadSessionFromDb(id: string): Promise<Session | null> {
  const db = await getDb()
  if (!db) return null
  try {
    const rows = await db
      .select()
      .from(agentRuntimeSessions)
      .where(eq(agentRuntimeSessions.id, id))
      .limit(1)
    if (rows.length === 0) return null
    return toSession(rows[0]!)
  } catch (err) {
    dbDisabled = true
    console.warn('[agent-runtime-session-store] load failed, fallback to memory:', err)
    return null
  }
}

// ── G-815983:「是否还有下一条」的唯一出口 ─────────────────────────────────
// 论证只写这一遍(此前同一论证在 apps/api/src/db/chat-queries.ts、routes/message.ts、
// routes/task-messages.ts、utils/cursor-page.ts 各手写一份,站点清单与逐条定性见本票交付报告):
//   1. 别在这一层加自己的天花板 —— 无名的 clamp 让「取满了」与「到底了」在响应上完全同形,
//      于是账面能在恰好取满 limit 处报出「没有更多了」(其实还有),分页永不收敛。
//   2. 正解是多取 PAGE_PROBE_ROWS 条**探测行**,由 resolveTruncation 判完再剥掉;
//      任何中间层都不得在判定之前把探测行裁掉 —— 裁掉 ⇒ 判据在 limit 边界处恒假。
//   3. 取不到探测行的既有形态只能保守判:恰满即 truncated = true
//      (失效方向是「多一跳空页」,不是「断链」)。
// 两条规则同住这一个函数,所以「按哪条规则判」是调用方显式声明的,不是各处自行猜。

/** 探测行条数:判「是否还有下一条」的唯一取数形状(`limit + PAGE_PROBE_ROWS`)。 */
export const PAGE_PROBE_ROWS = 1

/** 本层默认取数上限:具名,禁无名 clamp(无名 clamp 正是上面第 1 条的成因)。 */
export const DEFAULT_SESSION_LIST_LIMIT = 200

export type TruncationRule =
  /** 调用方按 `limit + PAGE_PROBE_ROWS` 取数:恰满 = 真的到底(精确,不多给空页) */
  | 'probed'
  /** 调用方只取到 limit:恰满 = 可能还有下一条(保守,不断链) */
  | 'page-full'

export interface PageTruncation<T> {
  readonly items: T[]
  readonly truncated: boolean
  /** 计数兄弟键:`truncated` 不得裸奔(守门 check-truncation-accounting 的 DTO 面判据) */
  readonly appliedLimit: number
  readonly fetchedCount: number
}

/**
 * 判定一页数据是否被截断 —— 全仓这一论证的唯一出口。
 * `limit` 必须是非负整数(由调用方的具名上限出口 sanitize)。
 */
export function resolveTruncation<T>(
  rows: readonly T[],
  limit: number,
  rule: TruncationRule,
): PageTruncation<T> {
  return {
    items: rows.slice(0, limit),
    truncated: rule === 'probed' ? rows.length > limit : rows.length === limit,
    appliedLimit: limit,
    fetchedCount: rows.length,
  }
}

/** 取数上限的 sanitize:未给 → 具名默认;非有限值/负数 → 具名默认;其余取整。 */
function appliedSessionListLimit(limit?: number): number {
  if (limit === undefined || !Number.isFinite(limit) || limit < 0) return DEFAULT_SESSION_LIST_LIMIT
  return Math.floor(limit)
}

export interface SessionPage {
  readonly sessions: Session[]
  readonly truncated: boolean
  readonly appliedLimit: number
  /** null = 库不可用或读失败,这一维判不了;不得把「没判」写成「没有更多」 */
  readonly fetchedCount: number | null
}

/** 列出持久化会话并如实交代截断(恰满也交代,不留盲区)。 */
export async function listPersistedSessionPage(filter?: {
  status?: SessionStatus
  limit?: number
}): Promise<SessionPage> {
  const appliedLimit = appliedSessionListLimit(filter?.limit)
  const db = await getDb()
  if (!db) return { sessions: [], truncated: false, appliedLimit, fetchedCount: null }
  try {
    const conds: SQL[] = []
    if (filter?.status) conds.push(eq(agentRuntimeSessions.status, filter.status))
    const query = db.select().from(agentRuntimeSessions)
    const rows = await (conds.length > 0 ? query.where(and(...conds)) : query)
      .orderBy(desc(agentRuntimeSessions.updatedAt))
      .limit(appliedLimit + PAGE_PROBE_ROWS)
    const verdict = resolveTruncation(rows, appliedLimit, 'probed')
    return {
      sessions: verdict.items.map(toSession),
      truncated: verdict.truncated,
      appliedLimit: verdict.appliedLimit,
      fetchedCount: verdict.fetchedCount,
    }
  } catch (err) {
    dbDisabled = true
    console.warn('[agent-runtime-session-store] list failed, fallback to memory:', err)
    return { sessions: [], truncated: false, appliedLimit, fetchedCount: null }
  }
}

// 列出持久化的会话(重启后 GET /sessions 不再返回空列表)。
// 本函数是 listPersistedSessionPage 的投影,只取 sessions —— 需要知道
// 「是否还有下一条」的调用方必须走 page 出口,不得在这里再算一遍截断。
export async function listPersistedSessions(filter?: {
  status?: SessionStatus
  limit?: number
}): Promise<Session[]> {
  return (await listPersistedSessionPage(filter)).sessions
}

export async function deletePersistedSession(id: string): Promise<void> {
  const db = await getDb()
  if (!db) return
  try {
    await db.delete(agentRuntimeSessions).where(eq(agentRuntimeSessions.id, id))
  } catch (err) {
    dbDisabled = true
    console.warn('[agent-runtime-session-store] delete failed:', err)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
