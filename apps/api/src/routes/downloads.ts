/**
 * 下载量统计路由 — 2026-08-06 新增。
 *
 * 端点:
 *  - POST /track   记录下载点击事件(可选登录,匿名也记录 userId=null)
 *  - GET  /stats   管理员查询下载统计(roleId >= 1)
 *
 * 设计:
 *  - POST /track 不因未登录返回 401,匿名用户也记录
 *  - POST /track 的 trackEvent 静默失败,不阻断下载
 *  - GET /stats 需管理员权限(preHandler: requireAdmin)
 */

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../plugins/auth.js'
import { requireAdmin } from '../plugins/require-permission.js'
import { success, error } from '../utils/response.js'
import {
  trackEvent,
  getStats,
  type TrackEventInput,
  type StatsQuery,
} from '../services/download-stats-service.js'

const trackBodySchema = z.object({
  platform: z.enum([
    'web',
    'desktop',
    'ios',
    'android-apk',
    'mobile',
    'wechat-miniapp',
    'extension',
    'cli',
  ]),
  assetHref: z.string().max(2048).optional(),
  source: z.enum(['sidebar', 'detail_page']),
})

const statsQuerySchema = z.object({
  platform: z.string().max(32).optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be YYYY-MM-DD')
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate must be YYYY-MM-DD')
    .optional(),
})

export const downloadsRoutes: FastifyPluginAsync = async (server) => {
  // -------------------------------------------------------------------------
  // POST /track - 记录下载点击事件
  // 可选登录:token 有效则记录 userId,无 token / token 无效则 userId=null
  // -------------------------------------------------------------------------
  server.post('/track', async (request, reply) => {
    const parsed = trackBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    let userId: string | null = null
    try {
      await authenticate(request)
      userId = request.userId ?? null
    } catch {
      // 匿名用户:userId 保持 null,继续记录事件
    }

    const input: TrackEventInput = {
      userId,
      platform: parsed.data.platform,
      assetHref: parsed.data.assetHref ?? null,
      source: parsed.data.source,
      ip: request.ip ?? null,
      userAgent: (request.headers['user-agent'] as string | undefined) ?? null,
    }

    const result = await trackEvent(input)
    return reply.send(success({ eventId: result.eventId }))
  })

  // -------------------------------------------------------------------------
  // GET /stats - 管理员查询下载统计
  // -------------------------------------------------------------------------
  server.get('/stats', { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = statsQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    const query: StatsQuery = {
      platform: parsed.data.platform,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
    }

    try {
      const stats = await getStats(query)
      return reply.send(success(stats))
    } catch (e) {
      console.error('[downloads] getStats failed:', e)
      return reply.status(500).send(error(500, '服务器错误'))
    }
  })
}
