import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireAdmin } from '../plugins/require-permission.js'
import { success, error, emptyToUndefined } from '../utils/response.js'
import {
  findAgreements,
  findAgreementById,
  findCurrentAgreement,
  createAgreement,
  updateAgreement,
  deleteAgreement,
} from '../db/agreements-queries.js'

const AGREEMENT_TYPES = ['user-agreement', 'privacy-policy', 'terms-of-service'] as const

const idParamSchema = z.object({ id: z.string().uuid('无效的 ID') })

const listQuerySchema = z.object({
  page: z.preprocess((v) => emptyToUndefined(v), z.coerce.number().min(1).default(1)),
  pageSize: z.preprocess((v) => emptyToUndefined(v), z.coerce.number().min(1).max(100).default(20)),
  type: z.preprocess((v) => emptyToUndefined(v), z.enum(AGREEMENT_TYPES).optional()),
  status: z.preprocess(
    (v) => emptyToUndefined(v),
    z.coerce.number().int().min(0).max(1).optional(),
  ),
})

const createSchema = z.object({
  type: z.enum(AGREEMENT_TYPES),
  title: z.string().min(1).max(255),
  content: z.string().min(1),
  version: z.string().min(1).max(32),
  effectiveDate: z.string().datetime(),
  status: z.number().int().min(0).max(1).optional(),
})

const updateSchema = z.object({
  type: z.enum(AGREEMENT_TYPES).optional(),
  title: z.string().min(1).max(255).optional(),
  content: z.string().min(1).optional(),
  version: z.string().min(1).max(32).optional(),
  effectiveDate: z.string().datetime().optional(),
  status: z.number().int().min(0).max(1).optional(),
})

/** 公共路由：查询当前生效协议（不需要管理员权限） */
export const agreementPublicRoutes: FastifyPluginAsync = async (server) => {
  // GET /agreements/current?type=xxx — 查询当前生效协议
  server.get('/agreements/current', async (request, reply) => {
    const parsed = z
      .object({
        type: z.preprocess((v) => emptyToUndefined(v), z.enum(AGREEMENT_TYPES)),
      })
      .safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const item = await findCurrentAgreement(parsed.data.type)
    if (!item) return reply.status(404).send(error(404, '暂无生效的协议'))
    return reply.send(success(item))
  })
}

/** 管理路由：CRUD */
export const adminAgreementsRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // GET /agreements — 列表
  server.get('/agreements', async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await findAgreements(parsed.data)
    return reply.send(success(result))
  })

  // GET /agreements/:id — 详情
  server.get('/agreements/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const item = await findAgreementById(parsed.data.id)
    if (!item) return reply.status(404).send(error(404, '协议不存在'))
    return reply.send(success(item))
  })

  // POST /agreements — 创建
  server.post('/agreements', async (request, reply) => {
    const parsed = createSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const item = await createAgreement({
      ...parsed.data,
      effectiveDate: new Date(parsed.data.effectiveDate),
      publishedBy: request.userId,
    })
    return reply.status(201).send(success(item))
  })

  // PUT /agreements/:id — 更新
  server.put('/agreements/:id', async (request, reply) => {
    const parsedParams = idParamSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return reply.status(400).send(error(400, parsedParams.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = updateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const data: Record<string, unknown> = { ...parsed.data }
    if (parsed.data.effectiveDate) {
      data.effectiveDate = new Date(parsed.data.effectiveDate)
    }
    const item = await updateAgreement(parsedParams.data.id, data as never)
    if (!item) return reply.status(404).send(error(404, '协议不存在'))
    return reply.send(success(item))
  })

  // DELETE /agreements/:id — 删除
  server.delete('/agreements/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const ok = await deleteAgreement(parsed.data.id)
    if (!ok) return reply.status(404).send(error(404, '协议不存在'))
    return reply.send(success({ deleted: true }))
  })
}
