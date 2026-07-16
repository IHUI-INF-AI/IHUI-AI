/**
 * 会员管理 API
 * 对接后端 apps/api/src/routes/admin/member-users.ts / member-permissions.ts / admin.ts,
 * 覆盖会员用户、会员权限、管理员用户/项目/统计、旧项目 ai/users 模块�? */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'
import { buildQs, type PageData, type PageQuery } from '../utils.js'

// ===================== 类型定义 =====================

export interface MemberUser {
  id: string
  username?: string
  nickname: string
  phone?: string | null
  email?: string | null
  avatar?: string | null
  bio?: string | null
  gender?: number
  roleId?: number
  status: number
  level: number
  isVip?: boolean
  isSystemAdmin?: boolean
  createdAt: string
  updatedAt?: string
  [key: string]: unknown
}

export interface MemberPermission {
  id: string
  name: string
  displayName: string
  resource: string
  action: string
  description?: string | null
  createdAt: string
  updatedAt?: string
  [key: string]: unknown
}

export interface AdminProject {
  id: string
  userId: string
  name: string
  description?: string | null
  status: number
  createdAt: string
  updatedAt?: string
  owner?: {
    id: string
    nickname: string
    avatar?: string | null
  }
  [key: string]: unknown
}

export interface AdminStats {
  totalUsers: number
  totalProjects: number
  todayRevenue: number
  activeSessions: number
  totalUsersChange: number
  totalProjectsChange: number
  todayRevenueChange: number
  activeSessionsChange: number
  [key: string]: unknown
}

export interface AiUser {
  uuid?: string
  username?: string
  phone?: string
  email?: string
  [key: string]: unknown
}

// ===================== member/users（会员用户） =====================

export async function listMemberUsers(
  query: PageQuery & { status?: number; level?: number; includeDeleted?: boolean } = {},
): Promise<ApiResult<PageData<MemberUser>>> {
  return fetchApi<PageData<MemberUser>>(`/api/admin/member/users${buildQs(query)}`)
}

export async function getMemberUser(id: string): Promise<ApiResult<MemberUser>> {
  return fetchApi<MemberUser>(`/api/admin/member/users/${id}`)
}

export async function addMemberUser(body: {
  nickname: string
  phone?: string
  email?: string
  password: string
  roleId?: number
  status?: number
  level?: number
}): Promise<ApiResult<MemberUser>> {
  return fetchApi<MemberUser>('/api/admin/member/users', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateMemberUser(
  id: string,
  body: { status?: number; level?: number },
): Promise<ApiResult<MemberUser>> {
  return fetchApi<MemberUser>(`/api/admin/member/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function delMemberUser(id: string): Promise<ApiResult<{ user: MemberUser }>> {
  return fetchApi<{ user: MemberUser }>(`/api/admin/member/users/${id}`, { method: 'DELETE' })
}

// ===================== member/permissions（会员权限） =====================

export async function listMemberPermissions(
  query: PageQuery = {},
): Promise<ApiResult<PageData<MemberPermission>>> {
  return fetchApi<PageData<MemberPermission>>(`/api/admin/member/permissions${buildQs(query)}`)
}

export async function addMemberPermission(body: {
  name: string
  displayName: string
  resource: string
  action: string
  description?: string | null
}): Promise<ApiResult<MemberPermission>> {
  return fetchApi<MemberPermission>('/api/admin/member/permissions', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateMemberPermission(
  id: string,
  body: {
    name?: string
    displayName?: string
    resource?: string
    action?: string
    description?: string | null
  },
): Promise<ApiResult<MemberPermission>> {
  return fetchApi<MemberPermission>(`/api/admin/member/permissions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function delMemberPermission(
  id: string,
): Promise<ApiResult<{ id: string; deleted: boolean }>> {
  return fetchApi<{ id: string; deleted: boolean }>(`/api/admin/member/permissions/${id}`, {
    method: 'DELETE',
  })
}

// ===================== admin/stats（管理员统计�?=====================

export async function getAdminStats(): Promise<ApiResult<AdminStats>> {
  return fetchApi<AdminStats>('/api/admin/stats')
}

// ===================== admin/users（管理员用户管理�?=====================

export async function listAdminUsers(
  query: PageQuery & {
    search?: string
    role?: number
    status?: number
    includeDeleted?: boolean
  } = {},
): Promise<ApiResult<PageData<MemberUser>>> {
  return fetchApi<PageData<MemberUser>>(`/api/admin/users${buildQs(query)}`)
}

export async function getAdminUser(id: string): Promise<ApiResult<{ user: MemberUser }>> {
  return fetchApi<{ user: MemberUser }>(`/api/admin/users/${id}`)
}

export async function addAdminUser(body: {
  phone?: string
  email?: string
  password: string
  nickname: string
  roleId?: number
  status?: number
}): Promise<ApiResult<{ user: MemberUser }>> {
  return fetchApi<{ user: MemberUser }>('/api/admin/users', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateAdminUser(
  id: string,
  body: { role?: number; status?: number },
): Promise<ApiResult<{ user: MemberUser }>> {
  return fetchApi<{ user: MemberUser }>(`/api/admin/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function delAdminUser(id: string): Promise<ApiResult<{ user: MemberUser }>> {
  return fetchApi<{ user: MemberUser }>(`/api/admin/users/${id}`, { method: 'DELETE' })
}

// ===================== admin/projects（管理员项目管理�?=====================

export async function listAdminProjects(
  query: PageQuery = {},
): Promise<ApiResult<PageData<AdminProject>>> {
  return fetchApi<PageData<AdminProject>>(`/api/admin/projects${buildQs(query)}`)
}

export async function getAdminProject(id: string): Promise<ApiResult<{ project: AdminProject }>> {
  return fetchApi<{ project: AdminProject }>(`/api/admin/projects/${id}`)
}

export async function addAdminProject(body: {
  userId: string
  name: string
  description?: string | null
  status?: number
}): Promise<ApiResult<{ project: AdminProject }>> {
  return fetchApi<{ project: AdminProject }>('/api/admin/projects', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateAdminProject(
  id: string,
  body: { name?: string; description?: string | null; status?: number },
): Promise<ApiResult<{ project: AdminProject }>> {
  return fetchApi<{ project: AdminProject }>(`/api/admin/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function delAdminProject(
  id: string,
): Promise<ApiResult<{ id: string; deleted: boolean }>> {
  return fetchApi<{ id: string; deleted: boolean }>(`/api/admin/projects/${id}`, {
    method: 'DELETE',
  })
}

// ===================== ai/users（旧项目兼容�?=====================

export async function listAiUsers(query: PageQuery = {}): Promise<ApiResult<PageData<AiUser>>> {
  return fetchApi<PageData<AiUser>>(`/ai/users/list${buildQs(query)}`)
}

export async function getAiUser(uuid: string): Promise<ApiResult<AiUser>> {
  return fetchApi<AiUser>(`/ai/users/${uuid}`)
}

export async function addAiUser(body: Partial<AiUser>): Promise<ApiResult<AiUser>> {
  return fetchApi<AiUser>('/ai/users', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateAiUser(body: Partial<AiUser>): Promise<ApiResult<AiUser>> {
  return fetchApi<AiUser>('/ai/users', {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function delAiUser(uuid: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/ai/users/${uuid}`, { method: 'DELETE' })
}

export async function updateAiUserIdentity(body: {
  uuid: string
  identity?: string
  [key: string]: unknown
}): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>('/ai/users/set/user/identity', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function getCourseUser(query: PageQuery = {}): Promise<ApiResult<PageData<AiUser>>> {
  return fetchApi<PageData<AiUser>>(`/ai/users/platform/list${buildQs(query)}`)
}

export async function addAiUserSysLink(body: {
  userId: string
  sysUserId: string
  [key: string]: unknown
}): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>('/ai/userSysLink', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}
