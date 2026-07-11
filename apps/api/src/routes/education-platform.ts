import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, desc, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { educationPlatform, educationSyncLog } from '@ihui/database'
import { requireAdmin } from '../plugins/require-permission.js'
import { success, error, emptyToUndefined } from '../utils/response.js'

const pidParamSchema = z.object({ pid: z.coerce.number().int().min(1) })

const listQuerySchema = z.object({
  status: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).max(1).optional()),
})

const createSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(50),
  type: z.string().max(20).optional(),
  apiUrl: z.string().max(500).optional(),
  apiKey: z.string().max(200).optional(),
  apiSecret: z.string().max(200).optional(),
  config: z.string().optional(),
  syncUrl: z.string().max(500).optional(),
  description: z.string().optional(),
})

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  apiUrl: z.string().max(500).optional(),
  apiKey: z.string().max(200).optional(),
  apiSecret: z.string().max(200).optional(),
  status: z.coerce.number().int().min(0).max(1).optional(),
  config: z.string().optional(),
})

const syncSchema = z.object({
  type: z.string().max(20).optional(),
  syncType: z.string().max(20).optional(),
})

const syncLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  platformCode: z.preprocess(emptyToUndefined, z.string().max(50).optional()),
})

export const educationPlatformRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // GET /list - 教育平台列表
  server.get('/list', async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const where =
      parsed.data.status !== undefined
        ? eq(educationPlatform.status, parsed.data.status)
        : undefined
    const list = await db
      .select()
      .from(educationPlatform)
      .where(where)
      .orderBy(desc(educationPlatform.id))
    return reply.send(success(list))
  })

  // POST / - 新增教育平台
  server.post('/', async (request, reply) => {
    const parsed = createSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [platform] = await db
      .insert(educationPlatform)
      .values({
        name: parsed.data.name,
        code: parsed.data.code,
        type: parsed.data.type ?? 'mooc',
        apiUrl: parsed.data.apiUrl,
        apiKey: parsed.data.apiKey,
        apiSecret: parsed.data.apiSecret,
        config: parsed.data.config,
        syncUrl: parsed.data.syncUrl,
        description: parsed.data.description,
        status: 1,
      })
      .returning()
    if (!platform) return reply.status(500).send(error(500, '创建平台失败'))
    return reply.status(201).send(success({ id: platform.id }))
  })

  // PUT /:pid - 修改教育平台
  server.put('/:pid', async (request, reply) => {
    const paramParsed = pidParamSchema.safeParse(request.params)
    if (!paramParsed.success) {
      return reply.status(400).send(error(400, paramParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = updateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { pid } = paramParsed.data
    const [existing] = await db
      .select()
      .from(educationPlatform)
      .where(eq(educationPlatform.id, pid))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '平台不存在'))
    const [updated] = await db
      .update(educationPlatform)
      .set({
        ...(parsed.data.name !== undefined && { name: parsed.data.name }),
        ...(parsed.data.apiUrl !== undefined && { apiUrl: parsed.data.apiUrl }),
        ...(parsed.data.apiKey !== undefined && { apiKey: parsed.data.apiKey }),
        ...(parsed.data.apiSecret !== undefined && { apiSecret: parsed.data.apiSecret }),
        ...(parsed.data.status !== undefined && { status: parsed.data.status }),
        ...(parsed.data.config !== undefined && { config: parsed.data.config }),
        updatedAt: new Date(),
      })
      .where(eq(educationPlatform.id, pid))
      .returning()
    if (!updated) return reply.status(500).send(error(500, '更新平台失败'))
    return reply.send(success({ id: updated.id }))
  })

  // DELETE /:pid - 删除教育平台
  server.delete('/:pid', async (request, reply) => {
    const paramParsed = pidParamSchema.safeParse(request.params)
    if (!paramParsed.success) {
      return reply.status(400).send(error(400, paramParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { pid } = paramParsed.data
    const [existing] = await db
      .select()
      .from(educationPlatform)
      .where(eq(educationPlatform.id, pid))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '平台不存在'))
    await db.delete(educationPlatform).where(eq(educationPlatform.id, pid))
    return reply.send(success({ deleted: true }))
  })

  // POST /:pid/sync - 同步数据
  server.post('/:pid/sync', async (request, reply) => {
    const paramParsed = pidParamSchema.safeParse(request.params)
    if (!paramParsed.success) {
      return reply.status(400).send(error(400, paramParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = syncSchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { pid } = paramParsed.data
    const [platform] = await db
      .select()
      .from(educationPlatform)
      .where(eq(educationPlatform.id, pid))
      .limit(1)
    if (!platform) return reply.status(404).send(error(404, '平台不存在'))
    const [log] = await db
      .insert(educationSyncLog)
      .values({
        platformCode: platform.code,
        type: parsed.data.type ?? 'course',
        syncType: parsed.data.syncType ?? 'pull',
        success: true,
        recordCount: 0,
      })
      .returning()
    if (!log) return reply.status(500).send(error(500, '创建同步日志失败'))
    await db
      .update(educationPlatform)
      .set({ lastSyncTime: new Date(), updatedAt: new Date() })
      .where(eq(educationPlatform.id, pid))
    return reply.send(success({ id: log.id, platformCode: platform.code }))
  })

  // GET /sync/log - 同步日志
  server.get('/sync/log', async (request, reply) => {
    const parsed = syncLogQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize, platformCode } = parsed.data
    const offset = (page - 1) * pageSize
    const where = platformCode ? eq(educationSyncLog.platformCode, platformCode) : undefined
    const [list, totalRows] = await Promise.all([
      db
        .select()
        .from(educationSyncLog)
        .where(where)
        .orderBy(desc(educationSyncLog.id))
        .limit(pageSize)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(educationSyncLog)
        .where(where),
    ])
    return reply.send(success({ list, total: totalRows[0]?.count ?? 0, page, pageSize }))
  })
}
