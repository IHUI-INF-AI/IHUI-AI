// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { success, error } from '../../utils/response.js'
import { requireAdmin } from '../../plugins/require-permission.js'
import { idParamSchema } from './_shared.js'
import { isUuidString } from '../../utils/uuid.js'
import {
  listErrorPassthroughRules,
  createErrorPassthroughRule,
  updateErrorPassthroughRule,
  deleteErrorPassthroughRule,
  countRulesByStatus,
} from '../../services/relay-error-rules-service.js'

/**
 * /api/admin/relay/error-rules 上游错误透传规则(2026-09-16 立,五轮补强)。
 *
 * 端点(requireAdmin):
 * 1. GET    /relay/error-rules          — 规则列表(priority 降序)
 * 2. POST   /relay/error-rules          — 新建
 * 3. PATCH  /relay/error-rules/:id      — 更新
 * 4. DELETE /relay/error-rules/:id      — 删除
 * 5. GET    /relay/error-rules/coverage — 按上游状态码统计规则数(覆盖度检查)
 */
const bodySchema = z.object({
  upstreamStatus: z.coerce.number().int().min(100).max(599),
  keyword: z.string().max(128).nullable().optional(),
  downstreamStatus: z.coerce.number().int().min(100).max(599),
  messageTemplate: z.string().min(1).max(500),
  exposeUpstreamMessage: z.coerce.boolean().optional(),
  priority: z.coerce.number().int().min(0).max(1000).optional(),
  enabled: z.coerce.boolean().optional(),
  remark: z.string().max(255).nullable().optional(),
})

const patchSchema = bodySchema.partial()

const adminRelayErrorRulesRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  server.get('/relay/error-rules', async (request, reply) => {
    try {
      const list = await listErrorPassthroughRules()
      return reply.send(success({ list, total: list.length }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询错误透传规则失败'))
    }
  })

  server.get('/relay/error-rules/coverage', async (request, reply) => {
    try {
      const groups = await countRulesByStatus()
      return reply.send(success({ groups }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询规则覆盖度失败'))
    }
  })

  server.post('/relay/error-rules', async (request, reply) => {
    const parsed = bodySchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数不合法'))
    }
    try {
      const row = await createErrorPassthroughRule(parsed.data)
      return reply.send(success(row))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '创建错误透传规则失败'))
    }
  })

  server.patch('/relay/error-rules/:id', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) return reply.status(400).send(error(400, '规则 id 不合法'))
    if (!isUuidString(idParsed.data.id)) return reply.status(400).send(error(400, 'id 格式不正确'))
    const parsed = patchSchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数不合法'))
    }
    try {
      const row = await updateErrorPassthroughRule(idParsed.data.id, parsed.data)
      if (!row) return reply.status(404).send(error(404, '规则不存在'))
      return reply.send(success(row))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '更新错误透传规则失败'))
    }
  })

  server.delete('/relay/error-rules/:id', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) return reply.status(400).send(error(400, '规则 id 不合法'))
    // 形状闸(2026-09-28 普查收口):下面这些 :id 最终会被喂进 uuid 列,非 uuid 字面量让 Postgres
    // 抛 22P02 invalid input syntax for type uuid,而未被兜住就是 500 —— 于是"这条不存在"与
    // "服务坏了"在响应上完全同形。判据只有一份(utils/uuid.ts 的 isUuidString),闸必须在进 SQL 之前。
    if (!isUuidString(idParsed.data.id)) return reply.status(400).send(error(400, 'id 格式不正确'))
    try {
      const okDeleted = await deleteErrorPassthroughRule(idParsed.data.id)
      if (!okDeleted) return reply.status(404).send(error(404, '规则不存在'))
      return reply.send(success({ deleted: okDeleted }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '删除错误透传规则失败'))
    }
  })
}

export default adminRelayErrorRulesRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
