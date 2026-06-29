/**
 * 用户视角 - 已授权应用管理 API (Round 29-B 新增)
 * 后端约定: /api/v1/agents/oauth-apps/my-authorized (与 oauth_apps.py 对接)
 *
 * 用途: 用户在用户中心查看自己已授权的 OAuth 应用列表, 可撤销授权.
 * 与 oauth-authorize.ts 区别:
 * - oauth-authorize.ts: 单次授权确认 (签发 code)
 * - oauth-my-authorized.ts: 授权后管理 (列表 + 撤销)
 *
 * 撤销授权后:
 * - 该 session 记录被删除 (用户重新授权会生成新 session)
 * - 已签发的 access_token 在 TTL (1h) 内仍可用, 但用户无法再撤销前已签发的 token
 * - 后端记录 authorize_deny 审计日志
 */
import request from '@/utils/request'
import type { ApiResponse } from '@/types'
import { normalizeApiResponse } from '@/utils/api-response'

/** 已授权应用条目 (用户视角, 关联 OAuthApp 信息) */
export interface MyAuthorizedApp {
  /** OAuthSession.id */
  session_id: number
  /** 一次性授权码 (已使用后失效, 仅展示用) */
  code: string
  /** 关联 OAuthApp 的 client_id */
  client_id: string
  /** 关联 OAuthApp 的名称 */
  app_name: string
  /** 关联 OAuthApp 的图标 URL (可空) */
  app_icon: string | null
  /** 关联 OAuthApp 是否仍活跃 (0=已禁用, 1=活跃) */
  app_active: number
  /** 授权的 scope (空格分隔字符串) */
  scope: string
  /** CSRF state token (展示用) */
  state: string | null
  /** 授权码是否已使用 (1=已换 token, 0=未换) */
  is_used: number
  /** 授权码过期时间 (ISO 字符串) */
  expires_at: string | null
  /** 授权时间 (ISO 字符串) */
  created_at: string | null
}

/** 撤销授权返回 */
export interface RevokeAuthorizedResult {
  session_id: number
  message: string
}

/**
 * 获取当前用户已授权应用列表.
 * 后端: GET /api/v1/agents/oauth-apps/my-authorized (require_login)
 */
export async function getMyAuthorizedApps(): Promise<ApiResponse<MyAuthorizedApp[]>> {
  try {
    const response = await request.get<MyAuthorizedApp[]>(
      '/api/v1/agents/oauth-apps/my-authorized'
    )
    return normalizeApiResponse(response)
  } catch (e) {
    return {
      code: 500,
      message: (e as Error)?.message || '获取已授权应用失败',
      data: [],
      success: false,
      timestamp: Date.now(),
    }
  }
}

/**
 * 撤销指定授权 (删除 OAuthSession).
 * 后端: DELETE /api/v1/agents/oauth-apps/my-authorized/{session_id} (require_login)
 * 撤销后该 session 关联的 code 已失效, 但已签发的 access_token 在 TTL 内仍可用.
 */
export async function revokeMyAuthorizedApp(
  sessionId: number
): Promise<ApiResponse<RevokeAuthorizedResult>> {
  try {
    const response = await request.delete<RevokeAuthorizedResult>(
      `/api/v1/agents/oauth-apps/my-authorized/${sessionId}`
    )
    return normalizeApiResponse(response)
  } catch (e) {
    return {
      code: 500,
      message: (e as Error)?.message || '撤销授权失败',
      data: { session_id: sessionId, message: 'failed' },
      success: false,
      timestamp: Date.now(),
    }
  }
}
