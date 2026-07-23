/**
 * other 子路由共享工具(从 frontend-stub-other-routes.ts 拆分)。
 * 包含:分页/参数 schema 与解析助手。鉴权 hook 由 barrel hub 统一注册。
 */
import type { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { emptyToUndefined, error } from '../../utils/response.js'

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.preprocess(emptyToUndefined, z.string().max(200).optional()),
})

export const idParamSchema = z.object({ id: z.string() })

export function parsePagination(request: FastifyRequest, reply: FastifyReply) {
  const parsed = paginationSchema.safeParse(request.query)
  if (!parsed.success) {
    reply.status(400).send(error(400, '参数错误'))
    return null
  }
  return parsed.data
}

export function parseIdParam(request: FastifyRequest, reply: FastifyReply) {
  const parsed = idParamSchema.safeParse(request.params)
  if (!parsed.success) {
    reply.status(400).send(error(400, '参数错误'))
    return null
  }
  return parsed.data.id
}
