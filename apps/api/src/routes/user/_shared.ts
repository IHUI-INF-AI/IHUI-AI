/**
 * user 子路由共享工具(从 missing-user-routes.ts 拆分)。
 * 包含:分页/id 参数 schema + 解析辅助 + 统一鉴权 preHandler。
 */
import type { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../../plugins/auth.js'
import { error, emptyToUndefined } from '../../utils/response.js'

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.preprocess(emptyToUndefined, z.string().max(200).optional()),
})

export const idParamSchema = z.object({ id: z.string() })

/** 解析分页参数,失败返回 null 并发送 400 */
export function parsePagination(request: FastifyRequest, reply: FastifyReply) {
  const parsed = paginationSchema.safeParse(request.query)
  if (!parsed.success) {
    reply.status(400).send(error(400, '参数错误'))
    return null
  }
  return parsed.data
}

/** 解析 id 路径参数,失败返回 null 并发送 400 */
export function parseIdParam(request: FastifyRequest, reply: FastifyReply) {
  const parsed = idParamSchema.safeParse(request.params)
  if (!parsed.success) {
    reply.status(400).send(error(400, '参数错误'))
    return null
  }
  return parsed.data.id
}

/** 知识库文章列表/详情是公开内容(首页教育概览需展示给所有用户),GET 跳过鉴权 */
const isPublicKnowledgeGet = (req: FastifyRequest): boolean => {
  if (req.method !== 'GET') return false
  const path = (req.url.split('?')[0] ?? '').replace(/^\/api/, '')
  return /^\/knowledge\/?$/.test(path) || /^\/knowledge\/[^/]+\/?$/.test(path)
}

/** 统一鉴权 preHandler:所有路由都需要登录(知识库 GET 列表/详情除外) */
export async function userAuthPreHandler(request: FastifyRequest, reply: FastifyReply) {
  if (isPublicKnowledgeGet(request)) return
  try {
    await authenticate(request)
  } catch (e) {
    const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
    return reply
      .status(statusCode)
      .send(error(statusCode, (e as Error).message || 'Authentication required'))
  }
}
