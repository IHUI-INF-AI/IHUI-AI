// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * /api/admin/relay/key-scheduling 号池调度精细控制端点(2026-09-16 立,补强 Y)。
 *
 * 端点清单(requireAdmin):
 * 1. GET   /relay/key-scheduling                — 号池 Key 调度状态列表(provider/健康/临时摘除/倍率/RPM)
 * 2. PATCH /relay/key-scheduling/:id            — 更新单 Key 调度控制(tempUnschedulable/rateMultiplier/rpmOverride)
 *
 * 消费关系:tempUnschedulable=true 由 relay-channel-router 选路直接跳过;
 * rateMultiplier/rpmOverride 字段就绪,深度消费(权重乘数/限流覆盖)按运营需要接入。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { desc, eq } from 'drizzle-orm'
import { db, dbRead } from '../../db/index.js'
import { aiRelayKeyPool } from '@ihui/database'
import { success, error } from '../../utils/response.js'
import { requireAdmin } from '../../plugins/require-permission.js'
import { idParamSchema } from './_shared.js'

const patchSchema = z.object({
  tempUnschedulable: z.coerce.boolean().optional(),
  rateMultiplier: z.coerce.number().min(0).max(100).nullable().optional(),
  rpmOverride: z.coerce.number().int().min(0).max(100000).nullable().optional(),
})

const adminRelayKeySchedulingRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // 1. 调度状态列表(按 provider/优先级排序;不含明文 Key)
  server.get('/relay/key-scheduling', async (request, reply) => {
    try {
      const rows = await dbRead
        .select({
          id: aiRelayKeyPool.id,
          providerCode: aiRelayKeyPool.providerCode,
          keyPrefix: aiRelayKeyPool.keyPrefix,
          priority: aiRelayKeyPool.priority,
          weight: aiRelayKeyPool.weight,
          isEnabled: aiRelayKeyPool.isEnabled,
          tempUnschedulable: aiRelayKeyPool.tempUnschedulable,
          rateMultiplier: aiRelayKeyPool.rateMultiplier,
          rpmOverride: aiRelayKeyPool.rpmOverride,
          healthStatus: aiRelayKeyPool.healthStatus,
          healthCheckedAt: aiRelayKeyPool.healthCheckedAt,
        })
        .from(aiRelayKeyPool)
        .orderBy(desc(aiRelayKeyPool.priority))
      return reply.send(success({ list: rows, total: rows.length }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询号池调度状态失败'))
    }
  })

  // 2. 单 Key 调度控制更新(undefined = 不改;null = 清除覆盖恢复全局)
  server.patch('/relay/key-scheduling/:id', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) return reply.status(400).send(error(400, 'Key id 不合法'))
    const parsed = patchSchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数不合法'))
    }
    try {
      const setData: Record<string, unknown> = { updatedAt: new Date() }
      if (parsed.data.tempUnschedulable !== undefined) {
        setData.tempUnschedulable = parsed.data.tempUnschedulable
      }
      if (parsed.data.rateMultiplier !== undefined) {
        setData.rateMultiplier =
          parsed.data.rateMultiplier === null ? null : String(parsed.data.rateMultiplier)
      }
      if (parsed.data.rpmOverride !== undefined) setData.rpmOverride = parsed.data.rpmOverride
      const [row] = await db
        .update(aiRelayKeyPool)
        .set(setData)
        .where(eq(aiRelayKeyPool.id, idParsed.data.id))
        .returning({
          id: aiRelayKeyPool.id,
          tempUnschedulable: aiRelayKeyPool.tempUnschedulable,
          rateMultiplier: aiRelayKeyPool.rateMultiplier,
          rpmOverride: aiRelayKeyPool.rpmOverride,
        })
      if (!row) return reply.status(404).send(error(404, '号池 Key 不存在'))
      return reply.send(success(row))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '更新调度控制失败'))
    }
  })
}

export default adminRelayKeySchedulingRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
