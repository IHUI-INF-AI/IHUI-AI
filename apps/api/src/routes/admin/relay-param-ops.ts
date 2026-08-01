/**
 * /api/admin/relay-param-ops 参数覆盖规则管理(2026-08-01 立,P0-20b)。
 *
 * 端点清单:
 * 1. GET    /admin/relay-param-ops            — 列出所有规则(返回 array)
 * 2. POST   /admin/relay-param-ops            — 创建规则
 * 3. GET    /admin/relay-param-ops/:id        — 查询规则详情
 * 4. PUT    /admin/relay-param-ops/:id        — 更新规则
 * 5. DELETE /admin/relay-param-ops/:id        — 删除规则
 * 6. POST   /admin/relay-param-ops/:id/dry-run — 预览规则应用效果
 *
 * 鉴权:requireAdmin(roleId >= 1),响应统一 { code, message, data } 格式。
 * 复用 relay-param-ops-config.ts(service)+ relay-param-ops.ts(纯函数)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { success, error } from '../../utils/response.js'
import { requireAdmin } from '../../plugins/require-permission.js'
import {
  listParamOpRules,
  getParamOpRule,
  createParamOpRule,
  updateParamOpRule,
  deleteParamOpRule,
  dryRunParamOpRule,
  validateRuleOps,
  type ParamOpRule,
} from '../../services/relay-param-ops-config.js'

// =============================================================================
// Zod schemas
// =============================================================================

/**
 * ops 用 z.unknown() 接收(JSON 编辑器输入),由 validateRuleOps 做深度校验。
 * 不在 Zod 层定义 ParamOp 结构(字段太多 + 条件分支复杂,纯函数库已有 validateParamOps)。
 */
const matchConditionsSchema = z.object({
  model: z.string().optional(),
  channelId: z.string().optional(),
  global: z.boolean().optional(),
})

const createBodySchema = z.object({
  name: z.string().min(1).max(128),
  enabled: z.boolean().default(true),
  priority: z.number().finite().default(0),
  matchConditions: matchConditionsSchema.default({}),
  ops: z.array(z.unknown()).default([]),
})

const updateBodySchema = z.object({
  name: z.string().min(1).max(128).optional(),
  enabled: z.boolean().optional(),
  priority: z.number().finite().optional(),
  matchConditions: matchConditionsSchema.optional(),
  ops: z.array(z.unknown()).optional(),
})

const dryRunBodySchema = z.object({
  sampleBody: z.record(z.unknown()),
  context: z
    .object({
      model: z.string().optional(),
      upstream_model: z.string().optional(),
      original_model: z.string().optional(),
    })
    .optional(),
})

// =============================================================================
// 路由
// =============================================================================

const adminRelayParamOpsRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // ===== 1. GET / — 列出所有规则 =====
  server.get('/', async (_request, reply) => {
    try {
      const rules = await listParamOpRules()
      return reply.send(success(rules))
    } catch (e) {
      _request.log.error(e)
      return reply.status(500).send(error(500, '查询参数覆盖规则列表失败'))
    }
  })

  // ===== 2. POST / — 创建规则 =====
  server.post('/', async (request, reply) => {
    const parsed = createBodySchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    // 深度校验 ops 结构(15 种 op + 条件 + JSON 路径)
    const opsCheck = validateRuleOps(parsed.data.ops)
    if (!opsCheck.valid) {
      return reply.status(400).send(error(400, `ops 校验失败:${opsCheck.errors.join('; ')}`))
    }
    try {
      const rule = await createParamOpRule({
        name: parsed.data.name,
        enabled: parsed.data.enabled,
        priority: parsed.data.priority,
        matchConditions: parsed.data.matchConditions,
        ops: parsed.data.ops as ParamOpRule['ops'],
      })
      return reply.send(success(rule))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '创建参数覆盖规则失败'))
    }
  })

  // ===== 3. GET /:id — 查询详情 =====
  server.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      const rule = await getParamOpRule(id)
      if (!rule) {
        return reply.status(404).send(error(404, '规则不存在'))
      }
      return reply.send(success(rule))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询参数覆盖规则失败'))
    }
  })

  // ===== 4. PUT /:id — 更新规则 =====
  server.put('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = updateBodySchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    // 若传入 ops,深度校验
    if (parsed.data.ops !== undefined) {
      const opsCheck = validateRuleOps(parsed.data.ops)
      if (!opsCheck.valid) {
        return reply.status(400).send(error(400, `ops 校验失败:${opsCheck.errors.join('; ')}`))
      }
    }
    try {
      const patch: Record<string, unknown> = { ...parsed.data }
      if (parsed.data.ops !== undefined) {
        patch.ops = parsed.data.ops as ParamOpRule['ops']
      }
      const updated = await updateParamOpRule(id, patch as Parameters<typeof updateParamOpRule>[1])
      if (!updated) {
        return reply.status(404).send(error(404, '规则不存在'))
      }
      return reply.send(success(updated))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '更新参数覆盖规则失败'))
    }
  })

  // ===== 5. DELETE /:id — 删除规则 =====
  server.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      const ok = await deleteParamOpRule(id)
      if (!ok) {
        return reply.status(404).send(error(404, '规则不存在'))
      }
      return reply.send(success({ id }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '删除参数覆盖规则失败'))
    }
  })

  // ===== 6. POST /:id/dry-run — 预览规则应用效果 =====
  server.post('/:id/dry-run', async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = dryRunBodySchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    try {
      const result = await dryRunParamOpRule(id, parsed.data.sampleBody, parsed.data.context)
      if (!result) {
        return reply.status(404).send(error(404, '规则不存在'))
      }
      return reply.send(success(result))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '预览参数覆盖规则失败'))
    }
  })
}

export default adminRelayParamOpsRoutes
