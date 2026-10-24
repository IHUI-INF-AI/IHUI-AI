// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { sql } from 'drizzle-orm'
import { check, index, jsonb, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core'

/**
 * G-40 / G-734 A 格:跨会话幂等事实的持久载体(2026-10-26 立)。
 *
 * 与 `apps/api/src/services/run-idempotency.ts` 的分工:那一层是**零 I/O** 的槽位内核(KV 端口,
 * 进程重放用),本表是**落库**的事实面 —— 跨会话、跨进程重启后仍可回放的那一份。两边共用同一套
 * 坐标语义,不是两套真相:命名空间/归属不进本表主键,主键严格照票面的
 * `child:<parentSessionId>:<sourceCommandId>`。
 *
 * 主键为什么是两列而不是一个拼好的字符串:拼串形态里段内分隔符会把两个作用域折到同一条事实
 * (`a:b` + `c` 与 `a` + `b:c`),而元组形态结构上不存在这个边界;`slotKeyOf` 的转义段是同一
 * 纪律在内核侧的写法。
 */
export const commandAckFacts = pgTable(
  'command_ack_facts',
  {
    parentSessionId: text('parent_session_id').notNull(),
    sourceCommandId: text('source_command_id').notNull(),
    /** 归属主体(如 `user:42`)。不编进主键(票面主键只有父会话 + 命令 id),读侧必须按它过滤。 */
    ownerKey: text('owner_key').notNull(),
    /** 请求指纹:同 key 换请求体要能报 `key-reused`,与内核 `requestFingerprint` 同口径。 */
    fingerprint: text('fingerprint').notNull(),
    /** `processing`(已抢槽、载荷未定)/ `completed`(载荷已落)。损坏不落档,见载侧 CHECK。 */
    status: text('status').notNull(),
    /** 回放值。`completed` 必须非空 —— 事实损坏即硬错,绝不把损坏写成合法行。 */
    payload: jsonb('payload'),
    /** 事实引用的全部实体(规范化作用域串),E 格存活校验与 ③ 局部性断言的共同来源。 */
    entityRefs: jsonb('entity_refs').$type<string[]>().default([]).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    /** 票面未给保留期 ⇒ 不设默认值;NULL = 不自动过期,与写侧 ttlMs 同源。 */
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (t) => ({
    /** 票面主键 `child:<parentSessionId>:<sourceCommandId>` 的元组形态,自带唯一索引。 */
    pk: primaryKey({ columns: [t.parentSessionId, t.sourceCommandId] }),
    statusChk: check('command_ack_facts_status_chk', sql`${t.status} in ('processing', 'completed')`),
    payloadStateChk: check(
      'command_ack_facts_payload_state_chk',
      sql`(${t.status} = 'processing' and ${t.payload} is null) or (${t.status} = 'completed' and ${t.payload} is not null)`,
    ),
    expiresIdx: index('command_ack_facts_expires_at_idx').on(t.expiresAt),
  }),
)

export type CommandAckFact = typeof commandAckFacts.$inferSelect
export type NewCommandAckFact = typeof commandAckFacts.$inferInsert
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
