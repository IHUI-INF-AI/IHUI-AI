/**
 * /api/admin/token-balance 路由:Token 余额与 VIP 折扣指标(admin 看板)。
 *
 * 注意:运行时 `/api/admin/token-balance/metrics` 当前由
 * `src/plugins/token-balance-service.ts:267` 注册(基于内存计数器,记录
 * VIP 折扣实时应用次数)。本文件为同一路由的"子路由文件版本",
 * 提供基于 DB 的查询实现,供测试与未来替换内存版使用。
 *
 * 数据来源:
 * - userVips:统计各 VIP 等级当前生效用户数(byLevel)
 * - tokenFlows(opType=1 扣减):统计 token 扣减总次数(applies)
 * - totalDiscounted:无 DB 字段直接对应,返回 0(内存计数器专有)
 */
import type { FastifyPluginAsync } from 'fastify'
import { sql, eq, and, gte } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { success } from '../../utils/response.js'
import { requireAdmin } from '../../plugins/require-permission.js'
import { userVips, tokenFlows } from '@ihui/database'

const tokenBalanceRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  /**
   * GET /metrics — Token 余额 VIP 折扣指标
   * 响应结构(对齐前端 VipMetrics):
   *   { applies: number, totalDiscounted: number, byLevel: Record<string, number> }
   *
   * - applies:tokenFlows opType=1(扣减)总次数(无 VIP 折扣标记字段,以扣减次数近似)
   * - totalDiscounted:累计节省 token 数(无 DB 字段,返回 0)
   * - byLevel:当前生效 VIP 用户按 levelValue 分组计数(userVips.status=1)
   */
  server.get('/metrics', async (_request, reply) => {
    try {
      const [appliesRow, byLevelRows] = await Promise.all([
        db
          .select({ c: sql<number>`count(*)::int` })
          .from(tokenFlows)
          .where(eq(tokenFlows.opType, 1)),
        db
          .select({
            levelValue: userVips.levelValue,
            c: sql<number>`count(*)::int`,
          })
          .from(userVips)
          .where(and(eq(userVips.status, 1), gte(userVips.endTime, new Date())))
          .groupBy(userVips.levelValue),
      ])

      const byLevel: Record<string, number> = {}
      for (const row of byLevelRows) {
        if (row.levelValue > 0) {
          byLevel[String(row.levelValue)] = row.c
        }
      }

      return reply.send(
        success({
          applies: appliesRow[0]?.c ?? 0,
          totalDiscounted: 0,
          byLevel,
        }),
      )
    } catch (e) {
      server.log.error({ err: e }, 'token-balance/metrics 查询失败')
      // 表不存在或查询异常时返回零值,避免阻塞 admin 看板
      return reply.send(
        success({
          applies: 0,
          totalDiscounted: 0,
          byLevel: {},
        }),
      )
    }
  })
}

export default tokenBalanceRoutes

