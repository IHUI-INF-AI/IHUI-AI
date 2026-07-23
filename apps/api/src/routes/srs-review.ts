/**
 * SRS 间隔复习路由(前缀 /srs-review,避开现有 /srs 流媒体路由)。
 *
 * 端点:
 * - GET  /srs-review/due     获取今日待复习列表(分页)
 * - POST /srs-review/review  提交复习结果,更新 SM-2 状态
 * - GET  /srs-review/stats   获取复习统计
 *
 * 鉴权:requireAuth(学生功能,仅需登录)。
 */

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireAuth } from '../plugins/require-permission.js'
import { success, error } from '../utils/response.js'
import {
  getDueReviews,
  submitReview,
  getReviewStats,
} from '../services/srs-review-service.js'

const reviewSchema = z.object({
  questionId: z.string().uuid('无效的题目 ID'),
  quality: z.number().int().min(0).max(5),
})

const dueQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export const srsReviewRoutes: FastifyPluginAsync = async (server) => {
  // GET /srs-review/due — 获取今日待复习列表
  server.get('/due', async (request, reply) => {
    await requireAuth(request, reply)
    if (reply.sent) return
    const parsed = dueQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const userId = request.userId!
    const result = await getDueReviews(userId, parsed.data.page, parsed.data.pageSize)
    return reply.send(success(result))
  })

  // POST /srs-review/review — 提交复习结果
  server.post('/review', async (request, reply) => {
    await requireAuth(request, reply)
    if (reply.sent) return
    const parsed = reviewSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const userId = request.userId!
    try {
      const result = await submitReview(userId, parsed.data.questionId, parsed.data.quality)
      return reply.send(success(result))
    } catch (e) {
      const msg = (e as Error).message
      if (msg.includes('不存在')) {
        return reply.status(404).send(error(404, msg))
      }
      throw e
    }
  })

  // GET /srs-review/stats — 获取复习统计
  server.get('/stats', async (request, reply) => {
    await requireAuth(request, reply)
    if (reply.sent) return
    const userId = request.userId!
    const stats = await getReviewStats(userId)
    return reply.send(success({ stats }))
  })
}
