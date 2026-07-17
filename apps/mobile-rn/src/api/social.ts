import { fetchApi, buildQs, type PageData, type PageQuery } from '@ihui/api-client'

export interface SubscriptionItem {
  id: string
  targetType: string
  targetId: string
  createdAt: string
}

export async function getSubscriptions(query: PageQuery = {}) {
  return fetchApi<PageData<SubscriptionItem>>(`/subscriptions${buildQs(query)}`)
}

export async function deleteFavorite(resourceType: string, resourceId: string) {
  return fetchApi<{ favorited: false }>(`/favorites/${resourceType}/${resourceId}`, {
    method: 'DELETE',
  })
}

export async function unfollowUser(userId: string) {
  return fetchApi<{ followed: false }>(`/follows/${userId}`, {
    method: 'DELETE',
  })
}

export async function cancelSubscription(targetType: string, targetId: string) {
  return fetchApi<{ subscribed: false }>(`/subscriptions/${targetType}/${targetId}`, {
    method: 'DELETE',
  })
}
