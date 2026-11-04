// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { and, asc, eq, isNull, sql } from 'drizzle-orm'
import {
  agentTeamInbox,
  agentTeamMembers,
  agentTeams,
  type AgentTeam,
  type AgentTeamInboxEntry,
  type AgentTeamInboxKind,
  type AgentTeamInboxPayload,
  type AgentTeamMember,
  type AgentTeamMemberKind,
  type AgentTeamRole,
} from '@ihui/database'
import { db } from './index.js'

/** 成员引用:Agent 用 agentId,human 用 users.id 文本形态 */
export interface AgentTeamMemberRef {
  memberKind: AgentTeamMemberKind
  memberId: string
}

interface CreateAgentTeamInput {
  ownerId: string
  name: string
}

export interface InsertMemberInput extends AgentTeamMemberRef {
  teamId: string
  role: AgentTeamRole
}

export interface InsertInboxInput {
  teamId: string
  fromMemberKind: AgentTeamMemberKind
  fromMemberId: string
  toMemberKind: AgentTeamMemberKind
  toMemberId: string
  kind: AgentTeamInboxKind
  idempotencyKey: string
  payload: AgentTeamInboxPayload
}

export interface AgentTeamRepository {
  createTeamWithLead(
    input: CreateAgentTeamInput,
  ): Promise<{ team: AgentTeam; lead: AgentTeamMember }>
  findTeamById(teamId: string): Promise<AgentTeam | null>
  findActiveTeamByMember(
    ref: AgentTeamMemberRef,
  ): Promise<{ team: AgentTeam; member: AgentTeamMember } | null>
  findMember(
    teamId: string,
    ref: AgentTeamMemberRef,
    options?: { activeOnly?: boolean },
  ): Promise<AgentTeamMember | null>
  listMembers(teamId: string, options?: { activeOnly?: boolean }): Promise<AgentTeamMember[]>
  countActiveLeads(teamId: string): Promise<number>
  insertMember(input: InsertMemberInput): Promise<AgentTeamMember>
  markMemberLeft(teamId: string, ref: AgentTeamMemberRef): Promise<AgentTeamMember | null>
  dissolveTeam(teamId: string): Promise<AgentTeam | null>
  findInboxByKey(teamId: string, idempotencyKey: string): Promise<AgentTeamInboxEntry | null>
  insertInbox(input: InsertInboxInput): Promise<{ entry: AgentTeamInboxEntry; duplicated: boolean }>
  listInbox(teamId: string, to?: AgentTeamMemberRef): Promise<AgentTeamInboxEntry[]>
  findInboxById(teamId: string, id: string): Promise<AgentTeamInboxEntry | null>
  markInboxRead(teamId: string, id: string, readAt: Date): Promise<AgentTeamInboxEntry | null>
  countInboxByKey(teamId: string, idempotencyKey: string): Promise<number>
}

function memberWhere(teamId: string, ref: AgentTeamMemberRef) {
  return and(
    eq(agentTeamMembers.teamId, teamId),
    eq(agentTeamMembers.memberKind, ref.memberKind),
    eq(agentTeamMembers.memberId, ref.memberId),
  )
}

/**
 * PostgreSQL 实现:所有多行操作走同一个 drizzle 实例,不另开连接。
 * 团队创建与解散用事务包住"团队行 + 成员行"两次写入,避免中途崩溃留下半状态。
 */
export const postgresAgentTeamRepository: AgentTeamRepository = {
  async createTeamWithLead(input) {
    return db.transaction(async (tx) => {
      const [team] = await tx
        .insert(agentTeams)
        .values({ ownerId: input.ownerId, name: input.name })
        .returning()
      if (!team) throw new Error('agent_teams insert returned no row')
      const [lead] = await tx
        .insert(agentTeamMembers)
        .values({
          teamId: team.id,
          memberKind: 'human',
          memberId: input.ownerId,
          role: 'lead',
        })
        .returning()
      if (!lead) throw new Error('agent_team_members insert returned no row')
      return { team, lead }
    })
  },

  async findTeamById(teamId) {
    const rows = await db.select().from(agentTeams).where(eq(agentTeams.id, teamId)).limit(1)
    return rows[0] ?? null
  },

  async findActiveTeamByMember(ref) {
    const rows = await db
      .select({ team: agentTeams, member: agentTeamMembers })
      .from(agentTeamMembers)
      .innerJoin(agentTeams, eq(agentTeamMembers.teamId, agentTeams.id))
      .where(
        and(
          eq(agentTeamMembers.memberKind, ref.memberKind),
          eq(agentTeamMembers.memberId, ref.memberId),
          isNull(agentTeamMembers.leftAt),
          eq(agentTeams.status, 'active'),
        ),
      )
      .limit(1)
    return rows[0] ?? null
  },

  async findMember(teamId, ref, options) {
    const conditions = [memberWhere(teamId, ref)]
    if (options?.activeOnly ?? true) conditions.push(isNull(agentTeamMembers.leftAt))
    const rows = await db
      .select()
      .from(agentTeamMembers)
      .where(and(...conditions))
      .limit(1)
    return rows[0] ?? null
  },

  async listMembers(teamId, options) {
    const conditions = [eq(agentTeamMembers.teamId, teamId)]
    if (options?.activeOnly ?? true) conditions.push(isNull(agentTeamMembers.leftAt))
    return db
      .select()
      .from(agentTeamMembers)
      .where(and(...conditions))
      .orderBy(asc(agentTeamMembers.joinedAt))
  },

  async countActiveLeads(teamId) {
    const rows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(agentTeamMembers)
      .where(
        and(
          eq(agentTeamMembers.teamId, teamId),
          eq(agentTeamMembers.role, 'lead'),
          isNull(agentTeamMembers.leftAt),
        ),
      )
    return rows[0]?.count ?? 0
  },

  async insertMember(input) {
    // 成员行是"加入历史"的唯一一行:同一主体重新加入时复活旧行而不是再插一行,
    // 否则 (team_id, member_kind, member_id) 唯一索引会把合法回归拒掉。
    const [row] = await db
      .insert(agentTeamMembers)
      .values({
        teamId: input.teamId,
        memberKind: input.memberKind,
        memberId: input.memberId,
        role: input.role,
      })
      .onConflictDoUpdate({
        target: [agentTeamMembers.teamId, agentTeamMembers.memberKind, agentTeamMembers.memberId],
        set: { leftAt: null, role: input.role, joinedAt: new Date() },
      })
      .returning()
    if (!row) throw new Error('agent_team_members upsert returned no row')
    return row
  },

  async markMemberLeft(teamId, ref) {
    const [row] = await db
      .update(agentTeamMembers)
      .set({ leftAt: new Date() })
      .where(and(memberWhere(teamId, ref), isNull(agentTeamMembers.leftAt)))
      .returning()
    return row ?? null
  },

  async dissolveTeam(teamId) {
    return db.transaction(async (tx) => {
      const [team] = await tx
        .update(agentTeams)
        .set({ status: 'dissolved', dissolvedAt: new Date() })
        .where(and(eq(agentTeams.id, teamId), eq(agentTeams.status, 'active')))
        .returning()
      if (!team) return null
      await tx
        .update(agentTeamMembers)
        .set({ leftAt: new Date() })
        .where(and(eq(agentTeamMembers.teamId, teamId), isNull(agentTeamMembers.leftAt)))
      return team
    })
  },

  async findInboxByKey(teamId, idempotencyKey) {
    const rows = await db
      .select()
      .from(agentTeamInbox)
      .where(
        and(eq(agentTeamInbox.teamId, teamId), eq(agentTeamInbox.idempotencyKey, idempotencyKey)),
      )
      .limit(1)
    return rows[0] ?? null
  },

  async insertInbox(input) {
    const rows = await db
      .insert(agentTeamInbox)
      .values(input)
      .onConflictDoNothing({ target: [agentTeamInbox.teamId, agentTeamInbox.idempotencyKey] })
      .returning()
    if (rows[0]) return { entry: rows[0], duplicated: false }
    const existing = await this.findInboxByKey(input.teamId, input.idempotencyKey)
    if (!existing) throw new Error('agent_team_inbox idempotency conflict without existing row')
    return { entry: existing, duplicated: true }
  },

  async listInbox(teamId, to) {
    const conditions = [eq(agentTeamInbox.teamId, teamId)]
    if (to) {
      conditions.push(
        eq(agentTeamInbox.toMemberKind, to.memberKind),
        eq(agentTeamInbox.toMemberId, to.memberId),
      )
    }
    return db
      .select()
      .from(agentTeamInbox)
      .where(and(...conditions))
      .orderBy(asc(agentTeamInbox.createdAt), asc(agentTeamInbox.id))
  },

  async findInboxById(teamId, id) {
    const rows = await db
      .select()
      .from(agentTeamInbox)
      .where(and(eq(agentTeamInbox.teamId, teamId), eq(agentTeamInbox.id, id)))
      .limit(1)
    return rows[0] ?? null
  },

  async markInboxRead(teamId, id, readAt) {
    const [row] = await db
      .update(agentTeamInbox)
      .set({ readAt })
      .where(and(eq(agentTeamInbox.teamId, teamId), eq(agentTeamInbox.id, id)))
      .returning()
    return row ?? null
  },

  async countInboxByKey(teamId, idempotencyKey) {
    const rows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(agentTeamInbox)
      .where(
        and(eq(agentTeamInbox.teamId, teamId), eq(agentTeamInbox.idempotencyKey, idempotencyKey)),
      )
    return rows[0]?.count ?? 0
  },
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
