/**
 * OAuth 用户授权确认 API (Round 27-B 新增)
 * 后端约定: /api/v1/agents/oauth-apps/* (与 oauth_apps.py 对接)
 *
 * 用途: 用户视角的 OAuth2 授权确认页面 (Authorize.vue) 调用.
 * 与 admin-oauth-apps.ts 区别:
 * - admin-oauth-apps.ts: 管理员视角 (创建/删除/重置密钥)
 * - oauth-authorize.ts: 用户视角 (查看应用信息 + 授权确认)
 *
 * 流程:
 * 1. 第三方应用跳转本站 /oauth/authorize?client_id=xxx&redirect_uri=yyy&state=zzz&scope=read:profile
 * 2. Authorize.vue 调用 getOAuthAppForAuthorize(client_id) 获取应用信息 (名称/scope 白名单)
 * 3. 用户查看权限范围, 点击"授权" → call submitOAuthAuthorize(params) 获取 code
 * 4. 前端用 window.location 跳转 redirect_uri?code=xxx&state=yyy
 * 5. 用户点击"拒绝" → 前端直接跳转 redirect_uri?error=access_denied&state=yyy
 */
import request from '@/utils/request'
import type { ApiResponse } from '@/types'
import { normalizeApiResponse } from '@/utils/api-response'

/** OAuth 应用公开信息 (用户视角, 不含 client_secret) */
export interface OAuthAppPublic {
  id: number
  client_id: string
  name: string
  redirect_uri: string | null
  redirect_uris: string[]
  scopes: string[]
  is_active: number
  /** Round 29-A: 应用图标 URL (可空) */
  icon: string | null
}

/** 提交授权确认的参数 (与后端 /oauth-apps/authorize query 参数对齐) */
export interface OAuthAuthorizeParams {
  client_id: string
  redirect_uri: string
  state: string
  response_type?: string // 默认 code
  code_challenge?: string // PKCE
  code_challenge_method?: string // S256
  scope?: string // 空格分隔字符串
}

/** 授权确认返回 (含一次性 code) */
export interface OAuthAuthorizeResult {
  code: string
  state: string
  expires_in: number
  scope?: string
}

/**
 * 获取 OAuth 应用公开信息 (用户视角).
 * 后端: GET /api/v1/agents/oauth-apps/{client_id} (require_login, 不返回 client_secret)
 */
export async function getOAuthAppForAuthorize(
  clientId: string
): Promise<ApiResponse<OAuthAppPublic>> {
  try {
    const response = await request.get<OAuthAppPublic>(
      `/api/v1/agents/oauth-apps/${clientId}`
    )
    return normalizeApiResponse(response)
  } catch (e) {
    return {
      code: 500,
      message: (e as Error)?.message || '获取应用信息失败',
      data: {} as OAuthAppPublic,
      success: false,
      timestamp: Date.now(),
    }
  }
}

/**
 * 提交授权确认 (用户同意授权).
 * 后端: GET /api/v1/agents/oauth-apps/authorize (require_login)
 * 返回一次性 code, 前端据此跳转 redirect_uri?code=xxx&state=yyy
 */
export async function submitOAuthAuthorize(
  params: OAuthAuthorizeParams
): Promise<ApiResponse<OAuthAuthorizeResult>> {
  try {
    const response = await request.get<OAuthAuthorizeResult>(
      '/api/v1/agents/oauth-apps/authorize',
      { params }
    )
    return normalizeApiResponse(response)
  } catch (e) {
    return {
      code: 500,
      message: (e as Error)?.message || '授权确认失败',
      data: {} as OAuthAuthorizeResult,
      success: false,
      timestamp: Date.now(),
    }
  }
}
