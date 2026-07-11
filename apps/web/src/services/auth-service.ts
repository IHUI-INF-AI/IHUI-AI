/**
 * 认证服务（合并版）
 *
 * 合并自旧架构：
 * - services/auth-flow.service.ts
 * - services/unifiedAuthService.ts
 *
 * 新架构基于 fetchApi 与 zustand auth store，无 Vue 依赖。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'

/* ------------------------------------------------------------------ */
/* 类型定义                                                            */
/* ------------------------------------------------------------------ */

export type AuthMethod = 'password' | 'sms' | 'email' | 'oauth' | 'qrcode'

export interface LoginInput {
  method: AuthMethod
  account: string
  password?: string
  code?: string
  captchaId?: string
  captchaCode?: string
  rememberMe?: boolean
  redirect?: string
}

export interface LoginResult {
  token: string
  refreshToken?: string
  expiresIn: number
  user: {
    id: string
    nickname: string
    avatar: string | null
    phone: string | null
    email: string | null
    roleId: number
    role: string
  }
}

export interface RegisterInput {
  account: string
  password: string
  code: string
  captchaId?: string
  captchaCode?: string
  inviteCode?: string
}

export interface TwoFactorSetup {
  secret: string
  qrCodeUrl: string
  backupCodes: string[]
}

export interface TwoFactorVerify {
  enabled: boolean
  verified: boolean
}

export interface OAuthBinding {
  provider: 'wechat' | 'alipay' | 'github' | 'google' | 'qq'
  openId: string
  nickname: string
  avatar: string | null
  boundAt: string
}

export interface PasswordResetInput {
  account: string
  code: string
  newPassword: string
}

/* ------------------------------------------------------------------ */
/* 登录 / 注册 / 登出                                                  */
/* ------------------------------------------------------------------ */

export async function login(input: LoginInput): Promise<ApiResult<LoginResult>> {
  const r = await fetchApi<LoginResult>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  if (r.success) {
    const { token, user } = r.data
    useAuthStore.getState().setToken(token)
    useAuthStore.getState().setUser({
      id: user.id,
      nickname: user.nickname,
      avatar: user.avatar ?? undefined,
      phone: user.phone ?? undefined,
      roleId: user.roleId,
      role: user.role,
    })
  }
  return r
}

export async function register(input: RegisterInput): Promise<ApiResult<LoginResult>> {
  const r = await fetchApi<LoginResult>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  if (r.success) {
    const { token, user } = r.data
    useAuthStore.getState().setToken(token)
    useAuthStore.getState().setUser({
      id: user.id,
      nickname: user.nickname,
      avatar: user.avatar ?? undefined,
      phone: user.phone ?? undefined,
      roleId: user.roleId,
      role: user.role,
    })
  }
  return r
}

export async function logout(): Promise<ApiResult<{ success: boolean }>> {
  const r = await fetchApi<{ success: boolean }>('/auth/logout', {
    method: 'POST',
  })
  // 无论后端是否成功，前端都清理本地状态
  useAuthStore.getState().logout()
  return r
}

/* ------------------------------------------------------------------ */
/* 验证码                                                              */
/* ------------------------------------------------------------------ */

export async function sendSmsCode(
  phone: string,
  scene: 'login' | 'register' | 'reset' | 'bind',
): Promise<ApiResult<{ sent: boolean; expireIn: number }>> {
  return fetchApi<{ sent: boolean; expireIn: number }>('/auth/sms-code', {
    method: 'POST',
    body: JSON.stringify({ phone, scene }),
  })
}

export async function sendEmailCode(
  email: string,
  scene: 'register' | 'reset' | 'bind',
): Promise<ApiResult<{ sent: boolean; expireIn: number }>> {
  return fetchApi<{ sent: boolean; expireIn: number }>('/auth/email-code', {
    method: 'POST',
    body: JSON.stringify({ email, scene }),
  })
}

export async function getCaptcha(): Promise<ApiResult<{ captchaId: string; image: string }>> {
  return fetchApi<{ captchaId: string; image: string }>('/auth/captcha')
}

/* ------------------------------------------------------------------ */
/* Token 刷新                                                          */
/* ------------------------------------------------------------------ */

export async function refreshToken(
  refreshToken: string,
): Promise<ApiResult<{ token: string; expiresIn: number }>> {
  const r = await fetchApi<{ token: string; expiresIn: number }>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  })
  if (r.success) {
    useAuthStore.getState().setToken(r.data.token)
  }
  return r
}

/* ------------------------------------------------------------------ */
/* 双因素认证（2FA）                                                   */
/* ------------------------------------------------------------------ */

export async function setup2FA(): Promise<ApiResult<TwoFactorSetup>> {
  return fetchApi<TwoFactorSetup>('/auth/2fa/setup', { method: 'POST' })
}

export async function verify2FA(code: string): Promise<ApiResult<TwoFactorVerify>> {
  return fetchApi<TwoFactorVerify>('/auth/2fa/verify', {
    method: 'POST',
    body: JSON.stringify({ code }),
  })
}

export async function disable2FA(code: string): Promise<ApiResult<{ disabled: boolean }>> {
  return fetchApi<{ disabled: boolean }>('/auth/2fa/disable', {
    method: 'POST',
    body: JSON.stringify({ code }),
  })
}

/* ------------------------------------------------------------------ */
/* 第三方 OAuth                                                        */
/* ------------------------------------------------------------------ */

export function getOAuthAuthorizeUrl(
  provider: OAuthBinding['provider'],
  redirectUri: string,
): string {
  const base = '/auth/oauth'
  const params = new URLSearchParams({
    provider,
    redirect_uri: redirectUri,
  })
  return `${base}?${params.toString()}`
}

export async function oauthCallback(
  provider: OAuthBinding['provider'],
  code: string,
  state: string,
): Promise<ApiResult<LoginResult>> {
  const r = await fetchApi<LoginResult>('/auth/oauth/callback', {
    method: 'POST',
    body: JSON.stringify({ provider, code, state }),
  })
  if (r.success) {
    const { token, user } = r.data
    useAuthStore.getState().setToken(token)
    useAuthStore.getState().setUser({
      id: user.id,
      nickname: user.nickname,
      avatar: user.avatar ?? undefined,
      phone: user.phone ?? undefined,
      roleId: user.roleId,
      role: user.role,
    })
  }
  return r
}

export async function listOAuthBindings(): Promise<ApiResult<OAuthBinding[]>> {
  return fetchApi<OAuthBinding[]>('/auth/oauth-bindings')
}

export async function unbindOAuth(
  provider: OAuthBinding['provider'],
): Promise<ApiResult<{ unbound: boolean }>> {
  return fetchApi<{ unbound: boolean }>(`/auth/oauth-bindings/${encodeURIComponent(provider)}`, {
    method: 'DELETE',
  })
}

/* ------------------------------------------------------------------ */
/* 密码重置 / 修改                                                     */
/* ------------------------------------------------------------------ */

export async function resetPassword(
  input: PasswordResetInput,
): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function changePassword(
  oldPassword: string,
  newPassword: string,
): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ oldPassword, newPassword }),
  })
}

/* ------------------------------------------------------------------ */
/* 当前用户信息                                                        */
/* ------------------------------------------------------------------ */

export async function getCurrentUser(): Promise<ApiResult<LoginResult['user']>> {
  return fetchApi<LoginResult['user']>('/auth/me')
}

export function isAuthenticated(): boolean {
  return useAuthStore.getState().isAuthenticated
}

export function getCurrentUserId(): string | null {
  return useAuthStore.getState().user?.id ?? null
}
