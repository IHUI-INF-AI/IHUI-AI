import { get, del } from '../utils/request'
import type { PageData, PageQuery } from '@ihui/api-client'

// 向后兼容别名:PaginationQuery → PageQuery(api-client canonical 名)
export type PaginationQuery = PageQuery

// PaginatedList 扩展 PageData,但 page/pageSize 必填(消费端依赖必填字段)
export interface PaginatedList<T> extends PageData<T> {
  page: number
  pageSize: number
}

export interface FavoriteItem {
  id: string
  targetId: string
  targetType: string
  title: string
  cover?: string | null
  createdAt: string
}

export interface FollowingItem {
  id: string
  username: string
  nickname?: string | null
  avatar?: string | null
  bio?: string | null
  followedAt: string
}

export interface SubscriptionItem {
  id: string
  targetType: string
  targetId: string
  createdAt: string
}

export const getFavorites = (query?: PaginationQuery & { resourceType?: string }) =>
  get<PaginatedList<FavoriteItem>>('/favorites', query)

export const deleteFavorite = (resourceType: string, resourceId: string) =>
  del(`/favorites/${resourceType}/${resourceId}`)

export const getFollowing = (query?: PaginationQuery) =>
  get<PaginatedList<FollowingItem>>('/follows/following', query)

export const unfollowUser = (userId: string) => del(`/follows/${userId}`)

export const getSubscriptions = (query?: PaginationQuery & { targetType?: string }) =>
  get<PaginatedList<SubscriptionItem>>('/subscriptions', query)

export const cancelSubscription = (targetType: string, targetId: string) =>
  del(`/subscriptions/${targetType}/${targetId}`)
