/**
 * 第三方登录类型定义
 *
 * 包含 Google Identity Services (GIS) 类型与第三方账号/平台通用类型。
 * 迁移自旧架构 client/src/features/third-party-login/types/google.d.ts，
 * 适配新架构（React + TypeScript，模块化导出）。
 */

// ---------------------------------------------------------------------------
// Google Identity Services 类型
// 官方文档: https://developers.google.com/identity/gsi/web/reference/js-reference
// ---------------------------------------------------------------------------

/** Google Identity Services 配置接口 */
export interface GoogleIdConfiguration {
  client_id: string
  callback: (credentialResponse: CredentialResponse) => void
  auto_select?: boolean
  cancel_on_tap_outside?: boolean
  context?: 'signin' | 'signup' | 'use'
  state_cookie_domain?: string
  ux_mode?: 'popup' | 'redirect'
  allowed_parent_origin?: string | string[]
  intermediate_iframe_close_callback?: () => void
}

/** 凭证响应接口 */
export interface CredentialResponse {
  credential: string
  select_by?:
    | 'auto'
    | 'user'
    | 'user_1tap'
    | 'user_2tap'
    | 'btn'
    | 'btnconfirm'
    | 'brn_add_session'
    | 'btnconfirm_add_session'
  clientId?: string
}

/** 提示时刻通知接口 */
export interface PromptMomentNotification {
  isDisplayMoment: () => boolean
  isDisplayed: () => boolean
  isNotDisplayed: () => boolean
  getNotDisplayedReason: () => GoogleOneTapNotDisplayReason
  isSkippedMoment: () => boolean
  getSkippedReason: () => GoogleOneTapSkipReason
  isDismissedMoment: () => boolean
  getDismissedReason: () => GoogleOneTapDismissReason
  getMomentType: () => 'display' | 'skipped' | 'dismissed'
}

/** Google 登录按钮配置接口 */
export interface GsiButtonConfiguration {
  type?: 'standard' | 'icon'
  theme?: 'outline' | 'filled_blue' | 'filled_black'
  size?: 'large' | 'medium' | 'small'
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
  shape?: 'rectangular' | 'pill' | 'circle' | 'square'
  logo_alignment?: 'left' | 'center'
  width?: string
  locale?: string
  click_listener?: () => void
}

/** Token 客户端配置接口 */
export interface TokenClientConfig {
  client_id: string
  scope: string
  callback?: (tokenResponse: TokenResponse) => void
  error_callback?: (error: TokenError) => void
  state?: string
  enable_granular_consent?: boolean
  include_granted_scopes?: boolean
  hint?: string
  hosted_domain?: string
}

/** Token 客户端接口 */
export interface TokenClient {
  requestAccessToken: (overrideConfig?: Partial<TokenClientConfig>) => void
}

/** Token 响应接口 */
export interface TokenResponse {
  access_token: string
  authuser: string
  expires_in: number
  prompt: string
  scope: string
  token_type: string
  error?: string
  error_description?: string
  error_uri?: string
}

/** Token 错误接口 */
export interface TokenError {
  type: 'popup_closed' | 'popup_failed_to_open' | 'unknown'
  message?: string
}

/** 撤销响应接口 */
export interface RevocationResponse {
  successful: boolean
  error?: string
  error_description?: string
}

// Google One Tap 状态枚举（用 const 对象 + 联合类型，兼容 isolatedModules）
export const GoogleOneTapStatus = {
  NOT_DISPLAYED: 'not_displayed',
  SKIPPED: 'skipped',
  DISMISSED: 'dismissed',
} as const
export type GoogleOneTapStatus = (typeof GoogleOneTapStatus)[keyof typeof GoogleOneTapStatus]

export const GoogleOneTapSkipReason = {
  AUTO_CANCEL: 'auto_cancel',
  USER_CANCEL: 'user_cancel',
  TAP_OUTSIDE: 'tap_outside',
  ISSUING_FAILED: 'issuing_failed',
} as const
export type GoogleOneTapSkipReason =
  (typeof GoogleOneTapSkipReason)[keyof typeof GoogleOneTapSkipReason]

export const GoogleOneTapNotDisplayReason = {
  BROWSER_NOT_SUPPORTED: 'browser_not_supported',
  INVALID_CLIENT: 'invalid_client',
  MISSING_CLIENT_ID: 'missing_client_id',
  OPT_OUT_OR_NO_SESSION: 'opt_out_or_no_session',
  SECURE_HTTP_REQUIRED: 'secure_http_required',
  SUPPRESSED_BY_USER: 'suppressed_by_user',
  UNREGISTERED_ORIGIN: 'unregistered_origin',
  UNKNOWN_REASON: 'unknown_reason',
} as const
export type GoogleOneTapNotDisplayReason =
  (typeof GoogleOneTapNotDisplayReason)[keyof typeof GoogleOneTapNotDisplayReason]

export const GoogleOneTapDismissReason = {
  CREDENTIAL_RETURNED: 'credential_returned',
  CANCEL_CALLED: 'cancel_called',
  FLOW_RESTARTED: 'flow_restarted',
} as const
export type GoogleOneTapDismissReason =
  (typeof GoogleOneTapDismissReason)[keyof typeof GoogleOneTapDismissReason]

/** window.google 命名空间（用于 GIS SDK 动态注入后的类型提示） */
export interface GoogleAccountsNamespace {
  id?: {
    initialize: (config: GoogleIdConfiguration) => void
    prompt: (callback?: (notification: PromptMomentNotification) => void) => void
    renderButton: (parent: HTMLElement, options: GsiButtonConfiguration) => void
    disableAutoSelect: () => void
    storeCredential: (credential: { id: string; password: string }) => void
    cancel: () => void
    onGoogleLibraryLoad: () => void
    revoke: (hint: string, callback: (done: RevocationResponse) => void) => void
  }
  oauth2?: {
    initTokenClient: (config: TokenClientConfig) => TokenClient
    hasGrantedAnyScope: (tokenResponse: TokenResponse, ...scopes: string[]) => boolean
    hasGrantedAllScope: (tokenResponse: TokenResponse, ...scopes: string[]) => boolean
    revoke: (accessToken: string, callback?: () => void) => void
  }
}

// 扩展 Window 接口，使 window.google 在动态加载 GIS SDK 后可用
declare global {
  interface Window {
    google?: {
      accounts?: GoogleAccountsNamespace
    }
  }
}

// ---------------------------------------------------------------------------
// 第三方平台通用类型
// ---------------------------------------------------------------------------

/** 支持的第三方登录平台 */
export type ThirdPartyPlatform =
  'google' | 'apple' | 'dingtalk' | 'enterpriseWechat' | 'wechat' | 'github'

/** 第三方登录状态机 */
export type ThirdPartyLoginStatus =
  'pending' | 'scanning' | 'scanned' | 'confirming' | 'success' | 'failed' | 'expired'

/** 第三方登录运行时状态 */
export interface ThirdPartyLoginState {
  platform: ThirdPartyPlatform
  status: ThirdPartyLoginStatus
  qrCodeUrl?: string
  stateKey?: string
  expiresAt?: number
  error?: string
  retryCount: number
}

/** 第三方账号绑定信息 */
export interface ThirdPartyAccount {
  id: string
  platform: ThirdPartyPlatform
  platformUserId: string
  platformUsername: string
  platformAvatar: string
  bindTime: string
  status: 'active' | 'disabled'
}

/** Google 登录响应 */
export interface ThirdPartyLoginResponse {
  token: string
  refreshToken?: string
  user: {
    id: string
    username: string
    email: string
    nickname: string
    avatar: string
    isVip: boolean
    inviteCode: string
    createTime: string
  }
}

/** Google OAuth 配置（由后端 /api/auth/google/config 返回） */
export interface GoogleOAuthConfig {
  clientId: string
  redirectUri: string
  scope: string
  configured: boolean
}

/** Google 用户信息 */
export interface GoogleUserInfo {
  id: string
  email: string
  name: string
  picture: string
  given_name: string
  family_name: string
}
