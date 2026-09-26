// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * admin 子路由共享工具(从 admin-missing-routes.ts 拆分)。
 * 包含:分页/查询 schema、CRUD 工厂 registerCrud、fields 字段映射器、所有 body 校验 schema。
 */
import { z } from 'zod'
import { eq, ilike, desc, sql, inArray, type Column, type SQL } from 'drizzle-orm'
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core'
import { db } from '../../db/index.js'
import type { FastifyInstance } from 'fastify'
import { emptyToUndefined, success, error } from '../../utils/response.js'
import { batchWriteOutcome } from '../../utils/batch-outcome.js'

// Drizzle CRUD 工厂接受的表类型:PgTable 且含 id/createdAt 列。
// 2026-09-26:id/createdAt 由泛型 `Column` 收窄为 `PgColumn` —— 批量删除现在要用
// `.returning({ id: table.id })` 向库取确认集合,而 drizzle 的 returning 只收 PgColumn,
// 留 Column 会在编译期拒(所有真实消费方传的都是 PgColumn,收窄不减可用性)。
type CrudTable = PgTable & {
  id: PgColumn
  createdAt: PgColumn
}
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.transform(emptyToUndefined).pipe(z.string().max(200).optional()),
})

// R14: 多字段搜索 schema（comment-logs / video-logs 用）
export const commentLogQuerySchema = paginationSchema.extend({
  userUuid: z.transform(emptyToUndefined).pipe(z.string().max(64).optional()),
  commentId: z.transform(emptyToUndefined).pipe(z.coerce.number().int().optional()),
  createdAt: z.transform(emptyToUndefined).pipe(
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  ),
})

export const videoLogQuerySchema = paginationSchema.extend({
  userUuid: z.transform(emptyToUndefined).pipe(z.string().max(64).optional()),
  videoId: z.transform(emptyToUndefined).pipe(z.coerce.number().int().optional()),
  createdAt: z.transform(emptyToUndefined).pipe(
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  ),
})

export const idParamSchema = z.object({ id: z.string() })

// registerCrud 专用 id 校验:走该工厂的表 id 均为 uuid 主键,
// 非 UUID 提前 400(否则打到 PG uuid 列报错会变 500)。
const crudIdParamSchema = z.object({ id: z.uuid({ error: '无效的 ID' }) })

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

// --- auth-accounts body schema ---
export const createAuthAccountSchema = z.object({
  userId: z.string().min(1),
  platform: z.string().min(1),
  openId: z.string().max(100).optional(),
  unionId: z.string().max(100).optional(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  expiresAt: z.string().optional(),
})
export const updateAuthAccountSchema = z.object({
  platform: z.string().min(1).optional(),
  openId: z.string().max(100).optional(),
  unionId: z.string().max(100).optional(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  expiresAt: z.string().optional(),
})

// --- auth-info create body schema ---
export const createAuthInfoSchema = z.object({
  userUuid: z.string().min(1),
  phone: z.string().max(20).optional(),
  realName: z.string().max(50).optional(),
  idCard: z.string().max(20).optional(),
  authStatus: z.string().max(32).optional(),
  authSource: z.string().max(50).optional(),
})

// --- auth-tokens body schema ---
export const createAuthTokenSchema = z.object({
  userId: z.string().min(1),
  key: z.string().min(1),
  status: z.number().int().optional(),
  type: z.number().int().optional(),
  max: z.number().int().optional(),
  expiresAt: z.string().optional(),
})
export const updateAuthTokenSchema = z.object({
  status: z.number().int().optional(),
  type: z.number().int().optional(),
  max: z.number().int().optional(),
  expiresAt: z.string().optional(),
})

// --- auth-user-vip body schema ---
export const createUserVipSchema = z.object({
  userId: z.string().min(1),
  vipLevelId: z.string().optional(),
  levelValue: z.number().int().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  status: z.number().int().optional(),
  autoRenew: z.number().int().optional(),
})
export const updateUserVipSchema = z.object({
  vipLevelId: z.string().optional(),
  levelValue: z.number().int().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  status: z.number().int().optional(),
  autoRenew: z.number().int().optional(),
})

// --- user-roles update body schema ---
export const updateUserRoleSchema = z.object({
  userId: z.string().min(1).optional(),
  roleId: z.string().min(1).optional(),
  scopeResourceId: z.string().nullable().optional(),
})

// --- 2026-08-30 角色权限点配置 schema ---
export const rolePermissionsQuerySchema = z.object({
  roleId: z.string().min(1),
})

export const replaceRolePermissionsSchema = z.object({
  roleId: z.string().min(1),
  permissionIds: z.array(z.string().min(1)).max(200),
})

// --- login-logs body schema ---
export const createLoginLogSchema = z.object({
  loginName: z.string().max(50).optional(),
  ipaddr: z.string().max(50).optional(),
  loginLocation: z.string().max(255).optional(),
  browser: z.string().max(50).optional(),
  os: z.string().max(50).optional(),
  status: z.string().max(1).optional(),
  msg: z.string().max(255).optional(),
  loginTime: z.string().optional(),
})
export const updateLoginLogSchema = z.object({
  loginName: z.string().max(50).optional(),
  ipaddr: z.string().max(50).optional(),
  loginLocation: z.string().max(255).optional(),
  browser: z.string().max(50).optional(),
  os: z.string().max(50).optional(),
  status: z.string().max(1).optional(),
  msg: z.string().max(255).optional(),
  loginTime: z.string().optional(),
})

// Drizzle CRUD 工厂:接受含 id/createdAt 列的 PgTable 实例
export function registerCrud(
  server: FastifyInstance,
  basePath: string,
  table: CrudTable,
  opts: {
    searchField?: Column
    orderBy?: SQL<unknown>
    hasUpdatedAt?: boolean
    map: (body: Record<string, unknown>) => Record<string, unknown>
  },
) {
  const hasUpdatedAt = opts.hasUpdatedAt !== false
  server.get(basePath, async (request, reply) => {
    try {
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
    } catch (err) {
      server.log.error({ err }, 'registerCrud operation failed')
      return reply.status(500).send(error(500, '服务器内部错误'))
    }
  })
  server.get(`${basePath}/:id`, async (request, reply) => {
    try {
      const p = crudIdParamSchema.safeParse(request.params)
      if (!p.success) return reply.status(400).send(error(400, '无效的 ID'))
      const [row] = await db.select().from(table).where(eq(table.id, p.data.id))
      if (!row) return reply.status(404).send(error(404, '记录不存在'))
      return reply.send(success(row))
    } catch (err) {
      server.log.error({ err }, 'registerCrud getById failed')
      return reply.status(500).send(error(500, '服务器内部错误'))
    }
  })
  server.post(basePath, async (request, reply) => {
    try {
      const body = request.body as Record<string, unknown>
      const mapped = opts.map(body)
      // fields() 的 Number() 强转对非法值(如 status:'abc')产出 NaN,
      // 必须拦截——NaN 写 PG 数值列会抛错变 500 而非干净 400。
      if (Object.values(mapped).some((v) => Number.isNaN(v))) {
        return reply.status(400).send(error(400, '参数错误'))
      }
      const [row] = await db.insert(table).values(mapped).returning()
      return reply.status(201).send(success(row))
    } catch (err) {
      server.log.error({ err }, 'registerCrud operation failed')
      return reply.status(500).send(error(500, '服务器内部错误'))
    }
  })
  server.put(`${basePath}/:id`, async (request, reply) => {
    try {
      const p = crudIdParamSchema.safeParse(request.params)
      if (!p.success) return reply.status(400).send(error(400, '无效的 ID'))
      const body = request.body as Record<string, unknown>
      const set: Record<string, unknown> = { ...opts.map(body) }
      // 同 POST:非法数值强转出的 NaN 拦截为 400
      if (Object.values(set).some((v) => Number.isNaN(v))) {
        return reply.status(400).send(error(400, '参数错误'))
      }
      if (hasUpdatedAt) set.updatedAt = new Date()
      const [row] = await db.update(table).set(set).where(eq(table.id, p.data.id)).returning()
      if (!row) return reply.status(404).send(error(404, '记录不存在'))
      return reply.send(success(row))
    } catch (err) {
      server.log.error({ err }, 'registerCrud operation failed')
      return reply.status(500).send(error(500, '服务器内部错误'))
    }
  })
  server.delete(`${basePath}/:id`, async (request, reply) => {
    try {
      const p = crudIdParamSchema.safeParse(request.params)
      if (!p.success) return reply.status(400).send(error(400, '无效的 ID'))
      await db.delete(table).where(eq(table.id, p.data.id))
      return reply.send(success({ id: p.data.id, deleted: true }))
    } catch (err) {
      server.log.error({ err }, 'registerCrud operation failed')
      return reply.status(500).send(error(500, '服务器内部错误'))
    }
  })
  server.delete(basePath, async (request, reply) => {
    try {
      const parsed = z
        .object({ ids: z.string().optional().default('') })
        .safeParse(request.body ?? {})
      if (!parsed.success) return reply.status(400).send(error(400, '参数错误'))
      const idList = parsed.data.ids.split(',').filter(Boolean)
      // 批量 id 同样逐个验 UUID,防止非 UUID 打到 PG uuid 列变 500
      if (idList.length === 0 || idList.some((x) => !z.uuid().safeParse(x).success)) {
        return reply.status(400).send(error(400, '无效的 ID'))
      }
      // 修复(2026-09-26):旧写法 `deleted: idList.length` 是**请求侧自己数的**,
      // id 打错 / 行已被别人删掉 / id 属于别的表 ⇒ 一行没删也回 deleted:N。
      // 本工厂被多处 admin 路由复用(grep `registerCrud(` 取现值),故"UI 显示已删除 3 项、
      // 库里一行没动"是这些后台页的通病形态,不是一处偶发。
      // 现由库确认的 returning 集合经唯一出口 batchWriteOutcome() 推出条数,并逐条点名
      // missedIds —— 与 chat.ts batch / admin-sys role-routes cancelAll+selectAll 同一形状,
      // 不得在本文件再手写一份集合差(那正是本票要消灭的第二实现)。
      const confirmedRows = await db
        .delete(table)
        .where(inArray(table.id, idList))
        .returning({ id: table.id })
      const { affected, missedIds } = batchWriteOutcome(
        idList,
        confirmedRows.map((r) => String(r.id)),
      )
      return reply.send(success({ deleted: affected, missedIds }))
    } catch (err) {
      server.log.error({ err }, 'registerCrud operation failed')
      return reply.status(500).send(error(500, '服务器内部错误'))
    }
  })
}

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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
