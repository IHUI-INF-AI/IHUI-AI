// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 协作团队端点(Wave1 2026-10-26 立,补屏 teams / teams/[id])。
 *
 * 覆盖端点(后端 apps/api/src/routes/teams.ts 已实装,本层只做信封封装):
 * - GET    /api/teams                      当前用户团队列表
 * - POST   /api/teams                      创建团队(name/slug/description)
 * - GET    /api/teams/:id                  团队详情(仅成员可见)
 * - PATCH  /api/teams/:id                  更新团队(仅 owner/admin)
 * - DELETE /api/teams/:id                  删除团队(仅 owner)
 * - GET    /api/teams/:id/members          成员列表
 * - PATCH  /api/teams/:id/members/:userId  改成员角色(仅 owner,owner 本人不可改)
 * - DELETE /api/teams/:id/members/:userId  移除成员(仅 owner/admin)
 * - GET    /api/teams/:id/invitations      邀请列表(仅 owner/admin)
 * - POST   /api/teams/:id/invitations      邀请成员(email)
 * - DELETE /api/teams/:id/invitations/:invitationId  撤销邀请(与 web PageClient.tsx:95 同口径)
 *
 * 命名说明:分销团友族(getTeamStats/getTeamMembers/getTeamMemberDetail,见
 * endpoints/distribution.ts)已占名,本文件按"协作团队"语义另立名字,零冲突。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'

/** 成员角色(对齐后端 updateMemberRoleSchema 与 web [id]/types.ts:8)。 */
export type TeamRole = 'owner' | 'admin' | 'member'

/** 邀请状态(对齐 web [id]/types.ts:31)。 */
export type TeamInvitationStatus = 'pending' | 'accepted' | 'expired'

/** 团队行(对齐后端 serializeTeam,teams.ts:69)。 */
export interface TeamListItem {
  id: string
  name: string
  slug: string
  description: string
  ownerId: string
  ownerName: string | null
  avatar: string | null
  memberCount: number
  createdAt: string
  updatedAt: string
}

/** 团队成员行(对齐后端 serializeMember,teams.ts:84)。 */
export interface TeamMemberRow {
  id: string
  teamId: string
  userId: string
  role: TeamRole
  joinedAt: string
  nickname: string | null
  email: string | null
  avatar: string | null
}

/** 团队邀请行(对齐后端 serializeInvitation,teams.ts:106)。 */
export interface TeamInvitationRow {
  id: string
  teamId: string
  inviterId: string
  inviteeId: string | null
  email: string | null
  invitee: string | null
  token: string
  status: TeamInvitationStatus
  expiresAt: string
  createdAt: string
}

/** 获取当前用户的协作团队列表(web helpers.ts:9 fetchTeams 同口径)。 */
export async function getTeams(): Promise<ApiResult<{ teams: TeamListItem[] }>> {
  return fetchApi<{ teams: TeamListItem[] }>('/api/teams')
}

/** 创建团队(web helpers.ts:19 createTeam 同口径)。 */
export async function createTeam(input: {
  name: string
  slug: string
  description?: string
}): Promise<ApiResult<{ team: TeamListItem }>> {
  return fetchApi<{ team: TeamListItem }>('/api/teams', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 获取团队详情(web PageClient.tsx:37 同口径)。 */
export async function getTeamById(id: string): Promise<ApiResult<{ team: TeamListItem }>> {
  return fetchApi<{ team: TeamListItem }>(`/api/teams/${id}`)
}

/** 更新团队名称/描述(web PageClient.tsx:100 PATCH 同口径)。 */
export async function updateTeamById(
  id: string,
  input: { name?: string; description?: string },
): Promise<ApiResult<{ team: TeamListItem }>> {
  return fetchApi<{ team: TeamListItem }>(`/api/teams/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

/** 删除团队(web PageClient.tsx:112 DELETE 同口径)。 */
export async function deleteTeamById(id: string): Promise<ApiResult<{ deleted: boolean }>> {
  return fetchApi<{ deleted: boolean }>(`/api/teams/${id}`, { method: 'DELETE' })
}

/** 获取团队成员列表(web PageClient.tsx:43 同口径)。 */
export async function getTeamMembersById(
  id: string,
): Promise<ApiResult<{ members: TeamMemberRow[] }>> {
  return fetchApi<{ members: TeamMemberRow[] }>(`/api/teams/${id}/members`)
}

/** 修改成员角色(web PageClient.tsx:88 PATCH 同口径,路径参数是 userId)。 */
export async function updateTeamMemberRole(
  teamId: string,
  userId: string,
  role: Extract<TeamRole, 'admin' | 'member'>,
): Promise<ApiResult<{ member: TeamMemberRow }>> {
  return fetchApi<{ member: TeamMemberRow }>(`/api/teams/${teamId}/members/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  })
}

/** 移除成员(web PageClient.tsx:83 DELETE 同口径,路径参数是 userId)。 */
export async function removeTeamMember(
  teamId: string,
  userId: string,
): Promise<ApiResult<{ deleted: boolean }>> {
  return fetchApi<{ deleted: boolean }>(`/api/teams/${teamId}/members/${userId}`, {
    method: 'DELETE',
  })
}

/** 获取团队邀请列表(web PageClient.tsx:49 同口径)。 */
export async function getTeamInvitationsById(
  id: string,
): Promise<ApiResult<{ invitations: TeamInvitationRow[] }>> {
  return fetchApi<{ invitations: TeamInvitationRow[] }>(`/api/teams/${id}/invitations`)
}

/** 邀请成员(web PageClient.tsx:73 POST 同口径,body 为 { email })。 */
export async function inviteTeamMember(
  teamId: string,
  email: string,
): Promise<ApiResult<{ invitation: TeamInvitationRow }>> {
  return fetchApi<{ invitation: TeamInvitationRow }>(`/api/teams/${teamId}/invitations`, {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

/** 撤销邀请(web PageClient.tsx:95 DELETE 同口径)。 */
export async function cancelTeamInvitation(
  teamId: string,
  invitationId: string,
): Promise<ApiResult<{ deleted?: boolean }>> {
  return fetchApi<{ deleted?: boolean }>(`/api/teams/${teamId}/invitations/${invitationId}`, {
    method: 'DELETE',
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
