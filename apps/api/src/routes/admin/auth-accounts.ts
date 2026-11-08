// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
import { isUuidString } from '../../utils/uuid.js'
import { isSystemAdminUser } from '../../db/queries.js'
import { findThirdPartyAccount } from '../../db/oauth-queries.js'
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
    if (!isUuidString(p.data.id)) return reply.status(404).send(error(404, '记录不存在'))
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
    // F-126:第三方账号绑定不得指向系统内置管理员 —— 否则绑上攻击者 openId 后
    // 走第三方登录即可直接接管 root。默认一律 403,不存在"他人代绑"的合法路径。
    if (await isSystemAdminUser(b.data.userId)) {
      return reply.status(403).send(error(403, '系统内置管理员不可绑定第三方账号'))
    }
    // 同一 (platform, openId) 已绑定到另一用户时拒绝改绑,不得覆盖既有绑定。
    if (b.data.openId) {
      const existing = await findThirdPartyAccount(b.data.platform, b.data.openId)
      if (existing && existing.userId !== b.data.userId) {
        return reply.status(409).send(error(409, '该第三方账号已绑定到其他用户'))
      }
    }
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
    if (!isUuidString(p.data.id)) return reply.status(400).send(error(400, 'id 格式不正确'))
    const b = updateAuthAccountSchema.safeParse(request.body)
    if (!b.success) return reply.status(400).send(error(400, b.error.message))
    const [existing] = await db
      .select()
      .from(userThirdPartyAccounts)
      .where(eq(userThirdPartyAccounts.id, p.data.id))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '记录不存在'))
    // F-126:同上,内置管理员的第三方绑定既不可新建也不可改写到攻击者可控的 openId。
    if (await isSystemAdminUser(existing.userId)) {
      return reply.status(403).send(error(403, '系统内置管理员不可绑定第三方账号'))
    }
    if (b.data.openId !== undefined && b.data.openId !== existing.openId) {
      const other = await findThirdPartyAccount(b.data.platform ?? existing.platform, b.data.openId)
      if (other && other.userId !== existing.userId) {
        return reply.status(409).send(error(409, '该第三方账号已绑定到其他用户'))
      }
    }
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
    // 形状闸(2026-09-28 普查收口):下面这些 :id 最终会被喂进 uuid 列,非 uuid 字面量让 Postgres
    // 抛 22P02 invalid input syntax for type uuid,而未被兜住就是 500 —— 于是"这条不存在"与
    // "服务坏了"在响应上完全同形。判据只有一份(utils/uuid.ts 的 isUuidString),闸必须在进 SQL 之前。
    if (!isUuidString(p.data.id)) return reply.status(400).send(error(400, 'id 格式不正确'))
    const existing = await db
      .select()
      .from(userThirdPartyAccounts)
      .where(eq(userThirdPartyAccounts.id, p.data.id))
      .limit(1)
    if (existing.length === 0) return reply.status(404).send(error(404, '记录不存在'))
    const removed = await db
      .delete(userThirdPartyAccounts)
      .where(eq(userThirdPartyAccounts.id, p.data.id))
      .returning({ id: userThirdPartyAccounts.id })
    return reply.send(success({ id: p.data.id, deleted: removed.length > 0 }))
  })
}

export default authAccountsRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
