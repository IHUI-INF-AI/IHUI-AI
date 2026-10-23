// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  bigint,
  boolean,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { users } from './users.js'

/**
 * 86「证据级可追溯执行流水」明细账表(票面 2026-09-27 拍板「做,落库并可导出」)。
 *
 * 与既有审计面的分工(复用 vs 新表,§0.6):
 *  - `audit_logs_chain`(86A2/86H)已承载"链式可验证"本身 —— 本表**不新建第二条链**:
 *    每行经 `chainEntryId` 指向一条既有链行(由 recordAuditLog 唯一写入器落,
 *    prev_hash/current_hash HMAC 链 + pg_advisory_xact_lock)。可验证性引用同一机制,
 *    本表只是它的**查询投影/明细账**。
 *  - 为什么必须新表:86A2 把 invocation 事实压进链行的 metadata JSONB,四要素
 *    (invocation id / 输入输出摘要 / 权限决策 / 操作者身份)只是 JSON 键 —— 与
 *    G-790 A5/A7 判过的"判别键住 JSON、正确性靠写入者巧合"同型。运营事实进列:
 *    值域由 DB CHECK 封闭、等值查询走索引、聚合不解析 JSON。
 *  - `metadata` 列在此不是被抛弃,而是继续装"无判定含义的对账字段"。
 *
 * 哈希列存摘要不存原文:
 *  - `inputDigest` 唯一出口 = `@ihui/shared` `digestToolArgsStructure`(86B 建设的
 *    入参摘要唯一实现,`args-sha256-v1-<64hex>`,长度 79;换键序同值、改取值换值);
 *    写侧禁止自算第二份(audit-log-service 86A2 段注已点名"两处算同一件事必漂移")。
 *  - `outputDigest` = 结果文本 SHA-256 hex(64)。未收尾(in-flight/lost)为 NULL。
 *
 * 操作者身份(AGENTS §5「鉴权面」纪律):`userId` 是归属型记录的操作者主体,
 * 只允许承载层(recordToolInvocationLedger 的 principal 入参,来自令牌主体)写入;
 * 摄入 payload 侧的 strict schema 结构上拒收任何自报 userId/user_id。
 * 引用 users 用 set null(与 audit-chain 同形):用户删除保审计事实,不留悬空主体。
 *
 * 权限决策词汇**不新造**:`permissionDecision` 值域 = TOOL_APPROVAL_ROUTES
 * (flag/approved/denied,apps/api/src/services/tool-approval-audit.ts 与 CLI
 * danger-gate 同集);`permissionCause` 值域 = TOOL_APPROVAL_DENY_CAUSES 同集。
 * DB 侧 CHECK 是那份词汇的镜像登记(schema 包不能 import 应用层,同 audit-chain
 * 头注先例),两侧对齐由 service 测试逐值钉。
 *
 * 调用预算档位**不新造**(check-tool-exec-budget.mjs / scripts/lib/tool-exec-budget.mjs
 * 是预算判据唯一解析面):本表只投影既有 execBudget 声明的数据形态
 * (`{ms}` 档或 `{notInterruptible, reason}` 档),不定义新档、不复算封顶。
 *
 * 原文留存(沿用 llm_call_logs O5 同型三列,不自造词汇):
 *  - `rawRetentionDays` NULL = 全局默认(环境变量 TOOL_LEDGER_RAW_RETENTION_DAYS,
 *    默认 30 天 —— 代裁依据见迁移头注;0 = 不留存原文);
 *  - `rawRetained` false = 本行从未带原文(默认摄入不带,includeRaw 显式开);
 *  - `rawPurgedAt` 原文按策略被清除的时刻。
 * 原文清除器不在本票范围(写入口 service 刻意默认不落原文;清除批次与
 * purgeExpiredLlmCallLogRawText 同族,归下一格)。
 */
export const toolInvocationLedger = pgTable(
  'tool_invocation_ledger',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** 调用编号(= CLI 账本 callId,`fingerprint#occurrence` 形态,长度上限与其 max(160) 同档)。全表唯一,重复摄入走 onConflictDoNothing 幂等。 */
    invocationId: varchar('invocation_id', { length: 160 }).notNull(),
    /** 操作者身份:令牌主体,由承载层显式入参写入(见头注 §5 纪律);非 UUID 在入口即拒。 */
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'set null' })
      .notNull(),
    /** 权限决策(值域 = TOOL_APPROVAL_ROUTES 镜像):flag=免提示直通 / approved=人批 / denied=拒绝。 */
    permissionDecision: varchar('permission_decision', { length: 16 }).notNull(),
    /** fail-closed 拒绝成因(值域 = TOOL_APPROVAL_DENY_CAUSES 镜像);仅 decision='denied' 有意义。 */
    permissionCause: varchar('permission_cause', { length: 32 }),
    /** 输入摘要(86B 唯一出口 digestToolArgsStructure 的输出,含前缀 79 字符;写侧禁止自算)。 */
    inputDigest: varchar('input_digest', { length: 80 }).notNull(),
    /** 输出摘要(结果文本 SHA-256 hex);NULL = 本次调用未观测到产出(在途/lost/拒绝未执行)。 */
    outputDigest: varchar('output_digest', { length: 64 }),
    /** 执行结果档(值域 = toolInvokeAuditResult 的输出集 success/failure/lost/unknown,由该既有映射函数派生,不另造词汇)。 */
    outcome: varchar('outcome', { length: 16 }).notNull(),
    /** 既有 execBudget `{ms}` 档的原样投影;NULL = 该工具未声明 ms 档(未判定,不是"无预算")。 */
    execBudgetMs: integer('exec_budget_ms'),
    /** 既有 execBudget `{notInterruptible:true, reason}` 档的 reason 原样投影;声明"不该被墙钟打断"的理由是数据不是注释。 */
    execBudgetNotInterruptibleReason: text('exec_budget_not_interruptible_reason'),
    toolName: varchar('tool_name', { length: 80 }).notNull(),
    sessionId: varchar('session_id', { length: 128 }).notNull(),
    /** D172 同款 W3C trace id(32 位小写 hex):关联键不是凭据,谁读它都只是"找到同一轮调用"。 */
    traceId: varchar('trace_id', { length: 32 }),
    turn: integer('turn'),
    streamId: varchar('stream_id', { length: 128 }),
    seq: integer('seq'),
    startedAtMs: bigint('started_at_ms', { mode: 'number' }),
    settledAtMs: bigint('settled_at_ms', { mode: 'number' }),
    /** ── 原文留存三列(O5 同型,见头注)── 默认摄入不携带原文;includeRaw 显式开才落。 */
    rawInput: text('raw_input'),
    rawOutput: text('raw_output'),
    rawRetentionDays: integer('raw_retention_days'),
    rawRetained: boolean('raw_retained').default(false).notNull(),
    rawPurgedAt: timestamp('raw_purged_at', { withTimezone: true }),
    /**
     * 指向 audit_logs_chain.id 的链行(由 recordAuditLog 落,action='tool.invoke')。
     * 刻意**不加外键约束**:链行是审计源、按设计永不删(篡改检测靠链本身),加 FK 只会让
     * 未来链面归档/保留策略先撞删除序;完整性由写侧"链成则账成、链败则不落账"保证
     * (recordToolInvocationLedger 先写链拿到 id 再插本行,链写失败整笔不落地)。
     */
    chainEntryId: uuid('chain_entry_id').notNull(),
    /** 对账字段(无判定含义):ip/userAgent 等仍走 JSON,判定列全部在上方。 */
    metadata: jsonb('metadata').default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    invocationUniq: uniqueIndex('tool_invocation_ledger_invocation_uniq').on(t.invocationId),
    userIdx: index('tool_invocation_ledger_user_idx').on(t.userId, t.createdAt),
    toolIdx: index('tool_invocation_ledger_tool_idx').on(t.toolName),
    sessionIdx: index('tool_invocation_ledger_session_idx').on(t.sessionId),
    chainIdx: index('tool_invocation_ledger_chain_idx').on(t.chainEntryId),
    traceIdx: index('tool_invocation_ledger_trace_idx')
      .on(t.traceId)
      .where(sql`${t.traceId} IS NOT NULL`),
    /**
     * 留存清除范围扫(`WHERE raw_retained = true AND created_at < cutoff`)的服务索引。
     * 与 llm_call_logs O5 的"不新建索引"决策**不同形**:那张表本就有
     * llm_call_logs_created_at_idx 可复用,而本表是新表 —— 没有这条索引,
     * 清除批次每次都是全表扫。"复用既有索引"的前提是"既有"存在,这里不存在。
     */
    createdIdx: index('tool_invocation_ledger_created_idx').on(t.createdAt),
    decisionChk: check(
      'tool_invocation_ledger_decision_check',
      sql`${t.permissionDecision} in ('flag', 'approved', 'denied')`,
    ),
    causeChk: check(
      'tool_invocation_ledger_cause_check',
      sql`${t.permissionCause} in ('no-prompt', 'prompt-declined', 'prompt-empty', 'prompt-error')`,
    ),
    outcomeChk: check(
      'tool_invocation_ledger_outcome_check',
      sql`${t.outcome} in ('success', 'failure', 'lost', 'unknown')`,
    ),
    retentionChk: check(
      'tool_invocation_ledger_retention_check',
      sql`${t.rawRetentionDays} is null or (${t.rawRetentionDays} >= 0 and ${t.rawRetentionDays} <= 3650)`,
    ),
  }),
)

export type ToolInvocationLedger = typeof toolInvocationLedger.$inferSelect
export type NewToolInvocationLedger = typeof toolInvocationLedger.$inferInsert
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
