/**
 * /api/admin/member/users 路由(从 admin-missing-routes.ts 拆分)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { success, error } from '../../utils/response.js'
import { users } from '@ihui/database'
import { eq, notInArray, ilike, desc, sql, and, or } from 'drizzle-orm'
import { paginationSchema, idParamSchema } from './_shared.js'
import { isSystemAdminUser } from '../../db/queries.js'

import { requireAdmin } from '../../plugins/require-permission.js'
const memberUsersRoutes: FastifyPluginAsync = async (server) => {
  // admin 会员列表/详情含 phone/email,需跳过响应脱敏
  // 防止 response-sanitizer 把敏感字段误伤为 '***'
  server.addHook('onRequest', async (request) => {
    request.skipResponseSanitization = true
  })

  server.addHook('preHandler', requireAdmin)
  server.get('/member/users', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const status = z.coerce
      .number()
      .int()
      .optional()
      .safeParse((request.query as { status?: string }).status)
    if (!status.success) return reply.status(400).send(error(400, 'status 参数错误'))
    const level = z.coerce
      .number()
      .int()
      .min(0)
      .max(3)
      .optional()
      .safeParse((request.query as { level?: string }).level)
    if (!level.success) return reply.status(400).send(error(400, 'level 参数需为 0-3 的整数'))
    const includeDeleted = (request.query as { includeDeleted?: string }).includeDeleted === 'true'
    const conds = []
    if (search)
      conds.push(
        or(
          ilike(users.username, `%${search}%`),
          ilike(users.nickname, `%${search}%`),
          ilike(users.phone, `%${search}%`),
          ilike(users.email, `%${search}%`),
        ),
      )
    if (status.success && status.data !== undefined) {
      conds.push(eq(users.status, status.data))
    } else if (!includeDeleted) {
      conds.push(notInArray(users.status, [3]))
    }
    if (level.success && level.data !== undefined) {
      conds.push(eq(users.level, level.data))
    }
    const where = conds.length > 0 ? and(...conds) : undefined
    const list = await db
      .select({
        id: users.id,
        username: users.username,
        nickname: users.nickname,
        phone: users.phone,
        email: users.email,
        roleId: users.roleId,
        status: users.status,
        level: users.level,
        isVip: users.isVip,
        isSystemAdmin: users.isSystemAdmin,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(users)
          .where(where)
      )[0]?.c ?? 0
    return reply.send(success({ list, total, page, pageSize }))
  })
  // GET /member/users/:id — 单用户详情(脱敏,不含 password_hash)
  server.get('/member/users/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const [row] = await db
      .select({
        id: users.id,
        username: users.username,
        nickname: users.nickname,
        phone: users.phone,
        email: users.email,
        avatar: users.avatar,
        bio: users.bio,
        gender: users.gender,
        roleId: users.roleId,
        status: users.status,
        level: users.level,
        isVip: users.isVip,
        isSystemAdmin: users.isSystemAdmin,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, p.data.id))
      .limit(1)
    if (!row) return reply.status(404).send(error(404, '用户不存在'))
    return reply.send(success(row))
  })
  server.patch('/member/users/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    if (await isSystemAdminUser(p.data.id)) {
      return reply.status(403).send(error(403, '系统内置管理员不可修改'))
    }
    const b = z
      .object({
        status: z.number().int().optional(),
        level: z.number().int().min(0).max(3).optional(),
      })
      .safeParse(request.body)
    if (!b.success) return reply.status(400).send(error(400, '参数错误'))
    if (b.data.status === undefined && b.data.level === undefined) {
      return reply.status(400).send(error(400, 'status 与 level 至少需提供一个'))
    }
    const sets: Record<string, unknown> = { updatedAt: new Date() }
    if (b.data.status !== undefined) sets.status = b.data.status
    if (b.data.level !== undefined) sets.level = b.data.level
    const [row] = await db.update(users).set(sets).where(eq(users.id, p.data.id)).returning()
    if (!row) return reply.status(404).send(error(404, '用户不存在'))
    return reply.send(success(row))
  })
  server.post('/member/users', async (request, reply) => {
    const b = z
      .object({
        nickname: z.string().min(1),
        phone: z.string().optional(),
        email: z.string().email().optional(),
        password: z.string().min(6, '密码至少 6 位'),
        roleId: z.number().int().optional(),
        status: z.number().int().optional(),
        level: z.number().int().min(0).max(3).optional(),
      })
      .safeParse(request.body)
    if (!b.success) return reply.status(400).send(error(400, '参数错误'))
    if (!b.data.phone && !b.data.email)
      return reply.status(400).send(error(400, 'phone 与 email 至少需提供一个'))
    const bcrypt = (await import('bcryptjs')).default
    const [row] = await db
      .insert(users)
      .values({
        nickname: b.data.nickname,
        phone: b.data.phone,
        email: b.data.email,
        passwordHash: bcrypt.hashSync(b.data.password, 10),
        roleId: b.data.roleId ?? 0,
        status: b.data.status ?? 1,
        level: b.data.level ?? 0,
      })
      .returning()
    if (!row) return reply.status(500).send(error(500, '创建失败'))
    return reply.status(201).send(success(row))
  })
  server.delete('/member/users/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    if (await isSystemAdminUser(p.data.id)) {
      return reply.status(403).send(error(403, '系统内置管理员不可删除'))
    }
    const [row] = await db
      .update(users)
      .set({ status: 3, updatedAt: new Date() })
      .where(eq(users.id, p.data.id))
      .returning()
    if (!row) return reply.status(404).send(error(404, '用户不存在'))
    return reply.send(success({ user: row }))
  })
}

export default memberUsersRoutes
