export const TOKEN_STORAGE_KEY = 'ihui_token'
export const REFRESH_TOKEN_STORAGE_KEY = 'ihui_refresh_token'
export const REFRESH_LEAD_MS = 5 * 60 * 1000

/**
 * Token 过期状态码(各端判断 HTTP 响应是否表示 token 过期,触发 refresh / 重登流程)。
 * 401 = 标准 Unauthorized;40101 = 业务层 token 过期约定码;499 = 客户端关闭连接前置码。
 */
export const TOKEN_EXPIRED_CODES = [401, 40101, 499] as const

/**
 * Web 端基址(各端跳转 web 端页面 / SSO 回跳 / 分享链接拼接用)。
 * 生产环境固定 https://ihui.ai;开发环境各端可自行 fallback 到 localhost。
 */
export const WEB_BASE = 'https://ihui.ai'

/**
 * Error codes (business error enum, predicates, i18n key mapping) - shared across all apps.
 * @see ./constants/error-codes.ts
 */
export * from './constants/error-codes'

/**
 * 性别枚举(跨端统一:mobile-rn/ProfileEditScreen + miniapp-taro/ProfileEdit 共用)。
 * 0 = 保密,1 = 男,2 = 女(后端 API 约定)。
 */
export type Gender = 0 | 1 | 2

export const GENDERS: ReadonlyArray<{ value: Gender; key: 'male' | 'female' | 'secret' }> = [
  { value: 1, key: 'male' },
  { value: 2, key: 'female' },
  { value: 0, key: 'secret' },
] as const

export const GENDER_KEYS: Record<'male' | 'female' | 'secret', string> = {
  male: 'profileEdit.gender_male',
  female: 'profileEdit.gender_female',
  secret: 'profileEdit.gender_secret',
}

/**
 * 持久化键名(跨端统一:web localStorage / mobile-rn AsyncStorage / miniapp-taro Taro.storage 共用)。
 * 注意:theme 用连字符 'ihui-theme'(与 @ihui/shared/stores/theme-store 默认值一致),
 * 避免历史下划线 'ihui_theme' 与连字符 'ihui-theme' 跨端漂移。
 */
export const THEME_STORAGE_KEY = 'ihui-theme'
export const LOCALE_STORAGE_KEY = 'ihui-locale'