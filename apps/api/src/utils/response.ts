/** 统一 API 响应辅助函数,所有路由共享。 */

import type { ZodSchema } from 'zod'
import { AppError } from '../errors/AppError.js'

export interface ApiSuccess<T> {
  code: 0
  message: 'success'
  data: T
}

export interface ApiError {
  code: number
  message: string
  errorCode?: string
}

export function success<T>(data: T): ApiSuccess<T> {
  return { code: 0, message: 'success', data }
}

export function error(code: number, message: string): ApiError {
  return { code, message }
}

export function emptyToUndefined(v: unknown): unknown {
  if (v === '' || v === null || v === undefined) return undefined
  return v
}

/**
 * Zod 校验 + 抛 AppError。
 * 失败时抛出 AppError(statusCode=400, errorCode='VALIDATION_FAILED')，由全局 errorHandler 统一返回 400。
 * 用于替代路由中重复的 safeParse + 手动 reply.status(400).send(error(400, ...)) 模板。
 */
export function parseOrThrow<T>(schema: ZodSchema<T>, input: unknown): T {
  const result = schema.safeParse(input)
  if (!result.success) {
    throw new AppError(result.error.issues[0]?.message ?? '参数错误', 400, 'VALIDATION_FAILED')
  }
  return result.data
}
