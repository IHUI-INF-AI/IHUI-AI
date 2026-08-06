/**
 * /api/admin/relay/channels 中转站渠道分组管理(2026-07-31 立,#4 #6 合并任务)。
 *
 * 端点清单:
 * 1. GET    /admin/relay/channels/groups                — 列出所有渠道组(含成员数)
 * 2. POST   /admin/relay/channels/groups                — 创建渠道组
 * 3. PATCH  /admin/relay/channels/groups/:id            — 更新组(改名/策略/优先级/启用)
 * 4. DELETE /admin/relay/channels/groups/:id            — 删除组(cascade 删成员)
 * 5. POST   /admin/relay/channels/groups/:id/members    — 添加成员(keyPoolId + weight)
 * 6. DELETE /admin/relay/channels/groups/:id/members/:memberId — 删除成员
 * 7. GET    /admin/relay/channels/groups/:id/stats      — 组统计(成员数 / 熔断状态 / 最近调用数)
 * 8. POST   /admin/relay/channels/test/:keyPoolId       — 一键测速(ping 上游 /models)
 * 9. POST   /admin/relay/channels/batch-toggle          — 批量启停渠道组(2026-07-31 新增,单次最多 100)
 * 10. POST  /admin/relay/channels/:id/test              — 连通性测试(模拟 /v1/chat/completions,不计费,2026-07-31 新增)
 *
 * 全部 requireAdmin。复用 relay-channel-router 的熔断状态查询。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, sql, inArray } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { dbRead } from '../../db/index.js'
import {
  aiRelayChannelGroups,
  aiRelayChannelGroupMembers,
  aiRelayKeyPool,
  aiModelConfig,
  llmCallLogs,
} from '@ihui/database'
import { requireAdmin } from '../../plugins/require-permission.js'
import { success, error } from '../../utils/response.js'
import { logger } from '../../utils/logger.js'
import { idParamSchema } from './_shared.js'
import { decryptJSON, type EncryptedPayload } from '../../utils/crypto.js'
import {
  getCircuitState,
  getRecentCalls,
  resetCircuit,
  type CircuitStateName,
} from '../../services/relay-channel-router.js'

// ============================================================================
// Schemas
// ============================================================================
const createGroupBodySchema = z.object({
  name: z.string().min(1, 'name 不能为空').max(64),
  description: z.string().nullable().optional(),
  loadBalanceStrategy: z.enum(['weight', 'round-robin', 'least-latency']).optional(),
  enabled: z.boolean().optional(),
  priority: z.number().int().optional(),
})

const updateGroupBodySchema = z.object({
  name: z.string().min(1).max(64).optional(),
  description: z.string().nullable().optional(),
  loadBalanceStrategy: z.enum(['weight', 'round-robin', 'least-latency']).optional(),
  enabled: z.boolean().optional(),
  priority: z.number().int().optional(),
})

const addMemberBodySchema = z.object({
  keyPoolId: z.uuid({ error: 'keyPoolId 必须是 UUID' }),
  weight: z.number().int().min(1).optional(),
})

const idMemberParamSchema = z.object({
  id: z.uuid(),
  memberId: z.uuid(),
})

const keyPoolParamSchema = z.object({
  keyPoolId: z.uuid(),
})

// 9-10. 批量启停 + 连通性测试 schema(2026-07-31 新增)
const batchToggleBodySchema = z.object({
  ids: z.array(z.uuid()).min(1, 'ids 不能为空').max(100, '单次最多 100 条'),
  enabled: z.boolean(),
})

const testChannelParamSchema = z.object({
  id: z.uuid(),
})

const testChannelBodySchema = z.object({
  model: z.string().min(1, 'model 不能为空').max(200),
  prompt: z.string().min(1).max(4000).optional().default('hi'),
})

// ============================================================================
// 测速辅助(复用 relay-health-check-service 模式,独立实现避免改其他文件)
// ============================================================================
const TEST_TIMEOUT_MS = 10_000

/** 按 providerCode 查 ai_model_config.base_url(取启用且第一条)。 */
async function findBaseUrlByProvider(providerCode: string): Promise<string | null> {
  const rows = await dbRead
    .select({ baseUrl: aiModelConfig.baseUrl })
    .from(aiModelConfig)
    .where(and(eq(aiModelConfig.providerCode, providerCode), eq(aiModelConfig.enabled, true)))
    .limit(1)
  return rows[0]?.baseUrl ?? null
}

/** 规范化 base_url(去尾部斜杠),拼接 /models 或 /v1/models。 */
function buildModelsUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, '')
  if (trimmed.endsWith('/v1')) return `${trimmed}/models`
  return `${trimmed}/v1/models`
}

/** 规范化 base_url(去尾部斜杠),拼接 /chat/completions 或 /v1/chat/completions(2026-07-31 新增,连通性测试用)。 */
function buildChatCompletionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, '')
  if (trimmed.endsWith('/v1')) return `${trimmed}/chat/completions`
  return `${trimmed}/v1/chat/completions`
}

/** 解密 api_key_enc。 */
function decryptApiKey(apiKeyEnc: string): string {
  const payload = JSON.parse(apiKeyEnc) as EncryptedPayload
  const plain = decryptJSON(payload)
  return typeof plain === 'string' ? plain : String(plain)
}

/** ping 上游 /models 端点,返回状态 + 延迟。 */
async function pingUpstreamModels(
  url: string,
  apiKey: string,
): Promise<{ ok: boolean; latencyMs: number; status: number; errorMessage?: string }> {
  const startedAt = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TEST_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    })
    const latencyMs = Date.now() - startedAt
    if (res.status === 200) return { ok: true, latencyMs, status: res.status }
    return {
      ok: false,
      latencyMs,
      status: res.status,
      errorMessage: `HTTP ${res.status}`,
    }
  } catch (err) {
    const latencyMs = Date.now() - startedAt
    return {
      ok: false,
      latencyMs,
      status: 0,
      errorMessage: err instanceof Error ? err.message : String(err),
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 调上游 /v1/chat/completions 端点做连通性测试(2026-07-31 新增)。
 *
 * 与 pingUpstreamModels 的差异:
 *  - 真实发起一次 chat completion 调用(消耗少量 token)
 *  - 返回响应文本 + token 用量,便于 admin 判断模型可用性
 *  - 失败/超时不抛错,统一返回结构化结果
 *
 * 返回字段对齐前端契约:{ success, latencyMs, response, tokensUsed, error }
 */
interface ChatTestResult {
  success: boolean
  latencyMs: number
  response: string | null
  tokensUsed: number
  error: string | null
  httpStatus: number
}

async function callUpstreamChat(
  url: string,
  apiKey: string,
  model: string,
  prompt: string,
): Promise<ChatTestResult> {
  const startedAt = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TEST_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
      }),
      signal: controller.signal,
    })
    const latencyMs = Date.now() - startedAt

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      return {
        success: false,
        latencyMs,
        response: null,
        tokensUsed: 0,
        error: `HTTP ${res.status}${errText ? `: ${errText.slice(0, 500)}` : ''}`,
        httpStatus: res.status,
      }
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[]
      usage?: { total_tokens?: number; prompt_tokens?: number; completion_tokens?: number }
    }
    const content = data.choices?.[0]?.message?.content ?? ''
    const tokensUsed = data.usage?.total_tokens ?? 0

    return {
      success: true,
      latencyMs,
      response: content,
      tokensUsed,
      error: null,
      httpStatus: res.status,
    }
  } catch (err) {
    const latencyMs = Date.now() - startedAt
    const isAbort = err instanceof Error && err.name === 'AbortError'
    return {
      success: false,
      latencyMs,
      response: null,
      tokensUsed: 0,
      error: isAbort ? 'timeout' : err instanceof Error ? err.message : String(err),
      httpStatus: 0,
    }
  } finally {
    clearTimeout(timer)
  }
}

// ============================================================================
// 路由
// ============================================================================
interface GroupWithCount {
  id: string
  name: string
  description: string | null
  loadBalanceStrategy: string
  enabled: boolean
  priority: number
  memberCount: number
  createdAt: Date
  updatedAt: Date
}

interface MemberWithCircuit {
  memberId: string
  keyPoolId: string
  weight: number
  keyPoolName: string | null
  keyPoolProviderCode: string | null
  keyPoolEnabled: boolean | null
  circuitState: CircuitStateName
  failureCount: number
  lastFailureAt: number | null
  recentCallsCount: number
  avgLatencyMs: number | null
  createdAt: Date
}

const relayChannelsRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // ===== 1. GET /admin/relay/channels/groups — 列出所有渠道组(含成员数) =====
  server.get('/admin/relay/channels/groups', async (_request, reply) => {
    try {
      const groups = await dbRead
        .select({
          id: aiRelayChannelGroups.id,
          name: aiRelayChannelGroups.name,
          description: aiRelayChannelGroups.description,
          loadBalanceStrategy: aiRelayChannelGroups.loadBalanceStrategy,
          enabled: aiRelayChannelGroups.enabled,
          priority: aiRelayChannelGroups.priority,
          createdAt: aiRelayChannelGroups.createdAt,
          updatedAt: aiRelayChannelGroups.updatedAt,
        })
        .from(aiRelayChannelGroups)
        .orderBy(sql`${aiRelayChannelGroups.priority} DESC`, aiRelayChannelGroups.createdAt)

      if (groups.length === 0) {
        return reply.send(success({ list: [], total: 0 }))
      }

      // 批量查成员数
      const groupIds = groups.map((g) => g.id)
      const countRows = await dbRead
        .select({
          groupId: aiRelayChannelGroupMembers.groupId,
          count: sql<number>`count(*)::int`,
        })
        .from(aiRelayChannelGroupMembers)
        .where(inArray(aiRelayChannelGroupMembers.groupId, groupIds))
        .groupBy(aiRelayChannelGroupMembers.groupId)
      const countMap = new Map<string, number>(countRows.map((r) => [r.groupId, r.count]))

      const list: GroupWithCount[] = groups.map((g) => ({
        id: g.id,
        name: g.name,
        description: g.description,
        loadBalanceStrategy: g.loadBalanceStrategy,
        enabled: g.enabled,
        priority: g.priority,
        memberCount: countMap.get(g.id) ?? 0,
        createdAt: g.createdAt,
        updatedAt: g.updatedAt,
      }))

      return reply.send(success({ list, total: list.length }))
    } catch (e) {
      _request.log.error(e)
      return reply.status(500).send(error(500, '查询渠道组列表失败'))
    }
  })

  // ===== 2. POST /admin/relay/channels/groups — 创建渠道组 =====
  server.post('/admin/relay/channels/groups', async (request, reply) => {
    const parsed = createGroupBodySchema.safeParse(request.body ?? {})
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))

    try {
      const [row] = await db
        .insert(aiRelayChannelGroups)
        .values({
          name: parsed.data.name,
          description: parsed.data.description ?? null,
          loadBalanceStrategy: parsed.data.loadBalanceStrategy ?? 'weight',
          enabled: parsed.data.enabled ?? true,
          priority: parsed.data.priority ?? 0,
        })
        .returning({
          id: aiRelayChannelGroups.id,
          name: aiRelayChannelGroups.name,
          description: aiRelayChannelGroups.description,
          loadBalanceStrategy: aiRelayChannelGroups.loadBalanceStrategy,
          enabled: aiRelayChannelGroups.enabled,
          priority: aiRelayChannelGroups.priority,
          createdAt: aiRelayChannelGroups.createdAt,
          updatedAt: aiRelayChannelGroups.updatedAt,
        })
      if (!row) return reply.status(500).send(error(500, '创建渠道组失败'))
      return reply.status(201).send(success(row))
    } catch (e) {
      request.log.error(e)
      const msg = e instanceof Error ? e.message : '创建失败'
      if (msg.includes('unique') || msg.includes('duplicate')) {
        return reply.status(409).send(error(409, '组名已存在'))
      }
      return reply.status(500).send(error(500, msg))
    }
  })

  // ===== 3. PATCH /admin/relay/channels/groups/:id — 更新组 =====
  server.patch('/admin/relay/channels/groups/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '无效的 ID'))
    const parsed = updateGroupBodySchema.safeParse(request.body ?? {})
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    if (Object.keys(parsed.data).length === 0)
      return reply.status(400).send(error(400, '至少更新一个字段'))

    const setData: Record<string, unknown> = { updatedAt: new Date() }
    const d = parsed.data
    if (d.name !== undefined) setData.name = d.name
    if (d.description !== undefined) setData.description = d.description
    if (d.loadBalanceStrategy !== undefined) setData.loadBalanceStrategy = d.loadBalanceStrategy
    if (d.enabled !== undefined) setData.enabled = d.enabled
    if (d.priority !== undefined) setData.priority = d.priority

    try {
      const [row] = await db
        .update(aiRelayChannelGroups)
        .set(setData)
        .where(eq(aiRelayChannelGroups.id, p.data.id))
        .returning({
          id: aiRelayChannelGroups.id,
          name: aiRelayChannelGroups.name,
          description: aiRelayChannelGroups.description,
          loadBalanceStrategy: aiRelayChannelGroups.loadBalanceStrategy,
          enabled: aiRelayChannelGroups.enabled,
          priority: aiRelayChannelGroups.priority,
          updatedAt: aiRelayChannelGroups.updatedAt,
        })
      if (!row) return reply.status(404).send(error(404, '渠道组不存在'))
      return reply.send(success(row))
    } catch (e) {
      request.log.error(e)
      const msg = e instanceof Error ? e.message : '更新失败'
      if (msg.includes('unique') || msg.includes('duplicate')) {
        return reply.status(409).send(error(409, '组名已存在'))
      }
      return reply.status(500).send(error(500, msg))
    }
  })

  // ===== 4. DELETE /admin/relay/channels/groups/:id — 删除组(cascade 删成员) =====
  server.delete('/admin/relay/channels/groups/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      const [row] = await db
        .delete(aiRelayChannelGroups)
        .where(eq(aiRelayChannelGroups.id, p.data.id))
        .returning({ id: aiRelayChannelGroups.id })
      if (!row) return reply.status(404).send(error(404, '渠道组不存在'))
      // members 由 ON DELETE CASCADE 自动删除
      return reply.send(success({ id: row.id, deleted: true }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '删除渠道组失败'))
    }
  })

  // ===== 5. POST /admin/relay/channels/groups/:id/members — 添加成员 =====
  server.post('/admin/relay/channels/groups/:id/members', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '无效的 ID'))
    const parsed = addMemberBodySchema.safeParse(request.body ?? {})
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))

    const { keyPoolId, weight } = parsed.data

    // 校验组存在
    const groupRows = await dbRead
      .select({ id: aiRelayChannelGroups.id })
      .from(aiRelayChannelGroups)
      .where(eq(aiRelayChannelGroups.id, p.data.id))
      .limit(1)
    if (groupRows.length === 0) return reply.status(404).send(error(404, '渠道组不存在'))

    // 校验 key_pool 条目存在
    const keyRows = await dbRead
      .select({ id: aiRelayKeyPool.id })
      .from(aiRelayKeyPool)
      .where(eq(aiRelayKeyPool.id, keyPoolId))
      .limit(1)
    if (keyRows.length === 0) return reply.status(404).send(error(404, 'Key 池条目不存在'))

    try {
      const [row] = await db
        .insert(aiRelayChannelGroupMembers)
        .values({
          groupId: p.data.id,
          keyPoolId,
          weight: weight ?? 1,
        })
        .returning({
          id: aiRelayChannelGroupMembers.id,
          groupId: aiRelayChannelGroupMembers.groupId,
          keyPoolId: aiRelayChannelGroupMembers.keyPoolId,
          weight: aiRelayChannelGroupMembers.weight,
          createdAt: aiRelayChannelGroupMembers.createdAt,
        })
      if (!row) return reply.status(500).send(error(500, '添加成员失败'))
      return reply.status(201).send(success(row))
    } catch (e) {
      request.log.error(e)
      const msg = e instanceof Error ? e.message : '添加失败'
      if (msg.includes('unique') || msg.includes('duplicate')) {
        return reply.status(409).send(error(409, '该 Key 已在此组中'))
      }
      return reply.status(500).send(error(500, msg))
    }
  })

  // ===== 6. DELETE /admin/relay/channels/groups/:id/members/:memberId — 删除成员 =====
  server.delete('/admin/relay/channels/groups/:id/members/:memberId', async (request, reply) => {
    const p = idMemberParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      const [row] = await db
        .delete(aiRelayChannelGroupMembers)
        .where(
          and(
            eq(aiRelayChannelGroupMembers.id, p.data.memberId),
            eq(aiRelayChannelGroupMembers.groupId, p.data.id),
          ),
        )
        .returning({ id: aiRelayChannelGroupMembers.id })
      if (!row) return reply.status(404).send(error(404, '成员不存在'))
      return reply.send(success({ id: row.id, deleted: true }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '删除成员失败'))
    }
  })

  // ===== 7. GET /admin/relay/channels/groups/:id/stats — 组统计 =====
  server.get('/admin/relay/channels/groups/:id/stats', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '无效的 ID'))

    try {
      // 校验组存在
      const groupRows = await dbRead
        .select({
          id: aiRelayChannelGroups.id,
          name: aiRelayChannelGroups.name,
          loadBalanceStrategy: aiRelayChannelGroups.loadBalanceStrategy,
          priority: aiRelayChannelGroups.priority,
          enabled: aiRelayChannelGroups.enabled,
        })
        .from(aiRelayChannelGroups)
        .where(eq(aiRelayChannelGroups.id, p.data.id))
        .limit(1)
      if (groupRows.length === 0) return reply.status(404).send(error(404, '渠道组不存在'))
      const group = groupRows[0]
      if (!group) return reply.status(404).send(error(404, '渠道组不存在'))

      // 查成员 + 关联 key_pool 信息
      const members = await dbRead
        .select({
          memberId: aiRelayChannelGroupMembers.id,
          keyPoolId: aiRelayChannelGroupMembers.keyPoolId,
          weight: aiRelayChannelGroupMembers.weight,
          createdAt: aiRelayChannelGroupMembers.createdAt,
          keyPoolName: aiRelayKeyPool.name,
          keyPoolProviderCode: aiRelayKeyPool.providerCode,
          keyPoolEnabled: aiRelayKeyPool.isEnabled,
        })
        .from(aiRelayChannelGroupMembers)
        .leftJoin(aiRelayKeyPool, eq(aiRelayKeyPool.id, aiRelayChannelGroupMembers.keyPoolId))
        .where(eq(aiRelayChannelGroupMembers.groupId, p.data.id))

      const memberList: MemberWithCircuit[] = members.map((m) => {
        const circuit = getCircuitState(m.keyPoolId)
        const recent = getRecentCalls(m.keyPoolId)
        const avgLatency =
          recent.length > 0 ? recent.reduce((sum, r) => sum + r.latencyMs, 0) / recent.length : null
        return {
          memberId: m.memberId,
          keyPoolId: m.keyPoolId,
          weight: m.weight,
          keyPoolName: m.keyPoolName,
          keyPoolProviderCode: m.keyPoolProviderCode,
          keyPoolEnabled: m.keyPoolEnabled,
          circuitState: circuit.state,
          failureCount: circuit.failureCount,
          lastFailureAt: circuit.lastFailureAt || null,
          recentCallsCount: recent.length,
          avgLatencyMs: avgLatency,
          createdAt: m.createdAt,
        }
      })

      // 汇总统计
      const totalMembers = memberList.length
      const openCount = memberList.filter((m) => m.circuitState === 'open').length
      const halfOpenCount = memberList.filter((m) => m.circuitState === 'half-open').length
      const closedCount = memberList.filter((m) => m.circuitState === 'closed').length
      const totalRecentCalls = memberList.reduce((sum, m) => sum + m.recentCallsCount, 0)

      return reply.send(
        success({
          group: {
            id: group.id,
            name: group.name,
            loadBalanceStrategy: group.loadBalanceStrategy,
            priority: group.priority,
            enabled: group.enabled,
          },
          memberCount: totalMembers,
          circuitSummary: {
            closed: closedCount,
            open: openCount,
            halfOpen: halfOpenCount,
          },
          totalRecentCalls,
          members: memberList,
        }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询组统计失败'))
    }
  })

  // ===== 8. POST /admin/relay/channels/test/:keyPoolId — 一键测速 =====
  server.post('/admin/relay/channels/test/:keyPoolId', async (request, reply) => {
    const p = keyPoolParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '无效的 keyPoolId'))

    try {
      // 查 key_pool 条目
      const keyRows = await dbRead
        .select({
          id: aiRelayKeyPool.id,
          providerCode: aiRelayKeyPool.providerCode,
          apiKeyEnc: aiRelayKeyPool.apiKeyEnc,
        })
        .from(aiRelayKeyPool)
        .where(eq(aiRelayKeyPool.id, p.data.keyPoolId))
        .limit(1)
      if (keyRows.length === 0) return reply.status(404).send(error(404, 'Key 池条目不存在'))
      const keyRow = keyRows[0]
      if (!keyRow) return reply.status(404).send(error(404, 'Key 池条目不存在'))

      // 解密 api_key
      let apiKey: string
      try {
        apiKey = decryptApiKey(keyRow.apiKeyEnc)
      } catch (err) {
        return reply
          .status(500)
          .send(error(500, `解密失败: ${err instanceof Error ? err.message : String(err)}`))
      }

      // 查 base_url
      const baseUrl = await findBaseUrlByProvider(keyRow.providerCode)
      if (!baseUrl) {
        return reply
          .status(404)
          .send(error(404, `未找到 provider=${keyRow.providerCode} 的 base_url`))
      }

      // ping 上游 /models
      const modelsUrl = buildModelsUrl(baseUrl)
      const result = await pingUpstreamModels(modelsUrl, apiKey)

      return reply.send(
        success({
          keyPoolId: keyRow.id,
          providerCode: keyRow.providerCode,
          baseUrl,
          modelsUrl,
          ok: result.ok,
          latencyMs: result.latencyMs,
          httpStatus: result.status,
          errorMessage: result.errorMessage ?? null,
        }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '测速失败'))
    }
  })

  // ===== 附加:POST /admin/relay/channels/test/:keyPoolId/reset-circuit — 手动重置熔断 =====
  server.post('/admin/relay/channels/test/:keyPoolId/reset-circuit', async (request, reply) => {
    const p = keyPoolParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '无效的 keyPoolId'))
    resetCircuit(p.data.keyPoolId)
    return reply.send(success({ keyPoolId: p.data.keyPoolId, circuitReset: true }))
  })

  // ===== 9. POST /admin/relay/channels/batch-toggle — 批量启停渠道组(2026-07-31 新增)=====
  server.post('/admin/relay/channels/batch-toggle', async (request, reply) => {
    const parsed = batchToggleBodySchema.safeParse(request.body ?? {})
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))

    const { ids, enabled } = parsed.data
    try {
      const rows = await db
        .update(aiRelayChannelGroups)
        .set({ enabled, updatedAt: new Date() })
        .where(inArray(aiRelayChannelGroups.id, ids))
        .returning({ id: aiRelayChannelGroups.id })

      const updated = rows.length
      const failed = ids.length - updated
      // P2 修复(2026-08-06):批量启停无操作日志,补记操作人/目标状态/影响数量,便于审计追责。
      logger.info('admin relay-channels batch-toggle executed', {
        userId: request.userId,
        enabled,
        requested: ids.length,
        updated,
      })
      return reply.send(success({ updated, failed }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '批量启停失败'))
    }
  })

  // ===== 10. POST /admin/relay/channels/:id/test — 连通性测试(2026-07-31 新增)=====
  server.post('/admin/relay/channels/:id/test', async (request, reply) => {
    const p = testChannelParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '无效的 id'))
    const parsed = testChannelBodySchema.safeParse(request.body ?? {})
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))

    const keyPoolId = p.data.id
    const { model, prompt } = parsed.data

    try {
      // 查 key_pool 条目
      const keyRows = await dbRead
        .select({
          id: aiRelayKeyPool.id,
          providerCode: aiRelayKeyPool.providerCode,
          apiKeyEnc: aiRelayKeyPool.apiKeyEnc,
        })
        .from(aiRelayKeyPool)
        .where(eq(aiRelayKeyPool.id, keyPoolId))
        .limit(1)
      if (keyRows.length === 0) return reply.status(404).send(error(404, 'Key 池条目不存在'))
      const keyRow = keyRows[0]
      if (!keyRow) return reply.status(404).send(error(404, 'Key 池条目不存在'))

      // 解密 api_key
      let apiKey: string
      try {
        apiKey = decryptApiKey(keyRow.apiKeyEnc)
      } catch (err) {
        return reply
          .status(500)
          .send(error(500, `解密失败: ${err instanceof Error ? err.message : String(err)}`))
      }

      // 查 base_url
      const baseUrl = await findBaseUrlByProvider(keyRow.providerCode)
      if (!baseUrl) {
        return reply
          .status(404)
          .send(error(404, `未找到 provider=${keyRow.providerCode} 的 base_url`))
      }

      // 调上游 chat/completions
      const chatUrl = buildChatCompletionsUrl(baseUrl)
      const result = await callUpstreamChat(chatUrl, apiKey, model, prompt)

      // 写 llm_call_logs(metadata.isTestCall=true 标记免计费,不调 recordCall)
      // userId 取 admin 自身(request.userId 由 requireAdmin→authenticate 注入)
      const adminUserId = request.userId
      if (adminUserId) {
        try {
          await db.insert(llmCallLogs).values({
            userId: adminUserId,
            model,
            prompt,
            response: result.response ?? '',
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: result.tokensUsed,
            latencyMs: result.latencyMs,
            status: result.success ? 'success' : 'error',
            errorMessage: result.error,
            keyPoolId: keyRow.id,
            providerCode: keyRow.providerCode,
            httpStatus: result.httpStatus,
            metadata: { isTestCall: true, chatUrl, model },
          })
        } catch (logErr) {
          // 日志写失败不阻塞测试结果返回
          request.log.error(logErr)
        }
      }

      return reply.send(
        success({
          success: result.success,
          latencyMs: result.latencyMs,
          response: result.response,
          tokensUsed: result.tokensUsed,
          error: result.error,
        }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '连通性测试失败'))
    }
  })
}

export default relayChannelsRoutes
