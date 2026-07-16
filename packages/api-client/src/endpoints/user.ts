import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'
import { buildQs, type PageData, type PageQuery } from '../utils.js'

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

export async function getProfile(): Promise<ApiResult<UserProfile>> {
  return fetchApi<UserProfile>('/api/auth/me')
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

export async function replacePhone(input: {
  oldPhone: string
  newPhone: string
  code: string
}): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>('/api/users/change-phone', {
    method: 'POST',
    body: JSON.stringify(input),
  })
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
