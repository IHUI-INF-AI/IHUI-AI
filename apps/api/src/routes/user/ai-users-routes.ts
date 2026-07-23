/**
 * /ai/users/* 8 端点(ZHS 旧项目 admin-member 残留补齐)。
 * 数据源:沿用 users 表(uuid = id);无独立 ai_user 表,简化复用系统用户。
 */
import type { FastifyPluginAsync } from 'fastify'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { eq, asc, sql } from 'drizzle-orm'
import { success, error } from '../../utils/response.js'
import { db } from '../../db/index.js'
import { users } from '@ihui/database'
import { isSystemAdminUser } from '../../db/queries.js'
import { parsePagination } from './_shared.js'

const aiUserItemSchema = z.object({
  id: z.string().min(1).max(64).optional(),
  uuid: z.string().min(1).max(64).optional(),
  nickname: z.string().min(1).max(64).optional(),
  username: z.string().min(1).max(64).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(32).optional().nullable(),
  avatar: z.string().max(500).optional().nullable(),
  platform: z.string().max(64).optional(),
  identity: z.string().max(64).optional(),
  status: z.number().int().optional(),
})

const aiUsersRoutes: FastifyPluginAsync = async (server) => {
  server.get('/ai/users/list', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const rows = await db
      .select({
        id: users.id,
        uuid: users.id,
        username: users.username,
        nickname: users.nickname,
        email: users.email,
        phone: users.phone,
        avatar: users.avatar,
        status: users.status,
        platform: sql<string>`'system'`,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(asc(users.createdAt))
      .limit(q.pageSize)
      .offset((q.page - 1) * q.pageSize)
    const totalRows = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(users)
    const total = totalRows[0]?.total ?? 0
    return reply.send(
      success({
        list: rows.map((r) => ({ ...r, createdAt: r.createdAt?.toISOString() ?? null })),
        total,
        page: q.page,
        pageSize: q.pageSize,
      }),
    )
  })

  server.get<{ Params: { uuid: string } }>('/ai/users/:uuid', async (request, reply) => {
    const { uuid } = request.params
    const [row] = await db
      .select({
        id: users.id,
        uuid: users.id,
        username: users.username,
        nickname: users.nickname,
        email: users.email,
        phone: users.phone,
        avatar: users.avatar,
        status: users.status,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, uuid))
      .limit(1)
    if (!row) return reply.status(404).send(error(404, '用户不存在'))
    return reply.send(success({ ...row, createdAt: row.createdAt?.toISOString() ?? null }))
  })

  server.post('/ai/users', async (request, reply) => {
    const body = aiUserItemSchema.safeParse(request.body ?? {})
    if (!body.success) return reply.status(400).send(error(400, '参数错误'))
    const id = body.data.id ?? randomUUID()
    const now = new Date()
    await db.insert(users).values({
      id,
      username: body.data.username ?? `ai_${id.slice(0, 8)}`,
      nickname: body.data.nickname ?? 'AI 用户',
      email: body.data.email ?? null,
      phone: body.data.phone ?? null,
      avatar: body.data.avatar ?? null,
      status: body.data.status ?? 1,
      createdAt: now,
      updatedAt: now,
    } as never)
    return reply.status(201).send(success({ id, uuid: id, success: true }))
  })

  server.put('/ai/users', async (request, reply) => {
    const body = aiUserItemSchema.safeParse(request.body ?? {})
    if (!body.success) return reply.status(400).send(error(400, '参数错误'))
    if (!body.data.id && !body.data.uuid)
      return reply.status(400).send(error(400, '缺少 id'))
    const id = body.data.id ?? body.data.uuid!
    const patch: Record<string, unknown> = { updatedAt: new Date() }
    if (body.data.nickname !== undefined) patch.nickname = body.data.nickname
    if (body.data.email !== undefined) patch.email = body.data.email
    if (body.data.phone !== undefined) patch.phone = body.data.phone
    if (body.data.avatar !== undefined) patch.avatar = body.data.avatar
    if (body.data.status !== undefined) patch.status = body.data.status
    await db.update(users).set(patch as never).where(eq(users.id, id))
    return reply.send(success({ id, success: true }))
  })

  server.delete<{ Params: { uuid: string } }>('/ai/users/:uuid', async (request, reply) => {
    const { uuid } = request.params
    if (await isSystemAdminUser(uuid)) {
      return reply.status(403).send(error(403, '系统内置用户不可删除'))
    }
    await db.delete(users).where(eq(users.id, uuid))
    return reply.send(success({ success: true }))
  })

  server.post('/ai/users/set/user/identity', async (request, reply) => {
    const body = z
      .object({
        uuid: z.string().min(1),
        identity: z.string().max(64).optional(),
      })
      .safeParse(request.body ?? {})
    if (!body.success) return reply.status(400).send(error(400, '参数错误'))
    await db
      .update(users)
      .set({ role: body.data.identity ?? null, updatedAt: new Date() } as never)
      .where(eq(users.id, body.data.uuid))
    return reply.send(success({ success: true }))
  })

  server.get('/ai/users/platform/list', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const rows = await db
      .select({
        id: users.id,
        uuid: users.id,
        username: users.username,
        nickname: users.nickname,
        email: users.email,
        platform: sql<string>`'system'`,
        status: users.status,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(asc(users.createdAt))
      .limit(q.pageSize)
      .offset((q.page - 1) * q.pageSize)
    return reply.send(
      success({
        list: rows.map((r) => ({ ...r, createdAt: r.createdAt?.toISOString() ?? null })),
        total: rows.length,
        page: q.page,
        pageSize: q.pageSize,
      }),
    )
  })

  server.post('/ai/userSysLink', async (request, reply) => {
    const body = z
      .object({
        userId: z.string().min(1),
        sysUserId: z.string().min(1),
        platform: z.string().max(64).optional(),
      })
      .safeParse(request.body ?? {})
    if (!body.success) return reply.status(400).send(error(400, '参数错误'))
    return reply.send(
      success({
        success: true,
        userId: body.data.userId,
        sysUserId: body.data.sysUserId,
        linkedAt: new Date().toISOString(),
      }),
    )
  })
}

export default aiUsersRoutes
