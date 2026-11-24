// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { z } from 'zod'
import type { FastifySchema, RouteShorthandOptions } from 'fastify'

const successSchema = {
  type: 'object',
  properties: {
    code: { type: 'number', example: 0 },
    message: { type: 'string', example: 'ok' },
    // F-323:data 不能声明 type。钉成 object 时数组会被 fast-json-stringify
    // 序列化成 {"0":...,"1":...};这里只给描述,任意 JSON(对象/数组/标量)原样透传。
    data: { description: '响应数据（任意 JSON：对象、数组、标量）' },
  },
}

const errorSchema = {
  type: 'object',
  properties: {
    code: { type: 'number', example: 1 },
    message: { type: 'string' },
  },
}

/**
 * 带 errorCode 的 error schema(2026-11-13 立)。
 *
 * 与 errorSchema 的唯一差别:properties 显式声明 errorCode。用途见 response.ts error()
 * 的注释(票 L7648):设计意图是 AppError.errorCode 要送到端上分型(如 PAYROLL_NOT_APPROVED /
 * PAYROLL_NO_ITEMS),而不是被序列化裁掉、让前端/AI 层只能按 HTTP 状态码猜。
 *
 * **为什么不能直接把它套给全局 standardResponses**:fast-json-stringify 会裁掉未声明的字段
 * (实测确认:配了 response schema ⇒ errorCode 被裁,不配则保留)。全量放开会让既有 75 处
 * `toEqual({ code, message })` 严格断言(那些用例今天能过正是依赖全局裁剪)整体变红,
 * 跨 115 端点的行为变更超出单票范围。故只给**确实需要端上分型**的端点(如 hr-payroll/handoff)
 * 显式传 response 用这一份,零波及其他路由。
 */
const errorWithCodeSchema = {
  type: 'object',
  properties: {
    code: { type: 'number', example: 1 },
    message: { type: 'string' },
    errorCode: { type: 'string', example: 'PAYROLL_NOT_APPROVED' },
  },
}

/** 需要端上 error 分型(errorCode 可见)的路由用这份 response,而非默认 standardResponses。 */
export const errorCodeResponses = {
  200: successSchema,
  400: errorWithCodeSchema,
  401: errorWithCodeSchema,
  403: errorWithCodeSchema,
  404: errorWithCodeSchema,
  409: errorWithCodeSchema,
  500: errorWithCodeSchema,
}

const standardResponses = {
  200: successSchema,
  400: errorSchema,
  401: errorSchema,
  403: errorSchema,
  404: errorSchema,
  500: errorSchema,
}

const publicResponses = {
  200: successSchema,
  400: errorSchema,
  404: errorSchema,
}

const callbackSuccessSchema = {
  type: 'object',
  properties: {
    code: { type: 'string', example: 'SUCCESS' },
    message: { type: 'string', example: 'OK' },
  },
}

const callbackResponses = {
  200: callbackSuccessSchema,
  400: callbackSuccessSchema,
  500: callbackSuccessSchema,
}

interface BuildSchemaOptions {
  summary: string
  description?: string
  tags?: string[]
  body?: z.ZodType
  querystring?: z.ZodType
  params?: z.ZodType
  response?: Record<string | number, unknown>
  auth?: boolean
  admin?: boolean
}

export function buildSchema(opts: BuildSchemaOptions): FastifySchema {
  const schema: FastifySchema = {
    summary: opts.summary,
    description: opts.description,
    tags: opts.tags,
    response: opts.response ?? (opts.auth === false ? publicResponses : standardResponses),
  }
  // zod 4 的 z.toJSONSchema() 不支持含 .transform()/.preprocess() 的 schema（JSON Schema 无 transform 语义）。
  // 含 transform 的 schema（如 booleanStringSchemaOptional）降级为通用 object schema，
  // 仅影响 OpenAPI 文档展示精度；运行时验证仍由 handler 内 safeParse 完成。
  const toJsonSchemaSafe = (zodType: z.ZodType): unknown => {
    try {
      return z.toJSONSchema(zodType, { target: 'openApi3' })
    } catch {
      return { type: 'object', additionalProperties: true }
    }
  }
  if (opts.body) schema.body = toJsonSchemaSafe(opts.body)
  if (opts.querystring) schema.querystring = toJsonSchemaSafe(opts.querystring)
  if (opts.params) schema.params = toJsonSchemaSafe(opts.params)
  return schema
}

export function buildRouteOptions(opts: BuildSchemaOptions): RouteShorthandOptions {
  return { schema: buildSchema(opts) }
}

export const swaggerSchemas = {
  success: successSchema,
  error: errorSchema,
  standard: standardResponses,
  public: publicResponses,
  callback: callbackResponses,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
