/**
 * Fastify JSON Schema 公共片段(2026-08-12 抽取)。
 *
 * 背景:42 个路由文件各自内联重复了响应信封 schema(200 成功 + 400/401/403/404/409/500
 * 错误码),每个 ~20-30L。本模块收敛为单一来源,行为与内联版本完全等价。
 */

/** 200 成功信封 { code, message, data }(data 透传任意对象)。 */
export const okResponseSchema = {
  type: 'object',
  properties: {
    code: { type: 'number' },
    message: { type: 'string' },
    data: { type: 'object', additionalProperties: true },
  },
} as const

/** 错误信封 { code, message }(供 400/401/403/404/409/500 等状态码复用)。 */
export const errorResponseSchema = {
  type: 'object',
  properties: { code: { type: 'number' }, message: { type: 'string' } },
} as const

/**
 * 组装 response schema:200 成功 + 指定错误码列表。
 * 用法:response: buildResponseSchema(400, 401, 404)
 */
export function buildResponseSchema(...errorCodes: number[]): Record<number | string, unknown> {
  const response: Record<number | string, unknown> = { 200: okResponseSchema }
  for (const code of errorCodes) {
    response[code] = errorResponseSchema
  }
  return response
}

/** 分页 querystring 公共片段(page/pageSize,常用翻页)。 */
export const paginationQuerySchema = {
  page: { type: 'integer', minimum: 1, default: 1, description: '页码(默认 1)' },
  pageSize: {
    type: 'integer',
    minimum: 1,
    maximum: 100,
    default: 20,
    description: '每页数量(1-100,默认 20)',
  },
} as const
