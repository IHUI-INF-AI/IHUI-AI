import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client'
import { buildQs, type PageData, type PageQuery } from '../utils'
import type { AuthUser } from './auth'

export interface UserProfile {
  id: string
  username: string
  nickname: string
  avatar: string | null
  email: string | null
  phone: string | null
  bio: string | null
  gender: number | null
  birthday: string | null
  createdAt: string
  updatedAt: string
}

export interface UserStatistics {
  courseCount: number
  favoriteCount: number
  followingCount: number
  fansCount: number
  studyHours: number
  points: number
}

export interface FavoriteItem {
  id: string
  targetId: string
  targetType: string
  title: string
  cover: string | null
  createdAt: string
}

export interface FollowUser {
  id: string
  username: string
  nickname: string
  avatar: string | null
  bio: string | null
  followedAt: string
}

/**
 * 获取当前登录用户信息 — GET /api/auth/me
 * 后端返回 `{ user: AuthUser }`,此处解构返回 AuthUser 本体,便于调用方直接使用。
 * 与 auth.ts 的 getMe() 区别:getMe() 返回 `{ user: AuthUser }` 原始结构,getProfile() 返回 `AuthUser`。
 */
export async function getProfile(): Promise<ApiResult<AuthUser>> {
  const res = await fetchApi<{ user: AuthUser }>('/api/auth/me')
  if (!res.success) return res
  return { success: true, data: res.data.user }
}

export async function updateProfile(
  input: Partial<Pick<UserProfile, 'nickname' | 'avatar' | 'bio' | 'gender' | 'birthday'>>,
): Promise<ApiResult<UserProfile>> {
  return fetchApi<UserProfile>('/auth/profile', {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function updatePassword(input: {
  oldPassword: string
  newPassword: string
}): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>('/api/auth/profile/password', {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function bindPhone(input: {
  phone: string
  code: string
}): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>('/api/users/change-phone', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/**
 * 更换手机号(2026-08-01 重构:需旧+新手机号双验证码,新号有账号则自动合并)
 *
 * 后端契约:POST /api/users/change-phone
 *   body: { oldPhone, oldCode, newPhone, newCode }
 *   - 校验旧手机号验证码 + 新手机号验证码
 *   - 新手机号已被其他账号绑定时,自动合并账号(以老账号信息为准)
 */
export async function replacePhone(input: {
  oldPhone: string
  oldCode: string
  newPhone: string
  newCode: string
}): Promise<ApiResult<{ success: boolean; user: { id: string; phone: string } }>> {
  return fetchApi<{ success: boolean; user: { id: string; phone: string } }>(
    '/api/users/change-phone',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  )
}

export async function getUserStatistics(): Promise<ApiResult<UserStatistics>> {
  return fetchApi<UserStatistics>('/api/statistics/user-center')
}

export async function getFavorites(
  query: PageQuery = {},
): Promise<ApiResult<PageData<FavoriteItem>>> {
  return fetchApi<PageData<FavoriteItem>>(`/favorites${buildQs(query)}`)
}

export async function getFollowing(
  query: PageQuery = {},
): Promise<ApiResult<PageData<FollowUser>>> {
  return fetchApi<PageData<FollowUser>>(`/api/follows/following${buildQs(query)}`)
}

export async function getFans(query: PageQuery = {}): Promise<ApiResult<PageData<FollowUser>>> {
  return fetchApi<PageData<FollowUser>>(`/api/follows/followers${buildQs(query)}`)
}
