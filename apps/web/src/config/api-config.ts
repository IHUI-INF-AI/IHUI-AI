/**
 * API 配置 — 迁移自旧架构 client/src/config/api-config.ts
 * 旧版为 @aizhs/shared-api 的 re-export 层；新架构改为自包含单一数据源，
 * 定义 API 基础地址、超时、重试策略与白名单
 */

/** 运行环境 */
export type ApiEnv = 'development' | 'staging' | 'production'

/** Coze 旧业务接口前缀（nginx 代理到 Python 后端） */
export const COZE_API_PREFIX = '/cozeZhsApi'

/** 开发环境代理前缀（vite/next dev server 转发） */
export const COZE_DEV_PROXY_PREFIX = '/cozeZhsApi'

/** 各环境 API 基础地址 */
export const API_BASE_URLS: Record<ApiEnv, string> = {
  development: '/cozeZhsApi',
  staging: '/cozeZhsApi',
  production: '/cozeZhsApi',
}

/** 默认请求超时（毫秒） */
export const REQUEST_TIMEOUT = 30_000

/** 上传/长任务请求超时（毫秒） */
export const UPLOAD_TIMEOUT = 120_000

/** 重试策略 */
export interface RetryPolicy {
  /** 最大重试次数（不含首次请求） */
  maxRetries: number
  /** 初始退避延迟（毫秒） */
  baseDelayMs: number
  /** 退避乘数 */
  backoffFactor: number
  /** 最大退避延迟上限（毫秒） */
  maxDelayMs: number
  /** 触发重试的 HTTP 状态码 */
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

/**
 * 免鉴权白名单 — 命中下列前缀的请求跳过 token 注入与 401 拦截。
 * 与旧架构 API_WHITE_LIST 保持一致
 */
export const API_WHITE_LIST: string[] = [
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/auth/refresh',
  '/api/v1/auth/captcha',
  '/api/v1/auth/sms',
  '/api/v1/customer_service/faqs',
  '/cozeZhsApi/login',
  '/cozeZhsApi/user/refresh-token',
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
