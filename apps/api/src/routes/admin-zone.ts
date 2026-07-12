import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, asc, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { requireAdmin } from '../plugins/require-permission.js'
import { success, error, emptyToUndefined } from '../utils/response.js'
import { zhsZone } from '@ihui/database'

const idParamSchema = z.object({ id: z.string().uuid('无效的 ID') })

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  parentId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  level: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).max(5).optional()),
  enabled: z.preprocess(emptyToUndefined, z.coerce.boolean().optional()),
})

const createZoneSchema = z.object({
  name: z.string().min(1, '区域名称不能为空').max(64),
  code: z
    .string()
    .min(1)
    .max(32)
    .regex(/^[A-Z0-9_-]+$/, 'code 仅允许大写字母、数字、下划线与连字符'),
  parentId: z.string().uuid().nullable().optional(),
  level: z.number().int().min(0).max(5).default(0),
  sortOrder: z.number().int().optional(),
  enabled: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

const updateZoneSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  parentId: z.string().uuid().nullable().optional(),
  level: z.number().int().min(0).max(5).optional(),
  sortOrder: z.number().int().optional(),
  enabled: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

function buildZoneWhere(parentId?: string, level?: number, enabled?: boolean) {
  const conditions = []
  if (parentId !== undefined) conditions.push(eq(zhsZone.parentId, parentId))
  if (level !== undefined) conditions.push(eq(zhsZone.level, level))
  if (enabled !== undefined) conditions.push(eq(zhsZone.enabled, enabled))
  return conditions.length > 0 ? and(...conditions) : undefined
}

type ZoneRow = typeof zhsZone.$inferSelect

function buildTree(
  all: ZoneRow[],
  parentId: string | null,
): Array<ZoneRow & { children: unknown[] }> {
  return all
    .filter((z) => z.parentId === parentId)
    .map((z) => ({ ...z, children: buildTree(all, z.id) }))
}

export const adminZoneRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  server.get('/', async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize, parentId, level, enabled } = parsed.data
    const offset = (page - 1) * pageSize
    const where = buildZoneWhere(parentId, level, enabled)

    const list = await db
      .select()
      .from(zhsZone)
      .where(where)
      .orderBy(asc(zhsZone.level), asc(zhsZone.sortOrder))
      .limit(pageSize)
      .offset(offset)
    const countRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(zhsZone)
      .where(where)
    const total = countRows[0]?.count ?? 0
    return reply.send(success({ list, total, page, pageSize }))
  })

  server.get('/tree', async (_request, reply) => {
    const all = await db.select().from(zhsZone).orderBy(asc(zhsZone.level), asc(zhsZone.sortOrder))
    return reply.send(success({ tree: buildTree(all, null) }))
  })

  server.post('/', async (request, reply) => {
    const parsed = createZoneSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [codeExist] = await db
      .select({ id: zhsZone.id })
      .from(zhsZone)
      .where(eq(zhsZone.code, parsed.data.code))
      .limit(1)
    if (codeExist) return reply.status(400).send(error(400, '区域 code 已存在'))

    if (parsed.data.parentId) {
      const [parent] = await db
        .select({ id: zhsZone.id })
        .from(zhsZone)
        .where(eq(zhsZone.id, parsed.data.parentId))
        .limit(1)
      if (!parent) return reply.status(400).send(error(400, '父区域不存在'))
    }

    const [zone] = await db
      .insert(zhsZone)
      .values({
        name: parsed.data.name,
        code: parsed.data.code,
        parentId: parsed.data.parentId ?? null,
        level: parsed.data.level,
        sortOrder: parsed.data.sortOrder ?? 0,
        enabled: parsed.data.enabled ?? true,
        metadata: parsed.data.metadata ?? {},
      })
      .returning()
    return reply.status(201).send(success({ zone }))
  })

  server.put('/:id', async (request, reply) => {
    const paramParsed = idParamSchema.safeParse(request.params)
    if (!paramParsed.success) {
      return reply.status(400).send(error(400, paramParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const body = updateZoneSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const [existing] = await db
      .select()
      .from(zhsZone)
      .where(eq(zhsZone.id, paramParsed.data.id))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '区域不存在'))

    if (body.data.parentId === paramParsed.data.id) {
      return reply.status(400).send(error(400, '父区域不能是自身'))
    }
    if (body.data.parentId) {
      const [parent] = await db
        .select({ id: zhsZone.id })
        .from(zhsZone)
        .where(eq(zhsZone.id, body.data.parentId))
        .limit(1)
      if (!parent) return reply.status(400).send(error(400, '父区域不存在'))
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() }
    if (body.data.name !== undefined) updateData.name = body.data.name
    if (body.data.parentId !== undefined) updateData.parentId = body.data.parentId
    if (body.data.level !== undefined) updateData.level = body.data.level
    if (body.data.sortOrder !== undefined) updateData.sortOrder = body.data.sortOrder
    if (body.data.enabled !== undefined) updateData.enabled = body.data.enabled
    if (body.data.metadata !== undefined) updateData.metadata = body.data.metadata

    const [updated] = await db
      .update(zhsZone)
      .set(updateData)
      .where(eq(zhsZone.id, paramParsed.data.id))
      .returning()
    return reply.send(success({ zone: updated }))
  })

  server.delete('/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [existing] = await db
      .select({ id: zhsZone.id })
      .from(zhsZone)
      .where(eq(zhsZone.id, parsed.data.id))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '区域不存在'))

    const [child] = await db
      .select({ id: zhsZone.id })
      .from(zhsZone)
      .where(eq(zhsZone.parentId, parsed.data.id))
      .limit(1)
    if (child) return reply.status(400).send(error(400, '该区域下有子区域，无法删除'))

    await db.delete(zhsZone).where(eq(zhsZone.id, parsed.data.id))
    return reply.send(success({ id: parsed.data.id, deleted: true }))
  })
}
