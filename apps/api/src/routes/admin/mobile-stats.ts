/**
 * /api/admin/mobile-stats 移动端运营统计聚合端点(2026-08-06 立)。
 *
 * 端点:GET /admin/mobile-stats(注册前缀 /api/admin,preHandler=requireAdmin)
 *
 * 返回字段(全部为真实数据库聚合,无硬编码/示例数字):
 * - dau:最近 24h 活跃用户数(visit_logs/analytics_events/llm_call_logs 的 user_id 去重)
 * - newUsers:当日新增注册用户数(users.created_at 当日,Asia/Shanghai 日界)
 * - sessions:当日会话数(visit_logs 当日 distinct session_id)
 * - crashRate:null(项目无崩溃上报表,前端显示"暂无数据")
 * - dauTrend:近 7 日 DAU 趋势 [{date,dau}]
 * - deviceDistribution:设备分布 [{name,percent}](无数据为空数组)
 * - topPages:Top 5 页面 [{path,visits}](无数据为空数组)
 */
import type { FastifyPluginAsync } from 'fastify'
import { requireAdmin } from '../../plugins/require-permission.js'
import { success, error } from '../../utils/response.js'
import {
  getActiveUsers,
  getNewUsers,
  getSessions,
  getDauTrend,
  getDeviceDistribution,
  getTopPages,
} from '../../db/mobile-stats-queries.js'

const DAY_MS = 24 * 60 * 60 * 1000

// Asia/Shanghai 日界(UTC 表示),与聚合查询模块口径一致
function shanghaiDayStartUtc(daysAgo = 0): Date {
  const shanghaiNow = new Date(Date.now() + 8 * 3600 * 1000)
  return new Date(
    Date.UTC(
      shanghaiNow.getUTCFullYear(),
      shanghaiNow.getUTCMonth(),
      shanghaiNow.getUTCDate() - daysAgo,
    ) - 8 * 3600 * 1000,
  )
}

const mobileStatsRoutes: FastifyPluginAsync = async (server) => {
  server.get('/mobile-stats', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const now = new Date()
      const todayStart = shanghaiDayStartUtc(0)
      const nextDayStart = new Date(todayStart.getTime() + DAY_MS)
      const since24h = new Date(now.getTime() - DAY_MS)

      const [dau, newUsers, sessions, dauTrend, deviceDistribution, topPagesResult] =
        await Promise.all([
          getActiveUsers(since24h),
          getNewUsers(todayStart, nextDayStart),
          getSessions(todayStart, nextDayStart),
          getDauTrend(7),
          getDeviceDistribution(since24h),
          getTopPages(since24h, 5),
        ])

      return reply.send(
        success({
          dau,
          newUsers,
          sessions,
          // 项目无崩溃上报表,返回 null,前端显示"暂无数据"
          crashRate: null,
          dauTrend,
          deviceDistribution,
          topPages: topPagesResult.pages,
          // 统计窗口内全部页面访问量,供前端计算真实占比
          totalVisits: topPagesResult.totalVisits,
          generatedAt: now.toISOString(),
        }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询移动端统计失败'))
    }
  })
}

export default mobileStatsRoutes
