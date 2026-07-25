import { get, del } from './index'
import type { PageData, PageQuery, FavoriteItem, SubscriptionItem } from '@ihui/api-client'

// 向后兼容别名:PaginationQuery → PageQuery(api-client canonical 名)
export type PaginationQuery = PageQuery

// PaginatedList 扩展 PageData,但 page/pageSize 必填(消费端依赖必填字段)
export interface PaginatedList<T> extends PageData<T> {
  page: number
  pageSize: number
}

// FavoriteItem / SubscriptionItem 复用 @ihui/api-client(单一来源),本地 re-export 保持外部引用不变
export type { FavoriteItem, SubscriptionItem }

// FollowingItem 保留本地实现:与 @ihui/api-client FollowUser 字段不一致
// (nickname/avatar/bio 在本地为可选,api-client 为必填),不可直接替换
export interface FollowingItem {
  id: string
  username: string
  nickname?: string | null
  avatar?: string | null
  bio?: string | null
  followedAt: string
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
