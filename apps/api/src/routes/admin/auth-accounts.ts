/**
 * /api/admin/auth-accounts 路由(从 admin-missing-routes.ts 拆分)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { db } from '../../db/index.js'
import { success, error } from '../../utils/response.js'
import { userThirdPartyAccounts } from '@ihui/database'
import { eq, ilike, desc, sql, or } from 'drizzle-orm'
import {
  paginationSchema,
  idParamSchema,
  createAuthAccountSchema,
  updateAuthAccountSchema,
} from './_shared.js'

import { requireAdmin } from '../../plugins/require-permission.js'
const authAccountsRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)
  server.get('/auth-accounts', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const where = search
      ? or(
          ilike(userThirdPartyAccounts.userId, `%${search}%`),
          ilike(userThirdPartyAccounts.platform, `%${search}%`),
        )
      : undefined
    const list = await db
      .select()
      .from(userThirdPartyAccounts)
      .where(where)
      .orderBy(desc(userThirdPartyAccounts.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(userThirdPartyAccounts)
          .where(where)
      )[0]?.c ?? 0
    return reply.send(success({ list, total, page, pageSize }))
  })
  server.get('/auth-accounts/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const [row] = await db
      .select()
      .from(userThirdPartyAccounts)
      .where(eq(userThirdPartyAccounts.id, p.data.id))
      .limit(1)
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(row))
  })
  server.post('/auth-accounts', async (request, reply) => {
    const b = createAuthAccountSchema.safeParse(request.body)
    if (!b.success) return reply.status(400).send(error(400, b.error.message))
    request.skipResponseSanitization = true
    const [row] = await db
      .insert(userThirdPartyAccounts)
      .values({
        userId: b.data.userId,
        platform: b.data.platform,
        openId: b.data.openId ?? null,
        unionId: b.data.unionId ?? null,
        accessToken: b.data.accessToken ?? null,
        refreshToken: b.data.refreshToken ?? null,
        expiresAt: b.data.expiresAt ? new Date(b.data.expiresAt) : null,
      })
      .returning()
    return reply.status(201).send(success(row))
  })
  server.put('/auth-accounts/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const b = updateAuthAccountSchema.safeParse(request.body)
    if (!b.success) return reply.status(400).send(error(400, b.error.message))
    const [row] = await db
      .update(userThirdPartyAccounts)
      .set({
        ...(b.data.platform !== undefined && { platform: b.data.platform }),
        ...(b.data.openId !== undefined && { openId: b.data.openId }),
        ...(b.data.unionId !== undefined && { unionId: b.data.unionId }),
        ...(b.data.accessToken !== undefined && { accessToken: b.data.accessToken }),
        ...(b.data.refreshToken !== undefined && { refreshToken: b.data.refreshToken }),
        ...(b.data.expiresAt !== undefined && {
          expiresAt: b.data.expiresAt ? new Date(b.data.expiresAt) : null,
        }),
        updatedAt: new Date(),
      })
      .where(eq(userThirdPartyAccounts.id, p.data.id))
      .returning()
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(row))
  })
  server.delete('/auth-accounts/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const existing = await db
      .select()
      .from(userThirdPartyAccounts)
      .where(eq(userThirdPartyAccounts.id, p.data.id))
      .limit(1)
    if (existing.length === 0) return reply.status(404).send(error(404, '记录不存在'))
    await db.delete(userThirdPartyAccounts).where(eq(userThirdPartyAccounts.id, p.data.id))
    return reply.send(success({ id: p.data.id, deleted: true }))
  })
}

export default authAccountsRoutes
