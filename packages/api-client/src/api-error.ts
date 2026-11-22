// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

export type ApiFailureStage = 'client_validation' | 'upstream_request' | 'local_persist'

export const API_FAILURE_STAGES: readonly ApiFailureStage[] = [
  'client_validation',
  'upstream_request',
  'local_persist',
]

/**
 * 错误类别(封闭联合,跨进程可判;b76-01 票3)。
 * 权威定义在 @ihui/types/error-serialize 的 ErrorCategory —— 本包按 error-serialize
 * 收口先例(见 client.ts 文件头 2026-09-26 注)包内自持同名判据,权威漂移由 types
 * 侧测试把守。"限流"这类判定只能由 errorCategory 得出,类别缺失即 false,
 * 绝不回退到 message 文本匹配。
 */
export type ApiErrorCategory =
  | 'rate_limited'
  | 'quota_exhausted'
  | 'auth'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'validation'
  | 'upstream'
  | 'internal'

export const API_ERROR_CATEGORIES: readonly ApiErrorCategory[] = [
  'rate_limited',
  'quota_exhausted',
  'auth',
  'forbidden',
  'not_found',
  'conflict',
  'validation',
  'upstream',
  'internal',
]

export class ApiError extends Error {
  status?: number
  errorCode?: string
  /** 判别式分类:判定一律走 errorCategory/errorCode,禁止按 message 文本分支。 */
  errorCategory?: ApiErrorCategory
  /** 失败发生在哪条边界上(client_validation / upstream_request / local_persist)。 */
  failureStage?: ApiFailureStage
  constructor(message: string, status?: number, errorCode?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errorCode = errorCode
  }
}

/** createXxxError 形态的便捷工厂:错误类别与边界阶段必填,code/status 选填。 */
export function createApiError(input: {
  message: string
  errorCategory: ApiErrorCategory
  failureStage: ApiFailureStage
  status?: number
  errorCode?: string
}): ApiError {
  const err = new ApiError(input.message, input.status, input.errorCode)
  err.errorCategory = input.errorCategory
  err.failureStage = input.failureStage
  return err
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError
}

/** isXxxError 判定器(按封闭类别)。**禁止**把 err.message 拿来做文本比对。 */
export function isApiErrorCategory(err: unknown, category: ApiErrorCategory): boolean {
  return isApiError(err) && err.errorCategory === category
}

export function isNotFound(err: unknown): boolean {
  return err instanceof ApiError && err.status === 404
}

export function isErrorCode(err: unknown, code: string): boolean {
  return err instanceof ApiError && err.errorCode === code
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
