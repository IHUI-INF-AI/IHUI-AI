// Google Identity Services API 类型定义

declare global {
  interface Window {
    google?: {
      accounts?: {
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
          hasGrantedAllScopes: (tokenResponse: TokenResponse, ...scopes: string[]) => boolean
          revoke: (accessToken: string, callback?: () => void) => void
        }
      }
    }
  }
}

// Google Identity Services 配置接口
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

// 凭证响应接口
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

// 提示时刻通知接口
export interface PromptMomentNotification {
  isDisplayMoment: () => boolean
  isDisplayed: () => boolean
  isNotDisplayed: () => boolean
  getNotDisplayedReason: () =>
    | 'browser_not_supported'
    | 'invalid_client'
    | 'missing_client_id'
    | 'opt_out_or_no_session'
    | 'secure_http_required'
    | 'suppressed_by_user'
    | 'unregistered_origin'
    | 'unknown_reason'
  isSkippedMoment: () => boolean
  getSkippedReason: () => 'auto_cancel' | 'user_cancel' | 'tap_outside' | 'issuing_failed'
  isDismissedMoment: () => boolean
  getDismissedReason: () => 'credential_returned' | 'cancel_called' | 'flow_restarted'
  getMomentType: () => 'display' | 'skipped' | 'dismissed'
}

// Google 登录按钮配置接口
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

// Token 客户端配置接口
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

// Token 客户端接口
export interface TokenClient {
  requestAccessToken: (overrideConfig?: Partial<TokenClientConfig>) => void
}

// Token 响应接口
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

// Token 错误接口
export interface TokenError {
  type: 'popup_closed' | 'popup_failed_to_open' | 'unknown'
  message?: string
}

// 撤销响应接口
export interface RevocationResponse {
  successful: boolean
  error?: string
  error_description?: string
}

// Google One Tap 状态枚举
export enum GoogleOneTapStatus {
  NOT_DISPLAYED = 'not_displayed',
  SKIPPED = 'skipped',
  DISMISSED = 'dismissed',
}

// Google One Tap 跳过原因枚举
export enum GoogleOneTapSkipReason {
  AUTO_CANCEL = 'auto_cancel',
  USER_CANCEL = 'user_cancel',
  TAP_OUTSIDE = 'tap_outside',
  ISSUING_FAILED = 'issuing_failed',
}

// Google One Tap 不显示原因枚举
export enum GoogleOneTapNotDisplayReason {
  BROWSER_NOT_SUPPORTED = 'browser_not_supported',
  INVALID_CLIENT = 'invalid_client',
  MISSING_CLIENT_ID = 'missing_client_id',
  OPT_OUT_OR_NO_SESSION = 'opt_out_or_no_session',
  SECURE_HTTP_REQUIRED = 'secure_http_required',
  SUPPRESSED_BY_USER = 'suppressed_by_user',
  UNREGISTERED_ORIGIN = 'unregistered_origin',
  UNKNOWN_REASON = 'unknown_reason',
}

// 导出空对象以确保模块可以被导入
export {}
