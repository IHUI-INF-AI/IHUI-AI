/**
 * LoginForm 共享类型契约(2026-07-26 立)
 *
 * 单一来源(single source of truth):web 端 LoginFormContent 和扩展端
 * popup/sidepanel 都用这份类型,实现由 packages/ui-react/src/components/login-form/
 * 提供。所有 i18n key 与 packages/i18n/messages/shared/{zh-CN,en,ja,ko,zh-TW}.json
 * 中 auth.* 命名空间对齐。
 *
 * 平台差异由调用方注入(不在本组件内硬编码):
 *   - t: i18n 函数(web 用 next-intl,扩展用 i18next/自实现)
 *   - apiClient: 登录 API 客户端(web 用 fetchApi,扩展用 chrome.runtime.sendMessage)
 *   - thirdParty.providers: 8 平台完整 UI 数据(图标/标签/启用状态)
 *   - captchaEnabled / fetchCaptcha: 图形验证码
 */
import type { ReactNode } from 'react'

/**
 * ApiResult 通用结果类型(避免对 @ihui/types 的运行依赖)。
 * 与 packages/types/src/api.ts 的 ApiResult 形状保持一致。
 */
export type ApiResult<T> =
  | { success: true; data: T; error?: undefined }
  | { success: false; error: string; status?: number; errorCode?: string; retryAfter?: number }

/** 登录成功返回的 token + 用户信息(后端 LoginResult) */
export type LoginResult = {
  accessToken: string
  refreshToken: string
  expiresIn: number
  refreshExpiresIn?: number
  user: {
    id: string
    phone?: string
    email?: string
    nickname?: string
    avatar?: string
  }
}

/** 4 个登录 tab(对应 web 端 4 段) */
export type LoginTab = 'email' | 'phone' | 'password' | 'qr'

/** 第三方登录平台 + 本站 App 扫码(固定枚举,与 @ihui/types ThirdPartyPlatform 对齐) */
export type ThirdPartyPlatform =
  | 'wechat'
  | 'google'
  | 'github'
  | 'feishu'
  | 'dingtalk'
  | 'enterpriseWechat'
  | 'alipay'
  | 'apple'
  | 'app'

/** 8 平台静态列表,顺序与 web 端 ThirdPartyLoginButtons 一致(3 列网格按行铺) */
export const ALL_THIRD_PARTY_PLATFORMS: readonly ThirdPartyPlatform[] = [
  'wechat',
  'google',
  'github',
  'feishu',
  'dingtalk',
  'enterpriseWechat',
  'alipay',
  'apple',
] as const

/** 第三方登录 provider 配置(由调用方注入完整 UI 数据) */
export interface ThirdPartyProvider {
  key: ThirdPartyPlatform
  label: string
  /** 图标:可以是 ReactNode(SVG / img / Next.js Image) */
  icon: ReactNode
  enabled: boolean
  /** 平台未上线时强制禁用(灰显 + tooltip) */
  forceDisabled?: boolean
  /** dark 模式用 invert 翻色 */
  mono?: boolean
  /** 自定义禁用提示文案(优先级高于内置文案) */
  disabledTooltip?: string
}

/** 第三方登录配置 */
export interface ThirdPartyConfig {
  providers: ThirdPartyProvider[]
  /** 当前正在登录的平台(用于 loading 态) */
  currentPlatform: ThirdPartyPlatform | null
  /** 第三方登录点击回调(由调用方实现跳转 / OAuth / fetch 等) */
  onLogin: (platform: ThirdPartyPlatform) => void
}

/** 登录 API 客户端(由调用方注入,适配 web/extension 不同存储/网络) */
export interface LoginApiClient {
  /** 账号密码登录 */
  loginByAccount: (
    account: string,
    password: string,
    captcha?: string,
  ) => Promise<ApiResult<LoginResult>>
  /** 邮箱验证码登录 */
  loginByEmailCode: (email: string, code: string) => Promise<ApiResult<LoginResult>>
  /** 手机号验证码登录 */
  loginBySms: (phone: string, code: string) => Promise<ApiResult<LoginResult>>
  /** 发送邮箱验证码 */
  sendEmailCode: (email: string) => Promise<ApiResult<{ sent: boolean }>>
  /** 发送手机验证码 */
  sendSmsCode: (phone: string) => Promise<ApiResult<{ sent: boolean }>>
  /** 图形验证码 svg(token 用于提交时校验),可选 */
  fetchCaptcha?: () => Promise<{ svg: string; token: string } | null>
  /**
   * 登录 2FA 二次校验钩子(2026-08-06 立,可选)。
   * 当登录响应 twoFactorRequired=true 时,调用方注入的登录方法实现内部调用此钩子:
   * 展示 TOTP/备用码输入面板,返回用户提交的 code(challengeToken 用于标识本次挑战)。
   * 未注入时,登录方法应原样返回 twoFactorRequired 响应由上层处理(或提示用户)。
   */
  request2faCode?: (challengeToken: string) => Promise<string>
}

/** QR tab 平台配置(由调用方注入,默认 4 个 wechat/wecom/dingtalk/feishu) */
export interface QrPlatformConfig {
  key: ThirdPartyPlatform
  labelKey: string
  /** 平台 icon(ReactNode:emoji / SVG / img) */
  icon: ReactNode
  /** 平台扫码登录网页 URL */
  webUrl: string
}

/** 邮箱正则(简化版,web 端 login-schemas 一致) */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
/** 手机号正则(简化版,中国大陆 11 位) */
const PHONE_RE = /^1[3-9]\d{9}$/

/** 校验邮箱(供 email tab 子组件用) */
export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim())
}

/** 校验手机号(供 phone tab 子组件用) */
export function isValidPhone(phone: string): boolean {
  return PHONE_RE.test(phone.trim())
}

/** LoginForm 主组件 props */
export interface LoginFormProps {
  /** i18n 翻译函数 */
  t: (key: string, params?: Record<string, string | number>) => string
  /** 登录 API 客户端(由调用方注入) */
  apiClient: LoginApiClient
  /** 登录成功回调 */
  onSuccess?: (result: LoginResult) => void | Promise<void>
  /** 启用的 tab 列表,默认 ['email','phone','password','qr'](全开) */
  tabs?: LoginTab[]
  /** 默认 tab */
  defaultTab?: LoginTab
  /** 是否显示第三方登录区 */
  showThirdParty?: boolean
  /** 第三方登录配置 */
  thirdParty?: ThirdPartyConfig
  /** 是否显示注册链接 */
  showRegisterLink?: boolean
  onRegister?: () => void
  registerHref?: string
  /** 是否显示忘记密码链接(password tab 才生效) */
  showForgotPassword?: boolean
  onForgotPassword?: () => void
  forgotPasswordHref?: string
  /** 是否显示协议复选框 */
  showAgreement?: boolean
  /** inline:错误时直接红色提示;notice-dialog:弹弹窗 */
  agreementMode?: 'inline' | 'notice-dialog'
  /** 协议复选框初始勾选状态(默认 false) */
  defaultAgreed?: boolean
  /** 是否需要图形验证码(password tab 才有意义) */
  captchaEnabled?: boolean
  /** 自定义样式 */
  inputClassName?: string
  buttonClassName?: string
  className?: string
  /** web 端可注入带 WxLogin/DTFrameLogin/QRLogin/wwLogin SDK 的 QR 组件;
   *  extension 不传时显示默认"打开网页完成扫码"占位 */
  qrComponent?: (props: { platform: ThirdPartyPlatform; refreshKey: number }) => ReactNode
  /** 自定义 QR 平台列表(默认 4 个 wechat/wecom/dingtalk/feishu) */
  qrPlatforms?: QrPlatformConfig[]
  /**
   * 是否启用凭据持久化(记住密码 + 自动登录 + 账号历史)
   * 2026-07-30 立:消除 web 端 B 版本与共享包 A 版本功能差异。
   * true 时 password tab 显示"记住密码/自动登录"checkbox + 账号输入框带历史下拉,
   * 登录成功后持久化到 localStorage。默认 false 向后兼容。
   */
  enableCredentialPersistence?: boolean
}
