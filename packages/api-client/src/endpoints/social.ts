import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client'
import { buildQs, type PageData, type PageQuery } from '../utils'

/** 订阅项(收藏/关注/订阅列表通用) */
export interface SubscriptionItem {
  id: string
  targetType: string
  targetId: string
  createdAt: string
}

/** 获取订阅列表 — GET /subscriptions */
export async function getSubscriptions(
  query: PageQuery = {},
): Promise<ApiResult<PageData<SubscriptionItem>>> {
  return fetchApi<PageData<SubscriptionItem>>(`/subscriptions${buildQs(query)}`)
}

/** 取消收藏 — DELETE /favorites/:resourceType/:resourceId */
export async function deleteFavorite(
  resourceType: string,
  resourceId: string,
): Promise<ApiResult<{ favorited: false }>> {
  return fetchApi<{ favorited: false }>(`/favorites/${resourceType}/${resourceId}`, {
    method: 'DELETE',
  })
}

/** 取消关注 — DELETE /follows/:userId */
export async function unfollowUser(
  userId: string,
): Promise<ApiResult<{ followed: false }>> {
  return fetchApi<{ followed: false }>(`/follows/${userId}`, {
    method: 'DELETE',
  })
}

/** 取消订阅 — DELETE /subscriptions/:targetType/:targetId */
export async function cancelSubscription(
  targetType: string,
  targetId: string,
): Promise<ApiResult<{ subscribed: false }>> {
  return fetchApi<{ subscribed: false }>(`/subscriptions/${targetType}/${targetId}`, {
    method: 'DELETE',
  })
}
