import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { success, error } from '../../utils/response.js'
import { requireAdmin } from '../../plugins/require-permission.js'
import { idParamSchema } from './_shared.js'
import {
  listPromptAuditRules,
  createPromptAuditRule,
  updatePromptAuditRule,
  deletePromptAuditRule,
  listPromptAuditHits,
  countHitsByRule,
} from '../../services/relay-prompt-audit-service.js'

/**
 * /api/admin/relay/prompt-audit 提示词审计(2026-09-17 立,补强 54)。
 *
 * 端点(requireAdmin):
 * 1. GET    /relay/prompt-audit/rules   — 规则列表
 * 2. POST   /relay/prompt-audit/rules   — 新建规则
 * 3. PATCH  /relay/prompt-audit/rules/:id — 更新
 * 4. DELETE /relay/prompt-audit/rules/:id — 删除
 * 5. GET    /relay/prompt-audit/hits    — 命中记录(默认 50)
 * 6. GET    /relay/prompt-audit/stats   — 按规则统计命中次数
 *
 * 匹配为关键字子串(不支持正则,规避 ReDoS);动作 log/warn/block 由网关侧执行。
 */
const ruleBodySchema = z.object({
  name: z.string().min(1).max(100),
  keyword: z.string().min(1).max(200),
  action: z.enum(['log', 'warn', 'block']).default('log'),
  severity: z.coerce.number().int().min(1).max(5).optional(),
  enabled: z.coerce.boolean().optional(),
  remark: z.string().max(255).nullable().optional(),
})

const rulePatchSchema = ruleBodySchema.partial()

const adminRelayPromptAuditRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  server.get('/relay/prompt-audit/rules', async (request, reply) => {
    try {
      const list = await listPromptAuditRules()
      return reply.send(success({ list, total: list.length }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询提示词审计规则失败'))
    }
  })

  server.post('/relay/prompt-audit/rules', async (request, reply) => {
    const parsed = ruleBodySchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数不合法'))
    }
    try {
      const row = await createPromptAuditRule(parsed.data)
      return reply.send(success(row))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '创建提示词审计规则失败'))
    }
  })

  server.patch('/relay/prompt-audit/rules/:id', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) return reply.status(400).send(error(400, '规则 id 不合法'))
    const parsed = rulePatchSchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数不合法'))
    }
    try {
      const row = await updatePromptAuditRule(idParsed.data.id, parsed.data)
      if (!row) return reply.status(404).send(error(404, '规则不存在'))
      return reply.send(success(row))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '更新提示词审计规则失败'))
    }
  })

  server.delete('/relay/prompt-audit/rules/:id', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) return reply.status(400).send(error(400, '规则 id 不合法'))
    try {
      const okDeleted = await deletePromptAuditRule(idParsed.data.id)
      if (!okDeleted) return reply.status(404).send(error(404, '规则不存在'))
      return reply.send(success({ deleted: true }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '删除提示词审计规则失败'))
    }
  })

  server.get('/relay/prompt-audit/hits', async (request, reply) => {
    try {
      const q = z
        .object({ limit: z.coerce.number().int().min(1).max(200).optional() })
        .safeParse(request.query ?? {})
      const limit = q.success ? (q.data.limit ?? 50) : 50
      const hits = await listPromptAuditHits(limit)
      return reply.send(success({ hits, total: hits.length }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询命中记录失败'))
    }
  })

  server.get('/relay/prompt-audit/stats', async (request, reply) => {
    try {
      const groups = await countHitsByRule()
      return reply.send(success({ groups }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询命中统计失败'))
    }
  })
}

export default adminRelayPromptAuditRoutes
