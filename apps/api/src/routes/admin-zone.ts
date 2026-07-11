import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { sql, type SQL } from 'drizzle-orm'
import { db } from '../db/index.js'
import { authenticate } from '../plugins/auth.js'
import { success, error, emptyToUndefined } from '../utils/response.js'

// =============================================================================
// 区域/分区管理路由 — 迁移自旧架构 api/admin/admin-zone.ts
// 挂载前缀：/api/admin/zone（由 server.ts 统一注册）
// 管理员维护地理区域与分区层级（用于按区域聚合内容/统计/资源）
// =============================================================================

const ADMIN_ROLE_ID = 1

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

// =============================================================================
// 鉴权辅助
// =============================================================================

async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  try {
    await authenticate(request)
  } catch (e) {
    const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
    const message = (e as Error).message || 'Authentication required'
    reply.status(statusCode).send(error(statusCode, message))
    return false
  }
  const roleId = request.jwtPayload?.roleId ?? 0
  if (roleId < ADMIN_ROLE_ID) {
    reply.status(403).send(error(403, '需要管理员权限'))
    return false
  }
  return true
}

// =============================================================================
// 数据库表初始化 & 查询辅助
// =============================================================================

const ZONE_COLS = sql`
  id, name, code, parent_id AS "parentId", level,
  sort_order AS "sortOrder", enabled, metadata,
  created_at AS "createdAt", updated_at AS "updatedAt"
`

async function ensureZoneTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS zhs_zone (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name varchar(64) NOT NULL,
      code varchar(32) NOT NULL UNIQUE,
      parent_id uuid,
      level integer NOT NULL DEFAULT 0,
      sort_order integer NOT NULL DEFAULT 0,
      enabled boolean NOT NULL DEFAULT true,
      metadata jsonb NOT NULL DEFAULT '{}',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `)
}

function buildZoneWhereClause(parentId?: string, level?: number, enabled?: boolean): SQL {
  const conditions: SQL[] = []
  if (parentId !== undefined) conditions.push(sql`parent_id = ${parentId}`)
  if (level !== undefined) conditions.push(sql`level = ${level}`)
  if (enabled !== undefined) conditions.push(sql`enabled = ${enabled}`)
  return conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``
}

interface ZoneRow {
  id: string
  name: string
  code: string
  parentId: string | null
  level: number
  sortOrder: number
  enabled: boolean
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

// =============================================================================
// 路由
// =============================================================================

export const adminZoneRoutes: FastifyPluginAsync = async (server) => {
  await ensureZoneTable()

  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAdmin(request, reply))) return
  })

  // GET / - 区域列表（支持按 parent/level/enabled 筛选）
  server.get('/', async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize, parentId, level, enabled } = parsed.data
    const offset = (page - 1) * pageSize
    const where = buildZoneWhereClause(parentId, level, enabled)

    const listRows = await db.execute(sql`
      SELECT ${ZONE_COLS} FROM zhs_zone ${where}
      ORDER BY level ASC, sort_order ASC
      LIMIT ${pageSize} OFFSET ${offset}
    `)
    const countRows = await db.execute(sql`
      SELECT count(*)::int AS count FROM zhs_zone ${where}
    `)
    const total = (countRows[0] as { count?: number } | undefined)?.count ?? 0
    return reply.send(
      success({ list: listRows as Record<string, unknown>[], total, page, pageSize }),
    )
  })

  // GET /tree - 区域树（递归构建父子层级）
  server.get('/tree', async (_request, reply) => {
    const rows = await db.execute(sql`
      SELECT ${ZONE_COLS} FROM zhs_zone
      ORDER BY level ASC, sort_order ASC
    `)
    const all = rows as unknown as ZoneRow[]

    const buildTree = (
      parentId: string | null,
    ): Array<ZoneRow & { children: Array<ZoneRow & { children: unknown[] }> }> =>
      all.filter((z) => z.parentId === parentId).map((z) => ({ ...z, children: buildTree(z.id) }))

    return reply.send(success({ tree: buildTree(null) }))
  })

  // POST / - 创建区域
  server.post('/', async (request, reply) => {
    const parsed = createZoneSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const codeRows = await db.execute(sql`
      SELECT id FROM zhs_zone WHERE code = ${parsed.data.code} LIMIT 1
    `)
    if (codeRows[0]) return reply.status(400).send(error(400, '区域 code 已存在'))

    if (parsed.data.parentId) {
      const parentRows = await db.execute(sql`
        SELECT id FROM zhs_zone WHERE id = ${parsed.data.parentId}
      `)
      if (!parentRows[0]) return reply.status(400).send(error(400, '父区域不存在'))
    }

    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const parentId = parsed.data.parentId ?? null
    const sortOrder = parsed.data.sortOrder ?? 0
    const enabled = parsed.data.enabled ?? true
    const metadata = parsed.data.metadata ?? {}
    await db.execute(sql`
      INSERT INTO zhs_zone (id, name, code, parent_id, level, sort_order, enabled, metadata, created_at, updated_at)
      VALUES (${id}, ${parsed.data.name}, ${parsed.data.code}, ${parentId}, ${parsed.data.level},
              ${sortOrder}, ${enabled}, ${JSON.stringify(metadata)}::jsonb, ${now}, ${now})
    `)
    const zone = {
      id,
      name: parsed.data.name,
      code: parsed.data.code,
      parentId,
      level: parsed.data.level,
      sortOrder,
      enabled,
      metadata,
      createdAt: now,
      updatedAt: now,
    }
    return reply.status(201).send(success({ zone }))
  })

  // PUT /:id - 更新区域
  server.put('/:id', async (request, reply) => {
    const paramParsed = idParamSchema.safeParse(request.params)
    if (!paramParsed.success) {
      return reply.status(400).send(error(400, paramParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const body = updateZoneSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const rows = await db.execute(sql`
      SELECT ${ZONE_COLS} FROM zhs_zone WHERE id = ${paramParsed.data.id}
    `)
    const existing = rows[0] as Record<string, unknown> | undefined
    if (!existing) return reply.status(404).send(error(404, '区域不存在'))

    if (body.data.parentId === paramParsed.data.id) {
      return reply.status(400).send(error(400, '父区域不能是自身'))
    }
    if (body.data.parentId) {
      const parentRows = await db.execute(sql`
        SELECT id FROM zhs_zone WHERE id = ${body.data.parentId}
      `)
      if (!parentRows[0]) return reply.status(400).send(error(400, '父区域不存在'))
    }

    const now = new Date().toISOString()
    const sets: SQL[] = [sql`updated_at = ${now}`]
    if (body.data.name !== undefined) sets.push(sql`name = ${body.data.name}`)
    if (body.data.parentId !== undefined) sets.push(sql`parent_id = ${body.data.parentId}`)
    if (body.data.level !== undefined) sets.push(sql`level = ${body.data.level}`)
    if (body.data.sortOrder !== undefined) sets.push(sql`sort_order = ${body.data.sortOrder}`)
    if (body.data.enabled !== undefined) sets.push(sql`enabled = ${body.data.enabled}`)
    if (body.data.metadata !== undefined)
      sets.push(sql`metadata = ${JSON.stringify(body.data.metadata)}::jsonb`)

    await db.execute(sql`
      UPDATE zhs_zone SET ${sql.join(sets, sql`, `)} WHERE id = ${paramParsed.data.id}
    `)
    const updated = { ...existing, ...body.data, updatedAt: now }
    return reply.send(success({ zone: updated }))
  })

  // DELETE /:id - 删除区域（需无子区域）
  server.delete('/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const rows = await db.execute(sql`
      SELECT id FROM zhs_zone WHERE id = ${parsed.data.id}
    `)
    if (!rows[0]) return reply.status(404).send(error(404, '区域不存在'))

    const childRows = await db.execute(sql`
      SELECT id FROM zhs_zone WHERE parent_id = ${parsed.data.id} LIMIT 1
    `)
    if (childRows[0]) return reply.status(400).send(error(400, '该区域下有子区域，无法删除'))

    await db.execute(sql`DELETE FROM zhs_zone WHERE id = ${parsed.data.id}`)
    return reply.send(success({ id: parsed.data.id, deleted: true }))
  })
}
