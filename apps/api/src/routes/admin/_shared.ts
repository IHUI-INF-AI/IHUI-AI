/**
 * admin 子路由共享工具(从 admin-missing-routes.ts 拆分)。
 * 包含:分页/查询 schema、CRUD 工厂 registerCrud、fields 字段映射器、所有 body 校验 schema。
 */
import { z } from 'zod'
import { eq, ilike, desc, sql, inArray, type Column, type SQL } from 'drizzle-orm'
import { db } from '../../db/index.js'
import type { FastifyInstance } from 'fastify'
import { emptyToUndefined, success, error } from '../../utils/response.js'
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.preprocess(emptyToUndefined, z.string().max(200).optional()),
})

// R14: 多字段搜索 schema（comment-logs / video-logs 用）
export const commentLogQuerySchema = paginationSchema.extend({
  userUuid: z.preprocess(emptyToUndefined, z.string().max(64).optional()),
  commentId: z.preprocess(emptyToUndefined, z.coerce.number().int().optional()),
  createdAt: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  ),
})

export const videoLogQuerySchema = paginationSchema.extend({
  userUuid: z.preprocess(emptyToUndefined, z.string().max(64).optional()),
  videoId: z.preprocess(emptyToUndefined, z.coerce.number().int().optional()),
  createdAt: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  ),
})

export const idParamSchema = z.object({ id: z.string() })

// --- 11 条升级路由的 body 校验 schema ---
export const updateAuthInfoSchema = z.object({
  phone: z.string().nullable().optional(),
  authStatus: z.string().optional(),
  realName: z.string().nullable().optional(),
})

export const createRoleSchema = z.object({
  name: z.string().min(1),
  displayName: z.string().min(1),
  description: z.string().nullable().optional(),
  scope: z.string().optional(),
})

export const updateRoleSchema = z.object({
  name: z.string().min(1).optional(),
  displayName: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  scope: z.string().optional(),
})

export const createVipLevelSchema = z.object({
  levelName: z.string().min(1),
  levelValue: z.number().int().optional(),
  price: z.number().int().optional(),
  durationDays: z.number().int().optional(),
  status: z.number().int().optional(),
  sortOrder: z.number().int().optional(),
})

export const updateVipLevelSchema = z.object({
  levelName: z.string().min(1).optional(),
  levelValue: z.number().int().optional(),
  price: z.number().int().optional(),
  durationDays: z.number().int().optional(),
  status: z.number().int().optional(),
  sortOrder: z.number().int().optional(),
})

export const createSmsTemplateSchema = z.object({
  code: z.string().min(1),
  title: z.string().min(1),
  content: z.string().min(1),
  status: z.number().int().optional(),
})

export const updateSmsTemplateSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  status: z.number().int().optional(),
})

export const createUserRoleSchema = z.object({
  userId: z.string().min(1),
  roleId: z.string().min(1),
  scopeResourceId: z.string().nullable().optional(),
})

export const createPermissionSchema = z.object({
  name: z.string().min(1),
  displayName: z.string().min(1),
  resource: z.string().min(1),
  action: z.string().min(1),
  description: z.string().nullable().optional(),
})

export const updatePermissionSchema = z.object({
  name: z.string().min(1).optional(),
  displayName: z.string().min(1).optional(),
  resource: z.string().min(1).optional(),
  action: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
})


export function registerCrud(
  server: FastifyInstance,
  basePath: string,
  table: any,
  opts: {
    searchField?: Column
    orderBy?: SQL<unknown>
    hasUpdatedAt?: boolean
    map: (body: Record<string, unknown>) => Record<string, unknown>
  },
) {
  const hasUpdatedAt = opts.hasUpdatedAt !== false
  server.get(basePath, async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const where = search && opts.searchField ? ilike(opts.searchField, `%${search}%`) : undefined
    const list = await db
      .select()
      .from(table)
      .where(where)
      .orderBy(opts.orderBy ?? desc(table.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(table)
          .where(where)
      )[0]?.c ?? 0
    return reply.send(success({ list, total, page, pageSize }))
  })
  server.post(basePath, async (request, reply) => {
    const body = request.body as Record<string, unknown>
    const [row] = await db.insert(table).values(opts.map(body)).returning()
    return reply.status(201).send(success(row))
  })
  server.put(`${basePath}/:id`, async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const body = request.body as Record<string, unknown>
    const set: Record<string, unknown> = { ...opts.map(body) }
    if (hasUpdatedAt) set.updatedAt = new Date()
    const [row] = await db.update(table).set(set).where(eq(table.id, p.data.id)).returning()
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(row))
  })
  server.delete(`${basePath}/:id`, async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    await db.delete(table).where(eq(table.id, p.data.id))
    return reply.send(success({ id: p.data.id, deleted: true }))
  })
  server.delete(basePath, async (request, reply) => {
    const parsed = z
      .object({ ids: z.string().optional().default('') })
      .safeParse(request.body ?? {})
    if (!parsed.success) return reply.status(400).send(error(400, '参数错误'))
    const idList = parsed.data.ids.split(',').filter(Boolean)
    if (idList.length === 0) return reply.status(400).send(error(400, '参数错误'))
    await db.delete(table).where(inArray(table.id, idList))
    return reply.send(success({ deleted: idList.length }))
  })
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'json'
export function fields(fc: Record<string, FieldType>) {
  return (b: Record<string, unknown>) => {
    const o: Record<string, unknown> = {}
    for (const [k, t] of Object.entries(fc)) {
      if (b[k] === undefined) continue
      const v = b[k]
      if (t === 'string') o[k] = v === null ? null : String(v)
      else if (t === 'number') o[k] = v === null ? null : Number(v)
      else if (t === 'boolean') o[k] = v === null ? null : Boolean(v)
      else if (t === 'date') o[k] = v ? new Date(String(v)) : null
      else o[k] = v
    }
    return o
  }
}
