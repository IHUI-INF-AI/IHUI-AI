/**
 * 管理后台 - OAuth 应用管理 API (Round 25 新增)
 * 后端约定: /api/v1/agents/oauth-apps/* (与 oauth_apps.py 对接)
 *
 * 注意: OAuth 应用与 Coze 前端 OAuthApps.vue 是独立系统, 本 API 仅用于 admin 后台管理.
 */
import request from '@/utils/request'
import type { ApiResponse } from '@/types'
import { normalizeApiResponse } from '@/utils/api-response'

/** OAuth 应用 (admin 视角, client_secret 仅创建/重置时返回) */
export interface AdminOAuthApp {
  id: number
  client_id: string
  name: string
  redirect_uri: string | null
  redirect_uris: string[]
  scopes: string[]
  is_active: number
  /** Round 29-A: 应用图标 URL (可空, admin 上传后保存) */
  icon: string | null
  /** Round 31-B: 创建者 user_uuid (可空, 历史应用无 owner) */
  owner_uuid: string | null
  created_at?: string
  updated_at?: string
}

/** 创建 OAuth 应用参数 */
export interface AdminOAuthAppCreateParams {
  name: string
  redirect_uri?: string
  redirect_uris?: string[]
  scopes?: string[]
  /** Round 29-A: 应用图标 URL (可选, admin 上传后保存) */
  icon?: string
}

/** 创建/重置密钥返回 (含 client_secret, 仅此一次) */
export interface AdminOAuthAppWithSecret extends AdminOAuthApp {
  client_secret: string
  warning: string
}

/** OAuth 应用列表参数 */
export interface AdminOAuthAppListParams {
  is_active?: number
  /** Round 31-B: 是否查全部应用 (1=查全部, 0/undefined=仅自己的) */
  include_all?: number
}

/** 获取 OAuth 应用列表 */
export async function getAdminOAuthApps(
  params?: AdminOAuthAppListParams
): Promise<ApiResponse<AdminOAuthApp[]>> {
  try {
    const response = await request.get<AdminOAuthApp[]>(
      '/api/v1/agents/oauth-apps/list',
      { params }
    )
    return normalizeApiResponse(response)
  } catch (e) {
    return {
      code: 500,
      message: (e as Error)?.message || '请求失败',
      data: [],
      success: false,
      timestamp: Date.now(),
    }
  }
}

/** 获取 OAuth 应用详情 */
export async function getAdminOAuthAppDetail(
  clientId: string
): Promise<ApiResponse<AdminOAuthApp>> {
  try {
    const response = await request.get<AdminOAuthApp>(
      `/api/v1/agents/oauth-apps/${clientId}`
    )
    return normalizeApiResponse(response)
  } catch (e) {
    return {
      code: 500,
      message: (e as Error)?.message || '请求失败',
      data: {} as AdminOAuthApp,
      success: false,
      timestamp: Date.now(),
    }
  }
}

/** 创建 OAuth 应用 (返回 client_secret, 仅此一次) */
export async function createAdminOAuthApp(
  data: AdminOAuthAppCreateParams
): Promise<ApiResponse<AdminOAuthAppWithSecret>> {
  try {
    const response = await request.post<AdminOAuthAppWithSecret>(
      '/api/v1/agents/oauth-apps/create',
      data
    )
    return normalizeApiResponse(response)
  } catch (e) {
    return {
      code: 500,
      message: (e as Error)?.message || '创建失败',
      data: {} as AdminOAuthAppWithSecret,
      success: false,
      timestamp: Date.now(),
    }
  }
}

/** 删除 OAuth 应用 (软删除, 置 is_active=0) */
export async function deleteAdminOAuthApp(
  clientId: string
): Promise<ApiResponse<{ client_id: string; is_active: number; message: string }>> {
  try {
    const response = await request.delete<{
      client_id: string
      is_active: number
      message: string
    }>(`/api/v1/agents/oauth-apps/${clientId}`)
    return normalizeApiResponse(response)
  } catch (e) {
    return {
      code: 500,
      message: (e as Error)?.message || '删除失败',
      data: { client_id: clientId, is_active: 0, message: 'failed' },
      success: false,
      timestamp: Date.now(),
    }
  }
}

/** 重置 OAuth 应用密钥 (旧 secret 立即失效, 新 secret 仅此一次返回) */
export async function resetAdminOAuthAppSecret(
  clientId: string
): Promise<ApiResponse<AdminOAuthAppWithSecret>> {
  try {
    const response = await request.post<AdminOAuthAppWithSecret>(
      `/api/v1/agents/oauth-apps/${clientId}/reset-secret`
    )
    return normalizeApiResponse(response)
  } catch (e) {
    return {
      code: 500,
      message: (e as Error)?.message || '重置密钥失败',
      data: {} as AdminOAuthAppWithSecret,
      success: false,
      timestamp: Date.now(),
    }
  }
}
