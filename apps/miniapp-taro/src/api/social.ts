import { get, del } from '../utils/request'

export interface PaginationQuery {
  page?: number
  pageSize?: number
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

export interface PaginatedList<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
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
