/**
 * API 配置 — 新架构统一使用 /api 前缀
 * fetchApi 会自动规范化 URL，此处仅保留超时/重试/白名单配置
 */

/** 运行环境 */
export type ApiEnv = 'development' | 'staging' | 'production'

/** API 基础前缀（fetchApi 已内置处理，此常量仅供特殊场景引用） */
export const API_PREFIX = '/api'

/** 各环境 API 基础地址 */
export const API_BASE_URLS: Record<ApiEnv, string> = {
  development: '/api',
  staging: '/api',
  production: '/api',
}

/** 默认请求超时（毫秒） */
export const REQUEST_TIMEOUT = 30_000

/** 上传/长任务请求超时（毫秒） */
export const UPLOAD_TIMEOUT = 120_000

/** 重试策略 */
export interface RetryPolicy {
  maxRetries: number
  baseDelayMs: number
  backoffFactor: number
  maxDelayMs: number
  retryOnStatus: number[]
}

/** 默认重试策略：指数退避，仅对 5xx / 429 重试 */
export const API_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  baseDelayMs: 500,
  backoffFactor: 2,
  maxDelayMs: 8_000,
  retryOnStatus: [429, 500, 502, 503, 504],
}

/** 免鉴权白名单 */
export const API_WHITE_LIST: string[] = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/auth/captcha',
  '/api/auth/sms',
  '/api/customer-service/faqs',
]

/** 获取指定环境的 API 基础地址 */
export function getBaseUrl(env: ApiEnv = 'production'): string {
  return API_BASE_URLS[env]
}

/** 判断请求 URL 是否命中白名单（免鉴权） */
export function isWhiteListUrl(url: string): boolean {
  if (!url) return false
  return API_WHITE_LIST.some((prefix) => url.startsWith(prefix))
}

/** 计算第 attempt 次重试的退避延迟（attempt 从 1 开始） */
export function getRetryDelay(attempt: number, policy: RetryPolicy = API_RETRY_POLICY): number {
  const delay = policy.baseDelayMs * Math.pow(policy.backoffFactor, attempt - 1)
  return Math.min(delay, policy.maxDelayMs)
}

/** 判断给定 HTTP 状态码是否应触发重试 */
export function shouldRetryOnStatus(
  status: number,
  policy: RetryPolicy = API_RETRY_POLICY,
): boolean {
  return policy.retryOnStatus.includes(status)
}
