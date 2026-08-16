import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client'

// =============================================================================
// 认证核心类型
// =============================================================================

export interface AuthUser {
  id: string
  phone?: string
  email?: string
  username?: string
  nickname?: string
  avatar?: string
  bio?: string
  gender?: number
  birthday?: string
  familyId?: string
  roleId?: number
  status?: number
  isVip?: number
  level?: number
  inviteCode?: string
  parentId?: string
  createdAt?: string
  updatedAt?: string
  permissions?: string[]
}

export interface LoginResult {
  accessToken: string
  refreshToken: string
  expiresIn: number
  refreshExpiresIn: number
  user: AuthUser
}

export type SmsScene = 'register' | 'login' | 'reset' | 'phone-binding'

// =============================================================================
// OAuth 平台类型(8 平台第三方登录,mobile-rn 原生 SDK 授权配套)
// =============================================================================

/** OAuth 平台枚举(对齐后端 apps/api/src/routes/auth-extended.ts 第 2047 行 8 平台回调) */
export type OAuthPlatform =
  'google' | 'apple' | 'dingtalk' | 'enterpriseWechat' | 'wechat' | 'feishu' | 'github' | 'alipay'

/** 各 OAuth 平台配置状态(GET /auth/oauth-status 返回体) */
export interface OAuthStatus {
  google: boolean
  apple: boolean
  dingtalk: boolean
  enterpriseWechat: boolean
  wechat: boolean
  feishu: boolean
  github: boolean
  alipay: boolean
}

/** Google Android id_token 验证返回的用户信息 */
export interface GoogleUserInfo {
  openId: string
  email?: string
  name?: string
  picture?: string
}

// =============================================================================
// 登录(3 种方式 + 别名兼容)
// =============================================================================

/** 账号密码登录(手机号/邮箱/用户名) — POST /auth/login
 *  turnstileToken 为 Cloudflare Turnstile 人机验证 token(可选,后端未配置 TURNSTILE_SECRET_KEY 时放行)。
 *  2026-08-01 P0 契约修复:原字段名 captcha 与后端 preHandler 期望的 turnstileToken 不一致,导致验证码无效。
 */
export async function loginByAccount(
  account: string,
  password: string,
  turnstileToken?: string,
): Promise<ApiResult<LoginResult>> {
  const body: Record<string, string> = { account, password }
  if (turnstileToken) body.turnstileToken = turnstileToken
  return fetchApi<LoginResult>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** 手机号密码登录(小程序别名) — POST /auth/login/password */
export async function loginByPhone(
  phone: string,
  password: string,
): Promise<ApiResult<LoginResult>> {
  return fetchApi<LoginResult>('/api/auth/login/password', {
    method: 'POST',
    body: JSON.stringify({ phone, password }),
  })
}

/** 手机号验证码登录 — POST /auth/login/sms */
export async function loginBySms(phone: string, code: string): Promise<ApiResult<LoginResult>> {
  return fetchApi<LoginResult>('/api/auth/login/sms', {
    method: 'POST',
    body: JSON.stringify({ phone, code }),
  })
}

/** 微信登录 — POST /auth/login/wechat(需配置 WECHAT_APPID/SECRET) */
export async function loginByWechat(code: string): Promise<ApiResult<LoginResult>> {
  return fetchApi<LoginResult>('/api/auth/login/wechat', {
    method: 'POST',
    body: JSON.stringify({ code }),
  })
}

/**
 * 登录 2FA 二次校验 — POST /auth/2fa/login-verify(2026-08-06 立)
 * 用户启用 2FA 时,/auth/login 返回 { twoFactorRequired:true, challengeToken },
 * 前端收集 TOTP(6 位)或备用码(AAAA-AAAA)后调用本接口完成登录。
 * code 为 6 位数字 → token;否则按备用码处理(8 位字母数字,可含连字符)。
 */
export async function verifyTwoFactorLogin(
  challengeToken: string,
  code: string,
): Promise<ApiResult<LoginResult>> {
  const trimmed = code.trim()
  const isTotp = /^\d{6}$/.test(trimmed)
  return fetchApi<LoginResult>('/api/auth/2fa/login-verify', {
    method: 'POST',
    body: JSON.stringify(
      isTotp
        ? { challengeToken, token: trimmed }
        : { challengeToken, backupCode: trimmed.toUpperCase() },
    ),
  })
}

// =============================================================================
// 注册 / 登出 / 刷新 / 验证码
// =============================================================================

/** 注册 — POST /auth/register
 *  2026-08-01 P0 契约修复:captcha → turnstileToken,对齐后端 Turnstile preHandler 字段名。
 */
export async function register(
  phone: string,
  password: string,
  code?: string,
  invitationCode?: string,
  account?: string,
  turnstileToken?: string,
): Promise<ApiResult<LoginResult>> {
  const body: Record<string, string | undefined> = { phone, password, code, invitationCode }
  if (account) body.account = account
  if (turnstileToken) body.turnstileToken = turnstileToken
  return fetchApi<LoginResult>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** 登出(吊销 refreshToken) — POST /auth/logout */
export async function logout(refreshToken: string): Promise<ApiResult<{ revoked: boolean }>> {
  return fetchApi<{ revoked: boolean }>('/api/auth/logout', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  })
}

/** 刷新 accessToken — POST /auth/refresh
 *  P2-18 修复(2026-08-06):refreshToken 参数改为可选。
 *  - 传入 refreshToken:body 携带(兼容旧调用方,如 tokenUtils 自动续期)
 *  - 不传:body 传空字符串 refreshToken,由后端判空后回退到 httpOnly refresh_token cookie
 *    (浏览器自动附带),用于页面刷新后静默恢复登录态(use-auth-bootstrap)。
 *    说明:不传空对象 `{}` 是因为后端路由 schema 仍声明 required:['refreshToken']
 *    (apps/api/src/routes/auth.ts:1138),空对象会被 Fastify 400 拦截;
 *    空字符串能通过路由 schema(string 无 minLength),再由 handler 的 zod(min(1)) 判空
 *    走到 cookie 兜底分支。
 */
export async function refreshAccessToken(refreshToken?: string): Promise<ApiResult<LoginResult>> {
  return fetchApi<LoginResult>('/api/auth/refresh', {
    method: 'POST',
    body: JSON.stringify(refreshToken ? { refreshToken } : { refreshToken: '' }),
  })
}

/** 发送短信验证码 — POST /auth/sms/send */
export async function sendSmsCode(
  phone: string,
  scene: SmsScene = 'login',
): Promise<ApiResult<{ sent: boolean; expiresIn?: number; code?: string }>> {
  return fetchApi<{ sent: boolean; expiresIn?: number; code?: string }>('/api/auth/sms/send', {
    method: 'POST',
    body: JSON.stringify({ phone, scene }),
  })
}

/** 获取当前用户信息 — GET /auth/me */
export async function getMe(): Promise<ApiResult<{ user: AuthUser }>> {
  return fetchApi<{ user: AuthUser }>('/api/auth/me', {
    method: 'GET',
  })
}

// =============================================================================
// 换绑手机(已有功能)
// =============================================================================

export async function sendChangePhoneOldCode(): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>('/api/auth/change-phone/send-old-code', {
    method: 'POST',
  })
}

export async function verifyChangePhoneOldCode(
  code: string,
): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>('/api/auth/change-phone/verify-old-code', {
    method: 'POST',
    body: JSON.stringify({ code }),
  })
}

export async function sendChangePhoneNewCode(
  phone: string,
): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>('/api/auth/change-phone/send-new-code', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  })
}

export async function changePhone(
  phone: string,
  code: string,
): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>('/api/auth/change-phone/confirm', {
    method: 'POST',
    body: JSON.stringify({ phone, code }),
  })
}

// =============================================================================
// 钉钉 / 企业微信 扫码登录
// =============================================================================

export async function getDingtalkAuthUrl(): Promise<ApiResult<{ authUrl: string }>> {
  return fetchApi<{ authUrl: string }>('/api/auth/dingtalk/auth-url')
}

export async function dingtalkLogin(code: string): Promise<ApiResult<LoginResult>> {
  return fetchApi<LoginResult>(`/api/auth/dingtalk/login?code=${encodeURIComponent(code)}`)
}

export async function wecomLogin(code: string): Promise<ApiResult<LoginResult>> {
  return fetchApi<LoginResult>(
    `/api/auth/login/enterprise/pc/wxCode?code=${encodeURIComponent(code)}`,
  )
}

// =============================================================================
// 用户名登录 / 邮箱验证码 / 重置密码 / 注册邮箱
// (2026-07-27 补建:消除 web 端 login 表单直 fetch,统一走 api-client)
// =============================================================================

/** 用户名密码登录 — POST /auth/login/username */
export async function loginByUsername(
  username: string,
  password: string,
): Promise<ApiResult<LoginResult>> {
  return fetchApi<LoginResult>('/api/auth/login/username', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

/**
 * 发送验证码(手机/邮箱通用) — POST /auth/send-code
 * body 字段名按 method 动态决定(phone → {phone, scene} / email → {email, scene})
 */
export async function sendCode(
  method: 'phone' | 'email',
  target: string,
  scene: SmsScene = 'login',
): Promise<ApiResult<{ sent: boolean }>> {
  return fetchApi<{ sent: boolean }>('/api/auth/send-code', {
    method: 'POST',
    body: JSON.stringify({ [method]: target, scene }),
  })
}

/** 重置密码 — POST /auth/reset-password */
export async function resetPassword(input: {
  method: 'phone' | 'email'
  target: string
  code: string
  newPassword: string
}): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 发送邮箱验证码 — POST /auth/email/code */
export async function sendEmailCode(
  email: string,
  scene: SmsScene = 'register',
): Promise<ApiResult<{ sent: boolean }>> {
  return fetchApi<{ sent: boolean }>('/api/auth/email/code', {
    method: 'POST',
    body: JSON.stringify({ email, scene }),
  })
}

/** 邮箱验证码登录 — POST /auth/login/email(对齐 ui-react LoginApiClient 契约) */
export async function loginByEmailCode(
  email: string,
  code: string,
): Promise<ApiResult<LoginResult>> {
  return fetchApi<LoginResult>('/api/auth/login/email', {
    method: 'POST',
    body: JSON.stringify({ email, code }),
  })
}

/** 邮箱注册 — POST /auth/register/email(只发送后端必需字段,confirmPassword 由前端校验) */
export async function registerByEmail(
  email: string,
  code: string,
  password: string,
): Promise<ApiResult<LoginResult>> {
  return fetchApi<LoginResult>('/api/auth/register/email', {
    method: 'POST',
    body: JSON.stringify({ email, code, password }),
  })
}

// =============================================================================
// OAuth 第三方登录(8 平台统一回调 + Google Android id_token 验证)
// 对接 apps/api/src/routes/auth-extended.ts,mobile-rn 原生 SDK 授权配套
// =============================================================================

/** 查询各 OAuth 平台配置状态 — GET /auth/oauth-status
 *  返回 8 平台(google/apple/dingtalk/enterpriseWechat/wechat/feishu/github/alipay)的启用状态,
 *  前端按需渲染登录按钮(后端未配置 client_id/secret 的平台返回 false)。
 */
export async function getOAuthStatus(): Promise<ApiResult<OAuthStatus>> {
  return fetchApi<OAuthStatus>('/api/auth/oauth-status', { method: 'GET' })
}

/** OAuth 通用回调 — POST /auth/:platform/callback
 *  支持 8 平台:google/apple/dingtalk/enterpriseWechat/wechat/feishu/github/alipay。
 *  前端通过 expo-web-browser 或原生 SDK 拿到授权 code 后调用此端点换取 JWT。
 *  body: { code: string, state: string },返回 LoginResult(accessToken/refreshToken/user)。
 */
export async function oauthCallback(
  platform: OAuthPlatform,
  code: string,
  state: string,
): Promise<ApiResult<LoginResult>> {
  return fetchApi<LoginResult>(`/api/auth/${platform}/callback`, {
    method: 'POST',
    body: JSON.stringify({ code, state }),
  })
}

/** Google Android id_token 验证 — GET /auth/google/android/wxCode?id_token=xxx
 *  Android 端通过 @react-native-google-signin/google-signin 拿到 id_token 后调此端点,
 *  后端调用 Google OAuth2 tokeninfo 验证并返回 GoogleUserInfo(openId/email/name/picture)。
 */
export async function verifyGoogleIdToken(idToken: string): Promise<ApiResult<GoogleUserInfo>> {
  return fetchApi<GoogleUserInfo>(
    `/api/auth/google/android/wxCode?id_token=${encodeURIComponent(idToken)}`,
    { method: 'GET' },
  )
}
