import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../plugins/auth.js'
import { success, error, emptyToUndefined } from '../utils/response.js'
import {
  findSensitiveWords,
  findSensitiveWordById,
  createSensitiveWord,
  updateSensitiveWord,
  deleteSensitiveWord,
  filterSensitiveContent,
} from '../db/sensitive-words-queries.js'

const ADMIN_ROLE_ID = 1

// 分类 ID 使用中性英文标识符,避免敏感词进入 LLM 上下文(同步前端 helpers.ts)
// 历史 DB 数据若含旧值(porn/abuse),需运行迁移:UPDATE sensitive_words SET category='explicit' WHERE category='porn'; SET category='harassment' WHERE category='abuse';
const CATEGORIES = ['default', 'politics', 'explicit', 'ads', 'harassment'] as const

const idParamSchema = z.object({ id: z.string().uuid('无效的 ID') })

const listQuerySchema = z.object({
  page: z.preprocess((v) => emptyToUndefined(v), z.coerce.number().min(1).default(1)),
  pageSize: z.preprocess((v) => emptyToUndefined(v), z.coerce.number().min(1).max(100).default(20)),
  category: z.preprocess((v) => emptyToUndefined(v), z.enum(CATEGORIES).optional()),
  status: z.preprocess(
    (v) => emptyToUndefined(v),
    z.coerce.number().int().min(0).max(1).optional(),
  ),
})

const createSchema = z.object({
  word: z.string().min(1).max(128),
  category: z.enum(CATEGORIES).optional(),
  level: z.number().int().min(1).max(3).optional(),
  replacement: z.string().max(128).optional(),
  status: z.number().int().min(0).max(1).optional(),
})

const updateSchema = z.object({
  word: z.string().min(1).max(128).optional(),
  category: z.enum(CATEGORIES).optional(),
  level: z.number().int().min(1).max(3).optional(),
  replacement: z.string().max(128).optional(),
  status: z.number().int().min(0).max(1).optional(),
})

const filterSchema = z.object({
  text: z.string().min(1).max(10000),
})

export const adminSensitiveWordsRoutes: FastifyPluginAsync = async (server) => {
  // 统一管理员鉴权
  server.addHook('preHandler', async (request, reply) => {
    try {
      await authenticate(request)
    } catch {
      return reply.status(401).send(error(401, '未授权'))
    }
    const roleId = request.jwtPayload?.roleId ?? 0
    if (roleId < ADMIN_ROLE_ID) {
      return reply.status(403).send(error(403, '需要管理员权限'))
    }
  })

  // GET /sensitive-words — 列表
  server.get('/sensitive-words', async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await findSensitiveWords(parsed.data)
    return reply.send(success(result))
  })

  // GET /sensitive-words/:id — 详情
  server.get('/sensitive-words/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const item = await findSensitiveWordById(parsed.data.id)
    if (!item) return reply.status(404).send(error(404, '敏感词不存在'))
    return reply.send(success(item))
  })

  // POST /sensitive-words — 创建
  server.post('/sensitive-words', async (request, reply) => {
    const parsed = createSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const item = await createSensitiveWord(parsed.data)
    return reply.status(201).send(success(item))
  })

  // PUT /sensitive-words/:id — 更新
  server.put('/sensitive-words/:id', async (request, reply) => {
    const parsedParams = idParamSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return reply.status(400).send(error(400, parsedParams.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = updateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const item = await updateSensitiveWord(parsedParams.data.id, parsed.data)
    if (!item) return reply.status(404).send(error(404, '敏感词不存在'))
    return reply.send(success(item))
  })

  // DELETE /sensitive-words/:id — 删除
  server.delete('/sensitive-words/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const ok = await deleteSensitiveWord(parsed.data.id)
    if (!ok) return reply.status(404).send(error(404, '敏感词不存在'))
    return reply.send(success({ deleted: true }))
  })

  // POST /sensitive-words/filter — 内容过滤
  server.post('/sensitive-words/filter', async (request, reply) => {
    const parsed = filterSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await filterSensitiveContent(parsed.data.text)
    return reply.send(success(result))
  })
}
