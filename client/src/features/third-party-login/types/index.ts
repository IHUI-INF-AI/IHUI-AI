// 第三方平台类型
export type ThirdPartyPlatform = 'alipay' | 'google'

// 登录状态类型
export type LoginStatus =
  | 'pending'
  | 'scanning'
  | 'scanned'
  | 'confirming'
  | 'success'
  | 'failed'
  | 'expired'

// 基础响应接口
export interface BaseResponse<T = unknown> {
  code: number
  message: string
  data: T
}

// 二维码登录响应
export interface QRLoginResponse {
  qrCodeUrl: string
  state: string
  expiresIn: number // 过期时间（秒）
}

// 登录状态检查响应
export interface LoginStatusResponse {
  status: LoginStatus
  token?: string
  user?: UserInfo
  message?: string
}

// 用户信息接口
export interface UserInfo {
  id: string
  username: string
  email: string
  nickname: string
  avatar: string
  isVip: boolean
  inviteCode: string
  createTime: string
  phone?: string
  gender?: number
  birthday?: string
  signature?: string
  status?: number
}

// 登录成功响应
export interface LoginSuccessResponse {
  token: string
  refreshToken?: string
  user: UserInfo
  expiresIn?: number
}

// 第三方平台配置
export interface PlatformConfig {
  enabled: boolean
  appId: string
  [key: string]: any
}

// 支付宝配置
export interface AlipayConfig extends PlatformConfig {
  qrLoginEnabled: boolean
  webAuthEnabled: boolean
  sandboxMode: boolean
}

// Google配置
export interface GoogleConfig extends PlatformConfig {
  clientId: string
  redirectUri: string
  scope: string
}



// 第三方登录总配置
export interface ThirdPartyConfig {
  alipay: AlipayConfig
  google: GoogleConfig
}

// 第三方账号绑定信息
export interface ThirdPartyAccount {
  id: string
  platform: ThirdPartyPlatform
  platformUserId: string
  platformUsername: string
  platformAvatar: string
  bindTime: string
  status: 'active' | 'disabled'
}

// 登录组件Props
export interface LoginComponentProps {
  autoStart?: boolean
  mode?: 'qr' | 'popup' | 'redirect'
  size?: 'small' | 'medium' | 'large'
  theme?: 'light' | 'dark'
  showLogo?: boolean
  showTitle?: boolean
}

// 登录组件Emits
export interface LoginComponentEmits {
  'login-success': (data: LoginSuccessResponse) => void
  'login-error': (error: Error) => void
  'login-cancel': () => void
  'switch-method': (method: string) => void
  'status-change': (status: LoginStatus) => void
}

// OAuth回调参数
export interface OAuthCallbackParams {
  code: string
  state?: string
  error?: string
  error_description?: string
}

// 支付宝用户信息
export interface AlipayUserInfo {
  user_id: string
  nick_name: string
  avatar: string
  province: string
  city: string
  is_student_certified: boolean
  user_type: string
  user_status: string
}

// Google用户信息
export interface GoogleUserInfo {
  id: string
  email: string
  name: string
  picture: string
  given_name: string
  family_name: string
  verified_email: boolean
}

// 登录事件数据
export interface LoginEventData {
  platform: ThirdPartyPlatform
  success: boolean
  error?: string
  duration?: number // 登录耗时（毫秒）
  timestamp: number
}

// 统计信息
export interface LoginStats {
  totalAttempts: number
  successCount: number
  failureCount: number
  averageDuration: number
  mostUsedPlatform: ThirdPartyPlatform | null
  lastLoginTime: string | null
}

// 错误类型
export enum LoginErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  CONFIG_ERROR = 'CONFIG_ERROR',
  PLATFORM_ERROR = 'PLATFORM_ERROR',
  USER_CANCELLED = 'USER_CANCELLED',
  EXPIRED = 'EXPIRED',
  UNKNOWN = 'UNKNOWN',
}

// 登录错误
export interface LoginError extends Error {
  type: LoginErrorType
  platform: ThirdPartyPlatform
  code?: string
  details?: any
}

// 工具函数类型
export type PlatformDisplayNames = Record<ThirdPartyPlatform, string>

export type PlatformIcons = Record<ThirdPartyPlatform, string>

export type PlatformColors = Record<
  ThirdPartyPlatform,
  {
    primary: string
    secondary: string
    background: string
  }
>

// 组件状态
export interface ComponentState {
  loading: boolean
  error: string | null
  status: LoginStatus
  progress: number // 0-100
}

// 配置验证结果
export interface ConfigValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

// API请求配置
export interface ApiRequestConfig {
  timeout: number
  retries: number
  retryDelay: number
}

// 缓存配置
export interface CacheConfig {
  enabled: boolean
  duration: number // 缓存时长（秒）
  maxSize: number // 最大缓存项数
}

// 安全配置
export interface SecurityConfig {
  csrfProtection: boolean
  allowedOrigins: string[]
  tokenValidation: boolean
  rateLimiting: {
    enabled: boolean
    maxAttempts: number
    windowMs: number
  }
}

// 完整功能配置
export interface FeatureConfig {
  platforms: ThirdPartyConfig
  api: ApiRequestConfig
  cache: CacheConfig
  security: SecurityConfig
  ui: {
    theme: 'light' | 'dark' | 'auto'
    language: string
    showDebugInfo: boolean
  }
}
