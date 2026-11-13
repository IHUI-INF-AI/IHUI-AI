// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  jsonb,
  char,
  index,
  uniqueIndex,
  bigserial,
  boolean,
} from 'drizzle-orm/pg-core'
import { users } from './users.js'

/**
 * 国安级审计日志链表。
 * 独立于现有 audit_logs 表,采用 prev_hash/current_hash 链式结构保证日志不可篡改。
 * user_id 可空(未鉴权的写操作或系统操作);用户删除时保留审计记录,userId 置 NULL。
 */
export const auditLogsChain = pgTable(
  'audit_logs_chain',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /**
     * F-274(2026-11-14 立):链序 —— 单调序号,写入顺序即链序。
     *
     * 旧实现写链时用 `ORDER BY timestamp DESC LIMIT 1` 取链尾,而 timestamp 是各实例
     * 的本地毫秒时钟:跨实例偏差 / NTP 回拨会让"时间戳最大"不等于"最后写入",
     * 同毫秒并发时也没有 tie-breaker(id 是随机 uuid)。后果是先写后读挂错前驱
     * (链分叉),或校验按时间戳重排后误报"链断裂"。
     *
     * 本列由库序列分配(迁移 20261114091500),**不进哈希输入**(存量行 current_hash
     * 因此一字不改),存量行按物理插入顺序回填。
     */
    seq: bigserial('seq', { mode: 'number' }).notNull(),
    timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    action: varchar('action', { length: 64 }).notNull(),
    resourceType: varchar('resource_type', { length: 64 }),
    resourceId: varchar('resource_id', { length: 64 }),
    ip: varchar('ip', { length: 64 }),
    userAgent: varchar('user_agent', { length: 512 }),
    result: varchar('result', { length: 32 }),
    metadata: jsonb('metadata').default({}),
    /**
     * G-790 A5(2026-10-18 立):原文当前是否仍在表内 —— 判别列,不是 JSON 键。
     *
     * 保留清理的候选筛今天写的是 `COALESCE(metadata->>'rawRetained','true') <> 'false'`,
     * 正确性依赖"只有本 job 的擦除步骤会写这个键"这一**巧合**;同表 `user_agent`/`result`
     * 早就证明"列可以存在于哈希输入之外"(`computeHash` 只吃 prevHash + AuditEntry 字段),
     * 所以给这张哈希链表加判别列**不改任何既有行的哈希**,回填也只读 metadata 不写它。
     * 默认 true = "原文在"(与旧谓词把缺键当作在完全同形);擦除步骤同批置 false。
     */
    rawRetained: boolean('raw_retained').default(true).notNull(),
    prevHash: char('prev_hash', { length: 64 }).notNull(),
    currentHash: char('current_hash', { length: 64 }).notNull(),
  },
  (t) => ({
    seqUniq: uniqueIndex('audit_logs_chain_seq_uniq').on(t.seq),
    tsIdx: index('idx_audit_chain_ts').on(t.timestamp),
    userIdx: index('idx_audit_chain_user').on(t.userId),
    actIdx: index('idx_audit_chain_act').on(t.action),
  }),
)

export type AuditLogChain = typeof auditLogsChain.$inferSelect
export type NewAuditLogChain = typeof auditLogsChain.$inferInsert
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
