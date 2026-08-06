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
