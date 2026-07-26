/**
 * 共享 LoginForm 类型定义(2026-07-26 抽取)
 *
 * 共享包不直接依赖 next-intl / next/image / react-hook-form / @ihui/api-client
 * 这些 web/extension 专属依赖。所有跨端差异通过 props 注入。
 */

/** 支持的登录方式 tab */
export type LoginTab = 'email' | 'phone' | 'password' | 'qr'

/** 第三方平台 key(8 个 + 1 placeholder) */
export type ThirdPartyPlatform =
  | 'google'
  | 'apple'
  | 'dingtalk'
  | 'enterpriseWechat'
  | 'wechat'
  | 'github'
  | 'feishu'
  | 'alipay'

/** 统一登录结果 */
export interface LoginResult {
  success: boolean
  /** 业务错误信息(key 或 文案) */
  error?: string
  /** accessToken + refreshToken(成功时返回) */
  data?: {
    accessToken: string
    refreshToken: string
    expiresIn: number
    user?: {
      id: string
      nickname: string
      avatar?: string
      phone?: string
      email?: string
    }
  }
}

/** API 客户端注入接口(避免共享包依赖 @ihui/api-client) */
export interface LoginApiClient {
  /** 账号+密码登录 */
  loginByAccount: (account: string, password: string) => Promise<LoginResult>
  /** 邮箱+验证码登录 */
  loginByEmailCode: (email: string, code: string) => Promise<LoginResult>
  /** 手机+验证码登录 */
  loginByPhoneCode: (phone: string, code: string) => Promise<LoginResult>
  /** 发送邮箱验证码 */
  sendEmailCode: (email: string) => Promise<{ success: boolean; error?: string }>
  /** 发送手机验证码 */
  sendPhoneCode: (phone: string) => Promise<{ success: boolean; error?: string }>
}

/** 第三方登录 Provider 配置(由 web 端 useThirdPartyAuth 注入) */
export interface ThirdPartyProvider {
  key: ThirdPartyPlatform
  label: string
  /** 图标 URL(扩展端需要可访问的 https URL) */
  icon: string
  /** 强制禁用(如 Apple 登录尚未上线) */
  forceDisabled?: boolean
  /** 单色图标:dark 模式下用 invert 翻色 */
  mono?: boolean
  /** 当前是否启用(由父组件 useThirdPartyAuth 决定) */
  enabled?: boolean
  /** 禁用提示 */
  tooltip?: string
}

/** 第三方登录配置 */
export interface ThirdPartyConfig {
  /** 启用的 provider 列表(由 useThirdPartyAuth 决定 enabled + 平台配置) */
  providers: ThirdPartyProvider[]
  /** 当前登录中平台(loading 态) */
  currentPlatform?: ThirdPartyPlatform | null
  /** 开始登录回调 */
  onLogin: (platform: ThirdPartyPlatform) => void | Promise<void>
}

/** i18n 函数(由 web next-intl / extension useI18n 各自包装) */
export type TFunc = (key: string, params?: Record<string, string | number>) => string
