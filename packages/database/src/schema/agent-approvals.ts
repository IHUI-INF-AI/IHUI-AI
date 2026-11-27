// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { sql } from 'drizzle-orm'
import {
  char,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { users } from './users.js'

/**
 * 破坏性动作审批(总管智能体 V2-01/P1-09,2026-11-27 立)。
 *
 * 为什么单独一张表、且**不复用** approval_persistence:
 * - 删除/彻底删除/回滚在跑定义必须是"用户点击才生效"的持久状态机;
 *   复用 session/always 缓存会让一次批准永久有效,删除类动作绝不能这样。
 * - 审批一次性:绑定 actor + definition_id + definition_version + action + impact_hash,
 *   执行前任一不匹配即 APPROVAL_MISMATCH;过期/已消费拒绝执行(I8/I20)。
 *
 * definition_id **不设外键**:定义被 purge 后审批证据仍须保留(归档 1 年),外键会随定义级联删证。
 * definition_name / definition_version 是发起时的快照,用于事后核对"批准的到底是哪一版"。
 *
 * precheck_token_hash / impact_hash 存 SHA-256(hex,64 字符),原文只在创建时返回一次;
 * impact_snapshot 是预检报告完整快照,审批卡展示它,执行前重新预检,新增阻断即 AGENT_DELETE_BLOCKED。
 *
 * 状态机:pending →(approve)→ approved →(execute)→ consumed;pending →(reject)→ rejected;
 * pending TTL 到期 → expired;approved 执行失败 → failed(可重新发起,不复用旧行)。
 */
export const agentManagementApprovals = pgTable(
  'agent_management_approvals',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** 不设 FK:定义 purge 后审批证据必须留存 */
    definitionId: uuid('definition_id'),
    definitionName: varchar('definition_name', { length: 100 }).notNull(),
    definitionVersion: integer('definition_version').notNull(),
    /** delete | purge | rollback */
    action: varchar('action', { length: 16 }).$type<AgentApprovalAction>().notNull(),
    /** 用户注销后保留审批证据 → SET NULL;执行时 actor 为空一律拒绝 */
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    /** pending | approved | rejected | expired | consumed | failed */
    status: varchar('status', { length: 16 })
      .$type<AgentApprovalStatus>()
      .default('pending')
      .notNull(),
    /** 预检 token 的 SHA-256(hex);原文只在创建时返回一次 */
    precheckTokenHash: char('precheck_token_hash', { length: 64 }).notNull(),
    /** 预检报告 + 目标版本的规范化摘要(SHA-256),执行前重算比对 */
    impactHash: char('impact_hash', { length: 64 }).notNull(),
    impactSnapshot: jsonb('impact_snapshot').$type<Record<string, unknown>>().notNull(),
    reason: text('reason'),
    requestId: varchar('request_id', { length: 64 }),
    traceId: varchar('trace_id', { length: 64 }),
    ip: varchar('ip', { length: 64 }),
    userAgent: varchar('user_agent', { length: 512 }),
    requestedAt: timestamp('requested_at', { withTimezone: true }).defaultNow().notNull(),
    /** 用户点批准/拒绝的时间 */
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    /** 动作真正执行的时间;consumed 后不可重放 */
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    /** TTL 到期时间(10 分钟);到期未决即 expired */
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    errorMessage: text('error_message'),
  },
  (t) => ({
    /** 定义维度的时间倒序列表(注意:表内时间列是 requested_at,不是 created_at) */
    defRequestedIdx: index('ix_agent_approvals_def_requested').on(
      t.definitionId,
      t.requestedAt.desc(),
    ),
    actorStatusIdx: index('ix_agent_approvals_actor_status').on(t.actorUserId, t.status),
    /** 过期扫描面:(status, expires_at);只扫 pending/approved 由服务层 WHERE 收口 */
    statusExpiresIdx: index('ix_agent_approvals_status_expires').on(t.status, t.expiresAt),
    actionCheck: check(
      'ck_agent_approval_action',
      sql`${t.action} in ('delete', 'purge', 'rollback')`,
    ),
    statusCheck: check(
      'ck_agent_approval_status',
      sql`${t.status} in ('pending', 'approved', 'rejected', 'expired', 'consumed', 'failed')`,
    ),
    versionCheck: check('ck_agent_approval_definition_version', sql`${t.definitionVersion} > 0`),
  }),
)

export type AgentApprovalAction = 'delete' | 'purge' | 'rollback'
export type AgentApprovalStatus =
  'pending' | 'approved' | 'rejected' | 'expired' | 'consumed' | 'failed'

export type AgentManagementApproval = typeof agentManagementApprovals.$inferSelect
export type NewAgentManagementApproval = typeof agentManagementApprovals.$inferInsert
