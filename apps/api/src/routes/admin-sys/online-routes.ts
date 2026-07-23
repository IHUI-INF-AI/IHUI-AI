import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { success, error } from '../../utils/response.js'
import { db } from '../../db/index.js'
import { eq, and, isNull, gt, desc } from 'drizzle-orm'
import { refreshTokens, users } from '@ihui/database'

// online_router (prefix=/online) - 在线用户(基于 refresh_tokens 活跃会话)
export const onlineRoutes: FastifyPluginAsync = async (s) => {
  const ONLINE_CACHE_KEY = 'admin:online:list'
  const ONLINE_CACHE_TTL = 15

  // GET /online/list - 在线用户列表
  // 活跃会话定义:refresh_tokens 中 revokedAt IS NULL AND expiresAt > NOW()
  s.get('/list', async (request, reply) => {
    const redis = request.server.redis
    try {
      const cached = await redis.get(ONLINE_CACHE_KEY)
      if (cached) {
        const rows = JSON.parse(cached)
        return reply.send(success({ list: rows, total: rows.length }))
      }
    } catch (e) {
      request.log.error(e)
    }
    const rows = await db
      .select({
        tokenId: refreshTokens.id,
        userId: users.id,
        username: users.username,
        nickname: users.nickname,
        avatar: users.avatar,
        roleId: users.roleId,
        loginAt: refreshTokens.createdAt,
        expiresAt: refreshTokens.expiresAt,
        familyId: refreshTokens.familyId,
      })
      .from(refreshTokens)
      .innerJoin(users, eq(refreshTokens.userId, users.id))
      .where(and(isNull(refreshTokens.revokedAt), gt(refreshTokens.expiresAt, new Date())))
      .orderBy(desc(refreshTokens.createdAt))
      .limit(500)
    try {
      await redis.set(ONLINE_CACHE_KEY, JSON.stringify(rows), 'EX', ONLINE_CACHE_TTL)
    } catch (e) {
      request.log.error(e)
    }
    return reply.send(success({ list: rows, total: rows.length }))
  })

  // DELETE /online/:tokenId - 强制下线(撤销该 refresh token 会话)
  s.delete('/:tokenId', async (request, reply) => {
    const { tokenId } = z.object({ tokenId: z.string() }).parse(request.params)
    request.skipResponseSanitization = true
    const revoked = await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.id, tokenId), isNull(refreshTokens.revokedAt)))
      .returning({ id: refreshTokens.id })
    if (revoked.length === 0) {
      return reply.status(404).send(error(404, '会话不存在或已注销'))
    }
    try {
      await request.server.redis.del(ONLINE_CACHE_KEY)
    } catch (e) {
      request.log.error(e)
    }
    return reply.send(success({ tokenId, forced: true }))
  })
}
