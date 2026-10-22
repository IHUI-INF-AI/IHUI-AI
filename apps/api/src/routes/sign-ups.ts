// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { desc, eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { examPapers, examSignups, lessonSignUps, lessons } from '@ihui/database'
import { requireAuth, isSystemAdmin } from '../plugins/require-permission.js'
import { success, error } from '../utils/response.js'

// =============================================================================
// GET /api/sign-ups — 我的报名记录聚合(G-962 #72: 此前全仓零注册)
// 消费方 apps/web/app/(main)/user/sign-up/page.tsx:38 以 ?userId= 拉本人报名,
// 期望形状 { list: [{ id, targetTitle, targetType, status, createdAt }] }。
// 真实数据源: lesson_sign_ups(课程报名) + exam_signups(考试报名),
// status 归一到消费方枚举 draft/published/rejected/completed。
// =============================================================================

const listQuerySchema = z.object({
  userId: z.uuid({ error: '无效的用户 ID' }),
})

const LESSON_STATUS_MAP: Record<number, string> = {
  1: 'published', // 已报名
  2: 'completed', // 已完成
  3: 'rejected', // 已退款
}

const EXAM_STATUS_MAP: Record<string, string> = {
  pending: 'draft',
  confirmed: 'published',
  cancelled: 'rejected',
}

const signUpsRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAuth)

  server.get('/', async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const currentUserId = request.userId!
    if (
      parsed.data.userId !== currentUserId &&
      !isSystemAdmin(request, { includeInternalChannel: false })
    ) {
      return reply.status(403).send(error(403, '仅可查看本人报名记录'))
    }

    const [lessonRows, examRows] = await Promise.all([
      db
        .select({
          id: lessonSignUps.id,
          targetTitle: lessons.title,
          status: lessonSignUps.status,
          createdAt: lessonSignUps.createdAt,
        })
        .from(lessonSignUps)
        .innerJoin(lessons, eq(lessons.id, lessonSignUps.lessonId))
        .where(eq(lessonSignUps.userId, parsed.data.userId))
        .orderBy(desc(lessonSignUps.createdAt)),
      db
        .select({
          id: examSignups.id,
          targetTitle: examPapers.title,
          status: examSignups.status,
          createdAt: examSignups.createdAt,
        })
        .from(examSignups)
        .innerJoin(examPapers, eq(examPapers.id, examSignups.paperId))
        .where(eq(examSignups.userId, parsed.data.userId))
        .orderBy(desc(examSignups.createdAt)),
    ])

    const list = [
      ...lessonRows.map((r) => ({
        id: r.id,
        targetTitle: r.targetTitle,
        targetType: 'lesson',
        status: LESSON_STATUS_MAP[r.status] ?? 'draft',
        createdAt: r.createdAt,
      })),
      ...examRows.map((r) => ({
        id: r.id,
        targetTitle: r.targetTitle,
        targetType: 'exam',
        status: EXAM_STATUS_MAP[r.status] ?? 'draft',
        createdAt: r.createdAt,
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return reply.send(success({ list, total: list.length }))
  })
}

export default signUpsRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
