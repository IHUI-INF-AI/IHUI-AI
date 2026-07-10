import type { ApiResult } from '@ihui/types'

import { fetchApi } from '@/lib/api'
import { buildQs, type PageData } from '@/lib/edu'

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

export interface NotificationItem {
  id: string
  type: string
  title: string
  content: string
  isRead: boolean
  createdAt: string
}

export interface MessageItem {
  id: string
  fromUserId: string
  fromNickname: string
  fromAvatar: string | null
  content: string
  isRead: boolean
  createdAt: string
}

export interface PageQuery {
  page?: number
  pageSize?: number
  [key: string]: string | number | undefined | null
}

export async function getProfile(): Promise<ApiResult<UserProfile>> {
  return fetchApi<UserProfile>('/auth/profile')
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
  return fetchApi<{ success: boolean }>('/login-pwd/edit-password', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function bindPhone(input: {
  phone: string
  code: string
}): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>('/login-pwd/replace-phone', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function replacePhone(input: {
  oldPhone: string
  newPhone: string
  code: string
}): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>('/login-pwd/replace-phone', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function getUserStatistics(): Promise<ApiResult<UserStatistics>> {
  return fetchApi<UserStatistics>('/user/statistics')
}

export async function getFavorites(
  query: PageQuery = {},
): Promise<ApiResult<PageData<FavoriteItem>>> {
  return fetchApi<PageData<FavoriteItem>>(`/favorites${buildQs(query)}`)
}

export async function getFollowing(
  query: PageQuery = {},
): Promise<ApiResult<PageData<FollowUser>>> {
  return fetchApi<PageData<FollowUser>>(`/user/following${buildQs(query)}`)
}

export async function getFans(query: PageQuery = {}): Promise<ApiResult<PageData<FollowUser>>> {
  return fetchApi<PageData<FollowUser>>(`/user/fans${buildQs(query)}`)
}

export async function getNotifications(
  query: PageQuery = {},
): Promise<ApiResult<PageData<NotificationItem>>> {
  return fetchApi<PageData<NotificationItem>>(`/notifications${buildQs(query)}`)
}

export async function getMessages(
  query: PageQuery = {},
): Promise<ApiResult<PageData<MessageItem>>> {
  return fetchApi<PageData<MessageItem>>(`/messages${buildQs(query)}`)
}
