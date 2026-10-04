// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 浏览历史(member/history 页的载体)。
 *
 * 背景:该页此前 GET/DELETE 打的 /api/history **两端点都不存在** —— 页面恒 404,
 * "清空历史"是死按钮。仓里也没有可复用的表(对话历史/搜索条件历史/发布历史语义都不同;
 * visit_logs 是 URL/IP 埋点,没有"目标 id"维度),故新建 user_browse_history。
 *
 * 字段名口径:targetType / targetId —— 与共享契约 BookmarkItem
 * (packages/types/src/app.ts:196-197,注释明写"与后端 /api/favorites 契约对齐")一致。
 *
 * 归属铁律:三个端点全部按 request.userId 过滤/写入,列表与 count 两条查询都要带。
 * 只过滤其中一条就是**跨用户数据泄露**,而"返回 200 + 有 list"这类断言对它全绿。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, desc, sql } from 'drizzle-orm'
import { success, error } from '../../utils/response.js'
import { db, dbRead } from '../../db/index.js'
import { userBrowseHistory } from '@ihui/database'
import { parsePagination } from './_shared.js'

/** 上报体:targetType 白名单与前端页面的值域对齐(project|file|doc|post)。 */
const visitBodySchema = z.object({
  targetType: z.enum(['project', 'file', 'doc', 'post']),
  // 128 与建表列宽一致;字符集同 idParamSchema —— 放行 uuid 与 slug 两种形态,
  // 但挡住 / \ . 等路径分隔符(防路径穿越类输入)
  targetId: z
    .string()
    .regex(/^[a-zA-Z0-9_-]+$/, '无效的目标 ID')
    .max(128, '目标 ID 过长'),
  title: z.string().max(200).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export const historyRoutes: FastifyPluginAsync = async (server) => {
  // GET /history — 当前用户的浏览历史(按最近访问倒序)
  server.get('/history', async (request, reply) => {
    const page = parsePagination(request, reply)
    if (page === null) return
    const { page: pageNo, pageSize } = page
    const rows = await dbRead
      .select()
      .from(userBrowseHistory)
      .where(eq(userBrowseHistory.userId, request.userId!))
      .orderBy(desc(userBrowseHistory.visitedAt))
      .limit(pageSize)
      .offset((pageNo - 1) * pageSize)
    const countRows = await dbRead
      .select({ count: sql<number>`count(*)::int` })
      .from(userBrowseHistory)
      .where(eq(userBrowseHistory.userId, request.userId!))
    const total = countRows[0]?.count ?? 0
    const list = rows.map((r) => ({
      id: r.id,
      targetType: r.targetType,
      targetId: r.targetId,
      title: r.title,
      visitedAt: r.visitedAt,
    }))
    return reply.send(success({ list, total, page: pageNo, pageSize }))
  })

  // DELETE /history — 物理全清当前用户的浏览历史("清空"按钮的落地)
  // 用 returning({id}) 数真实删掉的行数,而不是 affectedRowCount 猜。
  server.delete('/history', async (request, reply) => {
    const deleted = await db
      .delete(userBrowseHistory)
      .where(eq(userBrowseHistory.userId, request.userId!))
      .returning({ id: userBrowseHistory.id })
    return reply.send(success({ deletedCount: deleted.length }))
  })

  // POST /history/visit — 浏览行为上报(写入侧唯一入口)
  // 幂等:复合唯一 (user_id,target_id,target_type) + onConflictDoUpdate 只刷 visited_at,
  // 同一目标重复上报**不产生第二行**,只更新时间。
  server.post('/history/visit', async (request, reply) => {
    const body = visitBodySchema.safeParse(request.body)
    if (!body.success)
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    const { targetType, targetId, title, metadata } = body.data
    const visitedAt = new Date()
    const [row] = await db
      .insert(userBrowseHistory)
      .values({
        userId: request.userId!,
        targetType,
        targetId,
        title: title ?? null,
        metadata: metadata ?? null,
        visitedAt,
      })
      .onConflictDoUpdate({
        target: [userBrowseHistory.userId, userBrowseHistory.targetId, userBrowseHistory.targetType],
        set: { visitedAt, title: title ?? null },
      })
      .returning({ id: userBrowseHistory.id, visitedAt: userBrowseHistory.visitedAt })
    return reply.send(
      success({ id: row?.id ?? null, targetType, targetId, visitedAt: row?.visitedAt ?? visitedAt }),
    )
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
