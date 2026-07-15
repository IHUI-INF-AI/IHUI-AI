import { eq, and, or, desc, sql } from 'drizzle-orm'
import { db } from './index.js'
import {
  teams,
  teamMembers,
  teamInvitations,
  users,
  type Team,
  type TeamMember,
  type TeamInvitation,
} from '@ihui/database'

// =============================================================================
// Teams
// =============================================================================

export interface CreateTeamInput {
  name: string
  slug: string
  description?: string
  ownerId: string
  avatar?: string
}

export interface UpdateTeamInput {
  name?: string
  description?: string
  avatar?: string
}

/**
 * 创建团队，同时写入 owner 成员记录。
 */
export async function createTeam(data: CreateTeamInput): Promise<Team> {
  const rows = await db
    .insert(teams)
    .values({
      name: data.name,
      slug: data.slug,
      description: data.description,
      ownerId: data.ownerId,
      avatar: data.avatar,
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('创建团队失败')

  await db.insert(teamMembers).values({
    teamId: row.id,
    userId: data.ownerId,
    role: 'owner',
  })

  return row
}

/**
 * 列出当前用户加入的所有团队（含 owner / admin / member）。
 * 附带 ownerName（owner 昵称）和 memberCount（成员数）。
 */
export async function findTeamsByUser(
  userId: string,
): Promise<(Team & { ownerName: string | null; memberCount: number })[]> {
  const rows = await db
    .select({
      id: teams.id,
      name: teams.name,
      slug: teams.slug,
      description: teams.description,
      ownerId: teams.ownerId,
      avatar: teams.avatar,
      createdAt: teams.createdAt,
      updatedAt: teams.updatedAt,
      ownerName: users.nickname,
      memberCount: sql<number>`(
        SELECT COUNT(*)::int FROM ${teamMembers} WHERE ${teamMembers.teamId} = ${sql.raw('teams.id')}
      )`,
    })
    .from(teams)
    .innerJoin(teamMembers, eq(teamMembers.teamId, teams.id))
    .leftJoin(users, eq(users.id, teams.ownerId))
    .where(eq(teamMembers.userId, userId))
    .orderBy(desc(teams.updatedAt))
  return rows
}

/**
 * 按 id 查询团队。
 */
export async function findTeamById(id: string): Promise<Team | undefined> {
  const rows = await db.select().from(teams).where(eq(teams.id, id)).limit(1)
  return rows[0]
}

/**
 * 按 id 查询团队详情，附带 ownerName（owner 昵称）和 memberCount（成员数）。
 */
export async function findTeamDetailById(
  id: string,
): Promise<(Team & { ownerName: string | null; memberCount: number }) | undefined> {
  const rows = await db
    .select({
      id: teams.id,
      name: teams.name,
      slug: teams.slug,
      description: teams.description,
      ownerId: teams.ownerId,
      avatar: teams.avatar,
      createdAt: teams.createdAt,
      updatedAt: teams.updatedAt,
      ownerName: users.nickname,
      memberCount: sql<number>`(
        SELECT COUNT(*)::int FROM ${teamMembers} WHERE ${teamMembers.teamId} = ${sql.raw('teams.id')}
      )`,
    })
    .from(teams)
    .leftJoin(users, eq(users.id, teams.ownerId))
    .where(eq(teams.id, id))
    .limit(1)
  return rows[0]
}

/**
 * 按 slug 查询团队（用于唯一性校验）。
 */
export async function findTeamBySlug(slug: string): Promise<Team | undefined> {
  const rows = await db.select().from(teams).where(eq(teams.slug, slug)).limit(1)
  return rows[0]
}

/**
 * 更新团队字段。
 */
export async function updateTeam(id: string, data: UpdateTeamInput): Promise<Team> {
  const rows = await db
    .update(teams)
    .set({
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.avatar !== undefined && { avatar: data.avatar }),
      updatedAt: new Date(),
    })
    .where(eq(teams.id, id))
    .returning()
  const row = rows[0]
  if (!row) throw new Error('更新团队失败')
  return row
}

/**
 * 删除团队（级联删除成员/邀请由数据库外键保证）。
 */
export async function deleteTeam(id: string): Promise<void> {
  await db.delete(teams).where(eq(teams.id, id))
}

// =============================================================================
// Team Members
// =============================================================================

export interface TeamMemberRow {
  id: string
  teamId: string
  userId: string
  role: string
  joinedAt: Date
  nickname: string | null
  email: string | null
  avatar: string | null
}

/**
 * 列出团队成员，附带用户基础信息。
 */
export async function findTeamMembers(teamId: string): Promise<TeamMemberRow[]> {
  return db
    .select({
      id: teamMembers.id,
      teamId: teamMembers.teamId,
      userId: teamMembers.userId,
      role: teamMembers.role,
      joinedAt: teamMembers.joinedAt,
      nickname: users.nickname,
      email: users.email,
      avatar: users.avatar,
    })
    .from(teamMembers)
    .innerJoin(users, eq(users.id, teamMembers.userId))
    .where(eq(teamMembers.teamId, teamId))
    .orderBy(desc(teamMembers.joinedAt))
}

/**
 * 查询某用户在某团队的成员记录。
 */
export async function findTeamMember(
  teamId: string,
  userId: string,
): Promise<TeamMember | undefined> {
  const rows = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
    .limit(1)
  return rows[0]
}

/**
 * 移除团队成员。
 */
export async function removeTeamMember(teamId: string, userId: string): Promise<void> {
  await db
    .delete(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
}

/**
 * 修改成员角色。
 */
export async function updateTeamMemberRole(
  teamId: string,
  userId: string,
  role: string,
): Promise<TeamMember | undefined> {
  const rows = await db
    .update(teamMembers)
    .set({ role })
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
    .returning()
  return rows[0]
}

/**
 * 统计团队成员数量。
 */
export async function countTeamMembers(teamId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(teamMembers)
    .where(eq(teamMembers.teamId, teamId))
  return Number(rows[0]?.count ?? 0)
}

// =============================================================================
// Team Invitations
// =============================================================================

export interface CreateInvitationInput {
  teamId: string
  inviterId: string
  inviteeId?: string
  email?: string
  token: string
  expiresAt: Date
}

/**
 * 创建邀请。
 */
export async function createInvitation(data: CreateInvitationInput): Promise<TeamInvitation> {
  const rows = await db
    .insert(teamInvitations)
    .values({
      teamId: data.teamId,
      inviterId: data.inviterId,
      inviteeId: data.inviteeId,
      email: data.email,
      token: data.token,
      status: 'pending',
      expiresAt: data.expiresAt,
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('创建邀请失败')
  return row
}

/**
 * 列出团队的邀请（仅 owner/admin 使用）。
 */
export async function findInvitationsByTeam(teamId: string): Promise<TeamInvitation[]> {
  return db
    .select()
    .from(teamInvitations)
    .where(eq(teamInvitations.teamId, teamId))
    .orderBy(desc(teamInvitations.createdAt))
}

/**
 * 按 token 查询邀请。
 */
export async function findInvitationByToken(token: string): Promise<TeamInvitation | undefined> {
  const rows = await db
    .select()
    .from(teamInvitations)
    .where(eq(teamInvitations.token, token))
    .limit(1)
  return rows[0]
}

/**
 * 列出当前用户收到的所有邀请（按 invitee_id 匹配，或按邮箱匹配）。
 */
export async function findUserInvitations(userId: string): Promise<TeamInvitation[]> {
  // 先取用户邮箱
  const userRows = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  const userEmail = userRows[0]?.email ?? null

  return db
    .select()
    .from(teamInvitations)
    .where(
      or(
        eq(teamInvitations.inviteeId, userId),
        ...(userEmail ? [eq(teamInvitations.email, userEmail)] : []),
      ),
    )
    .orderBy(desc(teamInvitations.createdAt))
}

/**
 * 接受邀请：写入成员记录并将邀请置为 accepted。
 */
export async function acceptInvitation(
  invitation: TeamInvitation,
  userId: string,
): Promise<{ invitation: TeamInvitation; member: TeamMember | undefined }> {
  // 若用户尚未在团队中，则插入成员
  const existing = await findTeamMember(invitation.teamId, userId)
  let member: TeamMember | undefined = existing
  if (!existing) {
    const rows = await db
      .insert(teamMembers)
      .values({ teamId: invitation.teamId, userId, role: 'member' })
      .returning()
    member = rows[0]
  }

  const updated = await db
    .update(teamInvitations)
    .set({ status: 'accepted' })
    .where(eq(teamInvitations.id, invitation.id))
    .returning()
  return { invitation: updated[0] ?? invitation, member }
}

/**
 * 拒绝邀请：仅将状态置为 rejected。
 */
export async function rejectInvitation(
  invitation: TeamInvitation,
): Promise<TeamInvitation | undefined> {
  const rows = await db
    .update(teamInvitations)
    .set({ status: 'rejected' })
    .where(eq(teamInvitations.id, invitation.id))
    .returning()
  return rows[0]
}
