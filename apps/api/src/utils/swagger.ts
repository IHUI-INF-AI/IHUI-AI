import { z } from 'zod'
import type { FastifySchema, RouteShorthandOptions } from 'fastify'

const successSchema = {
  type: 'object',
  properties: {
    code: { type: 'number', example: 0 },
    message: { type: 'string', example: 'ok' },
    data: { type: 'object', additionalProperties: true },
  },
}

const errorSchema = {
  type: 'object',
  properties: {
    code: { type: 'number', example: 1 },
    message: { type: 'string' },
  },
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
  // 调用方应传入无 transform 的 doc schema（运行时 transform schema 用于 safeParse）。
  // 此处直接调用 z.toJSONSchema：若误传 transform schema 会抛错暴露问题，而非静默降级丢失文档精度。
  if (opts.body) schema.body = z.toJSONSchema(opts.body, { target: 'openApi3' })
  if (opts.querystring) schema.querystring = z.toJSONSchema(opts.querystring, { target: 'openApi3' })
  if (opts.params) schema.params = z.toJSONSchema(opts.params, { target: 'openApi3' })
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
