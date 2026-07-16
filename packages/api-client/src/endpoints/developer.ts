/**
 * 开发者相�?API
 * 合并迁移自旧架构：developer, sdks, packages, webhooks, oauth-apps
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'
import { buildQs, type PageData } from '../utils.js'

// ===================== 类型定义 =====================

export interface PageQuery {
  page?: number
  pageSize?: number
  [key: string]: string | number | undefined | null
}

/** 开发者信�?*/
export interface DeveloperInfo {
  id: string
  userId: string
  name: string
  email?: string
  avatar?: string
  status: 'pending' | 'approved' | 'rejected' | 'suspended'
  level?: number
  permissions?: string[]
  price?: number
  createdAt: string
  updatedAt?: string
  [key: string]: unknown
}

/** SDK 信息 */
export interface SdkInfo {
  id: string
  name: string
  version: string
  platform: 'web' | 'android' | 'ios' | 'nodejs' | 'python' | 'go' | 'java'
  description?: string
  downloadUrl?: string
  docsUrl?: string
  status?: number
  releaseNotes?: string
  createdAt: string
  [key: string]: unknown
}

/** 套餐 */
export interface PackageInfo {
  id: string
  name: string
  description?: string
  type: 'free' | 'basic' | 'pro' | 'enterprise'
  price: number
  period?: 'month' | 'quarter' | 'year'
  callsLimit?: number
  qpsLimit?: number
  features?: string[]
  status?: number
  [key: string]: unknown
}

/** Webhook */
export interface Webhook {
  id: string
  url: string
  events: string[]
  secret?: string
  status?: 'active' | 'disabled'
  description?: string
  lastTriggeredAt?: string
  lastResponseStatus?: number
  createdAt: string
  [key: string]: unknown
}

/** Webhook 投递记�?*/
export interface WebhookDelivery {
  id: string
  webhookId: string
  event: string
  payload?: unknown
  responseStatus?: number
  responseBody?: string
  duration?: number
  status: 'success' | 'failed' | 'pending'
  createdAt: string
  [key: string]: unknown
}

/** OAuth 应用 */
export interface OauthApp {
  id: string
  clientId: string
  clientSecret?: string
  name: string
  description?: string
  logo?: string
  redirectUris: string[]
  homepageUrl?: string
  scopes?: string[]
  status?: 'active' | 'disabled' | 'pending'
  type?: 'web' | 'native' | 'spa' | 'service'
  createdAt: string
  [key: string]: unknown
}

/** OAuth 授权记录 */
export interface OauthAuthorization {
  id: string
  clientId: string
  clientName?: string
  userId: string
  scopes: string[]
  grantedAt: string
  expiresAt?: string
  [key: string]: unknown
}

// ===================== developer（开发者） =====================

/** 获取当前开发者信�?*/
export async function getDeveloperInfo(): Promise<ApiResult<DeveloperInfo>> {
  return fetchApi<DeveloperInfo>('/api/developer/info')
}

/** 获取开发者价格信�?*/
export async function getDeveloperPrice(): Promise<
  ApiResult<{ price: number; [key: string]: unknown }>
> {
  return fetchApi<{ price: number; [key: string]: unknown }>('/api/developer/price')
}

/** 申请成为开发�?*/
export async function applyDeveloper(input: {
  name: string
  email?: string
  description?: string
}): Promise<ApiResult<DeveloperInfo>> {
  return fetchApi<DeveloperInfo>('/api/developer/apply', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 更新开发者信�?*/
export async function updateDeveloperInfo(
  input: Partial<DeveloperInfo>,
): Promise<ApiResult<DeveloperInfo>> {
  return fetchApi<DeveloperInfo>('/api/developer/info', {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

/** 获取开发者列表（管理员） */
export async function getDevelopers(
  query: PageQuery & { status?: DeveloperInfo['status'] } = {},
): Promise<ApiResult<PageData<DeveloperInfo>>> {
  return fetchApi<PageData<DeveloperInfo>>(`/api/developer${buildQs(query)}`)
}

/** 审核开发者（管理员） */
export async function auditDeveloper(
  id: string,
  input: { action: 'approve' | 'reject' | 'suspend'; reason?: string },
): Promise<ApiResult<DeveloperInfo>> {
  return fetchApi<DeveloperInfo>(`/api/developer/${id}/audit`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

// ===================== sdks（SDK�?=====================

/** 获取 SDK 列表 */
export async function getSdkList(
  query: PageQuery & { platform?: SdkInfo['platform'] } = {},
): Promise<ApiResult<PageData<SdkInfo>>> {
  return fetchApi<PageData<SdkInfo>>(`/api/sdks${buildQs(query)}`)
}

/** 获取 SDK 详情 */
export async function getSdkDetail(id: string): Promise<ApiResult<SdkInfo>> {
  return fetchApi<SdkInfo>(`/api/sdks/${id}`)
}

/** 获取 SDK 最新版�?*/
export async function getLatestSdk(platform: SdkInfo['platform']): Promise<ApiResult<SdkInfo>> {
  return fetchApi<SdkInfo>(`/api/sdks/latest${buildQs({ platform })}`)
}

/** 创建 SDK */
export async function createSdk(input: Partial<SdkInfo>): Promise<ApiResult<SdkInfo>> {
  return fetchApi<SdkInfo>('/api/sdks', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 更新 SDK */
export async function updateSdk(id: string, input: Partial<SdkInfo>): Promise<ApiResult<SdkInfo>> {
  return fetchApi<SdkInfo>(`/api/sdks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

/** 删除 SDK */
export async function deleteSdk(id: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/sdks/${id}`, { method: 'DELETE' })
}

// ===================== packages（套餐） =====================

/** 获取套餐列表 */
export async function getPackages(
  query: { type?: PackageInfo['type'] } = {},
): Promise<ApiResult<PackageInfo[]>> {
  return fetchApi<PackageInfo[]>(`/api/packages${buildQs(query)}`)
}

/** 获取套餐详情 */
export async function getPackageDetail(id: string): Promise<ApiResult<PackageInfo>> {
  return fetchApi<PackageInfo>(`/api/packages/${id}`)
}

/** 创建套餐 */
export async function createPackage(input: Partial<PackageInfo>): Promise<ApiResult<PackageInfo>> {
  return fetchApi<PackageInfo>('/api/packages', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 更新套餐 */
export async function updatePackage(
  id: string,
  input: Partial<PackageInfo>,
): Promise<ApiResult<PackageInfo>> {
  return fetchApi<PackageInfo>(`/api/packages/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

/** 删除套餐 */
export async function deletePackage(id: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/packages/${id}`, { method: 'DELETE' })
}

// ===================== webhooks =====================

/** 获取 Webhook 列表 */
export async function getWebhooks(query: PageQuery = {}): Promise<ApiResult<PageData<Webhook>>> {
  return fetchApi<PageData<Webhook>>(`/api/developer/webhooks${buildQs(query)}`)
}

/** 获取 Webhook 详情 */
export async function getWebhookDetail(id: string): Promise<ApiResult<Webhook>> {
  return fetchApi<Webhook>(`/api/developer/webhooks/${id}`)
}

/** 创建 Webhook */
export async function createWebhook(input: {
  url: string
  events: string[]
  description?: string
}): Promise<ApiResult<Webhook>> {
  return fetchApi<Webhook>('/api/developer/webhooks', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 更新 Webhook */
export async function updateWebhook(
  id: string,
  input: Partial<Webhook>,
): Promise<ApiResult<Webhook>> {
  return fetchApi<Webhook>(`/api/developer/webhooks/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

/** 删除 Webhook */
export async function deleteWebhook(id: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/developer/webhooks/${id}`, { method: 'DELETE' })
}

/** 测试 Webhook */
export async function testWebhook(
  id: string,
): Promise<ApiResult<{ success: boolean; response?: string }>> {
  return fetchApi<{ success: boolean; response?: string }>(`/api/developer/webhooks/${id}/test`, {
    method: 'POST',
  })
}

/** 获取 Webhook 投递记�?*/
export async function getWebhookDeliveries(
  id: string,
  query: PageQuery = {},
): Promise<ApiResult<PageData<WebhookDelivery>>> {
  return fetchApi<PageData<WebhookDelivery>>(`/api/developer/webhooks/${id}/logs${buildQs(query)}`)
}

/** 重投 Webhook */
export async function redeliverWebhook(
  webhookId: string,
  deliveryId: string,
): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/developer/webhooks/${webhookId}/retry`, {
    method: 'POST',
    body: JSON.stringify({ deliveryId }),
  })
}

// ===================== oauth-apps =====================

/** 获取 OAuth 应用列表 */
export async function getOauthApps(query: PageQuery = {}): Promise<ApiResult<PageData<OauthApp>>> {
  return fetchApi<PageData<OauthApp>>(`/api/oauth-apps${buildQs(query)}`)
}

/** 获取 OAuth 应用详情 */
export async function getOauthAppDetail(id: string): Promise<ApiResult<OauthApp>> {
  return fetchApi<OauthApp>(`/api/oauth-apps/${id}`)
}

/** 创建 OAuth 应用 */
export async function createOauthApp(input: {
  name: string
  description?: string
  logo?: string
  redirectUris: string[]
  homepageUrl?: string
  scopes?: string[]
  type?: OauthApp['type']
}): Promise<ApiResult<OauthApp>> {
  return fetchApi<OauthApp>('/api/oauth-apps', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 更新 OAuth 应用 */
export async function updateOauthApp(
  id: string,
  input: Partial<OauthApp>,
): Promise<ApiResult<OauthApp>> {
  return fetchApi<OauthApp>(`/api/oauth-apps/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

/** 删除 OAuth 应用 */
export async function deleteOauthApp(id: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/oauth-apps/${id}`, { method: 'DELETE' })
}

/** 重新生成 Client Secret */
export async function regenerateOauthSecret(
  id: string,
): Promise<ApiResult<{ clientSecret: string }>> {
  return fetchApi<{ clientSecret: string }>(`/api/oauth-apps/${id}/regenerate-secret`, {
    method: 'POST',
  })
}

/** 获取我授权的应用列表 */
export async function getMyAuthorizedApps(
  query: PageQuery = {},
): Promise<ApiResult<PageData<OauthAuthorization>>> {
  return fetchApi<PageData<OauthAuthorization>>(`/api/oauth-apps/my-authorized${buildQs(query)}`)
}

/** 撤销授权 */
export async function revokeAuthorization(id: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/oauth-apps/authorizations/${id}`, {
    method: 'DELETE',
  })
}
