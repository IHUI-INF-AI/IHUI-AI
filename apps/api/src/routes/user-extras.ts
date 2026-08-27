import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, or, sql } from 'drizzle-orm'
import { users } from '@ihui/database'
import { db } from '../db/index.js'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import { findUserById } from '../db/queries.js'

/**
 * 用户扩展接口(2026-08-26 立)
 *
 * 背景:mobile-rn QrCodeScreen / ReferrerScreen 调 /user/qr-code、/user/referrer,
 * 后端此前不存在这些端点(404)——与任务中心同类隐藏缺陷(界面在、接口无)。
 * 本路由补齐(prefix /api/user,与移动端调用路径完全一致):
 *   GET  /api/user/qr-code    — 我的二维码(邀请链接)
 *   GET  /api/user/referrer   — 我的推荐人信息 + 我的邀请码
 *   POST /api/user/referrer   — 绑定推荐人(邀请码)
 */

const bindReferrerSchema = z.object({
  code: z.string().min(1).max(32, '邀请码格式不正确'),
})

/** 站点分享路径前缀(生产环境建议配置 CDN/域名后改为绝对链接) */
function sharePath(code: string): string {
  return `/share/${code}`
}

export const userExtraRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request, reply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      return reply.status(statusCode).send(error(statusCode, (e as Error).message || '请先登录'))
    }
  })

  // GET /api/user/qr-code — 我的二维码(邀请链接)
  server.get('/qr-code', async (request, reply) => {
    const userId = request.userId!
    const user = await findUserById(userId)
    if (!user) {
      return reply.status(404).send(error(404, '用户不存在'))
    }
    const inviteCode = user.inviteCode ?? userId.slice(0, 8).toLowerCase()
    const url = sharePath(inviteCode)
    return reply.send(success({ content: url, url, inviteCode }))
  })

  // GET /api/user/referrer — 我的推荐人信息 + 我的邀请码
  server.get('/referrer', async (request, reply) => {
    const userId = request.userId!
    const user = await findUserById(userId)
    if (!user) {
      return reply.status(404).send(error(404, '用户不存在'))
    }
    let referrerName: string | null = null
    let referrerCode: string | null = null
    if (user.parentId) {
      const [parent] = await db
        .select({ nickname: users.nickname, inviteCode: users.inviteCode })
        .from(users)
        .where(eq(users.id, user.parentId))
        .limit(1)
      if (parent) {
        referrerName = parent.nickname ?? null
        referrerCode = parent.inviteCode ?? null
      }
    }
    return reply.send(
      success({ referrerName, referrerCode, code: user.inviteCode ?? userId.slice(0, 8).toLowerCase() }),
    )
  })

  // POST /api/user/referrer — 绑定推荐人(幂等:已绑定 409,自绑 400,码不存在 404)
  server.post('/referrer', async (request, reply) => {
    const userId = request.userId!
    const parsed = bindReferrerSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const user = await findUserById(userId)
    if (!user) {
      return reply.status(404).send(error(404, '用户不存在'))
    }
    if (user.parentId) {
      return reply.status(409).send(error(409, '已绑定推荐人,不可重复绑定'))
    }
    // 自绑检测:持久化 inviteCode 或 fallback(id 前 8 位)命中即拒绝
    const selfCode = user.inviteCode ?? user.id.slice(0, 8).toLowerCase()
    if (selfCode === parsed.data.code.toLowerCase()) {
      return reply.status(400).send(error(400, '不能绑定自己为推荐人'))
    }
    // 匹配:持久化 inviteCode 精确命中;未持久化的新用户支持 id 前缀(fallback 展示码)
    // 注意:users.id 是 uuid 列,LIKE 需显式 ::text cast(drizzle like() 对 uuid 生成非法 SQL)
    const [inviter] = await db
      .select({ id: users.id, inviteCode: users.inviteCode })
      .from(users)
      .where(
        or(
          eq(users.inviteCode, parsed.data.code),
          sql`${users.id}::text LIKE ${`${parsed.data.code.toLowerCase()}%`}`,
        ),
      )
      .limit(1)
    if (!inviter) {
      return reply.status(404).send(error(404, '邀请码不存在'))
    }
    await db.update(users).set({ parentId: inviter.id }).where(eq(users.id, userId))
    return reply.send(success({ parentId: inviter.id }))
  })
}
