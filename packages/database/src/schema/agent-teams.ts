// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { sql } from 'drizzle-orm'
import {
  check,
  index,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { users } from './users.js'

/**
 * 多 Agent 协作域:团队实体 / 成员 / 持久收件箱(2026-11-04 立)。
 *
 * 为什么表名统一 `agent_` 前缀:仓库里既有 `teams` / `team_members` 是**面向人的工作区团队**
 * (slug 必填、成员以 users.id 为主键、角色 owner/admin/member),其语义和约束与"Agent 协作团队"
 * (memberKind=agent|human、成员唯一 active 归属、lead/member 两档)不兼容。复用旧表需要
 * 放宽 userId 非空约束并叠加第二套角色语义,会把线上协作团队的读写路径一并拖进风险面,
 * 因此本域独立建表;旧表保持原样不动。
 *
 * 三条硬约束的来源:
 * - 成员同一时刻只属于一个 active team → 部分唯一索引 (member_kind, member_id) WHERE left_at IS NULL。
 *   解散/移除成员时写 left_at,索引自然放行,不靠应用层"先查后写"的竞态窗口。
 * - 收件箱重试幂等 → (team_id, idempotency_key) 唯一索引 + ON CONFLICT DO NOTHING。
 * - 团队归属判定(跨租户不可见)→ 每次读写先按 team_id + 成员身份过闸,拒绝时按 404/403 返回,
 *   绝不用"过滤掉"代替鉴权。
 *
 * 产物转交(handoff)不另立第四张表:一条 handoff 就是收件箱里 kind='handoff' 的消息,
 * payload 固定携带 {artifactPath, sha256, fromMember, toMember, transferredAt, sizeBytes},
 * 转交前由服务层重算文件 sha256 与请求值比对,不一致即拒绝。
 */

/** 成员种类:Agent 或人 */
export type AgentTeamMemberKind = 'agent' | 'human'
/** 团队内角色:只有 lead 能管理团队与成员 */
export type AgentTeamRole = 'lead' | 'member'
/** 收件箱消息种类 */
export type AgentTeamInboxKind = 'message' | 'handoff' | 'system'

/** handoff 消息 payload 的唯一形状(服务层写入,不信任调用方的额外字段) */
export interface AgentTeamHandoffPayload {
  artifactPath: string
  sha256: string
  fromMember: string
  toMember: string
  transferredAt: string
  sizeBytes: number
}

export type AgentTeamInboxPayload = Record<string, unknown> | AgentTeamHandoffPayload

export const agentTeams = pgTable(
  'agent_teams',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 128 }).notNull(),
    /** active | dissolved:解散后不可再收发/转交 */
    status: varchar('status', { length: 16 }).notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    dissolvedAt: timestamp('dissolved_at', { withTimezone: true }),
  },
  (t) => ({
    ownerIdx: index('agent_teams_owner_idx').on(t.ownerId),
    /** 拒绝 active|dissolved 之外的第三值,避免"半解散"状态漏判 */
    statusCheck: check('agent_teams_status_check', sql`${t.status} in ('active', 'dissolved')`),
  }),
)

export const agentTeamMembers = pgTable(
  'agent_team_members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => agentTeams.id, { onDelete: 'cascade' }),
    memberKind: varchar('member_kind', { length: 16 }).$type<AgentTeamMemberKind>().notNull(),
    /** agent 用 Agent 标识,human 用 users.id 文本形态,统一字符列以容纳两种主体 */
    memberId: varchar('member_id', { length: 128 }).notNull(),
    role: varchar('role', { length: 16 }).$type<AgentTeamRole>().notNull().default('member'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
    /** 移除/解散时写 NOW();NULL = 仍在团队内(部分唯一索引的判据) */
    leftAt: timestamp('left_at', { withTimezone: true }),
  },
  (t) => ({
    /** 同一团队内同一主体只留一行,重试加入幂等 */
    teamMemberUq: uniqueIndex('agent_team_members_team_member_uq').on(
      t.teamId,
      t.memberKind,
      t.memberId,
    ),
    /** 成员同一时刻只属于一个 active team(硬约束,不靠应用层事务) */
    activeMemberUq: uniqueIndex('agent_team_members_active_uq')
      .on(t.memberKind, t.memberId)
      .where(sql`${t.leftAt} IS NULL`),
    teamIdx: index('agent_team_members_team_idx').on(t.teamId),
    kindCheck: check('agent_team_members_kind_check', sql`${t.memberKind} in ('agent', 'human')`),
    roleCheck: check('agent_team_members_role_check', sql`${t.role} in ('lead', 'member')`),
  }),
)

export const agentTeamInbox = pgTable(
  'agent_team_inbox',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => agentTeams.id, { onDelete: 'cascade' }),
    fromMemberKind: varchar('from_member_kind', { length: 16 })
      .$type<AgentTeamMemberKind>()
      .notNull(),
    fromMemberId: varchar('from_member_id', { length: 128 }).notNull(),
    toMemberKind: varchar('to_member_kind', { length: 16 }).$type<AgentTeamMemberKind>().notNull(),
    toMemberId: varchar('to_member_id', { length: 128 }).notNull(),
    kind: varchar('kind', { length: 16 }).$type<AgentTeamInboxKind>().notNull().default('message'),
    /** 发送方生成的重试幂等键;同一 (team_id, key) 只允许一行 */
    idempotencyKey: varchar('idempotency_key', { length: 128 }).notNull(),
    payload: jsonb('payload').$type<AgentTeamInboxPayload>().notNull().default({}),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    teamIdemUq: uniqueIndex('agent_team_inbox_team_idem_uq').on(t.teamId, t.idempotencyKey),
    /** 拉取固定走 (team_id, to_member_kind, to_member_id),顺序与索引列序一致 */
    toIdx: index('agent_team_inbox_to_idx').on(t.teamId, t.toMemberKind, t.toMemberId, t.createdAt),
    kindCheck: check(
      'agent_team_inbox_kind_check',
      sql`${t.kind} in ('message', 'handoff', 'system')`,
    ),
  }),
)

export type AgentTeam = typeof agentTeams.$inferSelect
export type AgentTeamMember = typeof agentTeamMembers.$inferSelect
export type AgentTeamInboxEntry = typeof agentTeamInbox.$inferSelect
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
