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

export * from './constants/theme'
