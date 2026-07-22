import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { eq, and, desc, sql, asc } from 'drizzle-orm'
import { db } from '../db/index.js'
import { aiModelConfig } from '@ihui/database'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import { encryptJSON, decryptJSON, isEncryptedPayload } from '../utils/crypto.js'
import { PLATFORM_TEMPLATES, TEMPLATE_MAP, type PlatformTemplate } from '../utils/platform-templates.js'

// =============================================================================
// Schemas
// =============================================================================

const idParamSchema = z.object({ id: z.coerce.number().int().positive() })

const createConfigSchema = z.object({
  /** 模板 code (openai/anthropic/deepseek/...) */
  templateCode: z.string().min(1).max(64),
  /** 用户自定义名称(用于 UI 区分) */
  name: z.string().min(1).max(64),
  /** 加密存储的 API Key */
  apiKey: z.string().min(1).max(500),
  /** 默认模型 ID */
  modelId: z.string().min(1).max(128),
  /** 对话上下文支持数 */
  contextLength: z.number().int().min(512).max(2000000).default(32000),
  /** 备注(可选) */
  description: z.string().max(500).optional(),
  /** 自定义平台时,允许覆盖 baseUrl */
  baseUrlOverride: z.string().url().optional(),
})

const updateConfigSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  apiKey: z.string().min(1).max(500).optional(),
  modelId: z.string().min(1).max(128).optional(),
  contextLength: z.number().int().min(512).max(2000000).optional(),
  description: z.string().max(500).optional(),
  baseUrlOverride: z.string().url().optional(),
  enabled: z.boolean().optional(),
})

// =============================================================================
// Helpers
// =============================================================================

function resolveTemplate(code: string): PlatformTemplate {
  const t = TEMPLATE_MAP[code]
  if (!t) throw new Error(`未知的平台模板: ${code}`)
  return t
}

async function getApiKey(row: { apiKeyEnc: string | null }): Promise<string | null> {
  if (!row.apiKeyEnc) return null
  try {
    const payload = JSON.parse(row.apiKeyEnc) as unknown
    if (isEncryptedPayload(payload)) {
      return String(decryptJSON(payload))
    }
    return row.apiKeyEnc
  } catch {
    return row.apiKeyEnc
  }
}

function aiServiceUrl(): string {
  return process.env.AI_SERVICE_URL || 'http://localhost:8803'
}

interface TestResult {
  ok: boolean
  status: 'success' | 'failed'
  responseMs?: number
  error?: string
  modelEcho?: string
}

/**
 * 测试连通性:向 ai-service 发起一次最小对话,记录耗时。
 * 失败原因写入 last_test_error 便于 UI 提示。
 */
async function testConnectivity(row: {
  id: number
  baseUrl: string
  apiKeyEnc: string | null
  modelIdForTest: string | null
  providerCode: string
  apiFormat: string
  name: string
  ownerUuid: string | null
}): Promise<TestResult> {
  const apiKey = await getApiKey(row)
  if (!apiKey) {
    return { ok: false, status: 'failed', error: 'API Key 未配置或解密失败' }
  }
  const start = Date.now()
  try {
    const resp = await fetch(`${aiServiceUrl()}/api/llm/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: 'Hello, this is a connectivity test. Reply with "OK".',
          },
        ],
        model:
          row.modelIdForTest && row.providerCode
            ? `${row.providerCode}/${row.modelIdForTest}`
            : row.modelIdForTest || `${row.providerCode}/test`,
        metadata: { configId: row.id, testOnly: true, userId: row.ownerUuid },
      }),
    })
    const elapsed = Date.now() - start
    const json = (await resp.json().catch(() => ({}))) as Record<string, unknown>

    if (!resp.ok || json.error) {
      const msg = String(json.error_message || json.message || `HTTP ${resp.status}`)
      return { ok: false, status: 'failed', responseMs: elapsed, error: msg }
    }

    return {
      ok: true,
      status: 'success',
      responseMs: elapsed,
      modelEcho: String(json.model ?? ''),
    }
  } catch (e) {
    return {
      ok: false,
      status: 'failed',
      responseMs: Date.now() - start,
      error: (e as Error).message,
    }
  }
}

interface UpstreamModel {
  id: string
  owned_by?: string
  context_length?: number
}

interface FetchModelsResult {
  ok: boolean
  models: UpstreamModel[]
  error?: string
}

/**
 * 调上游 /v1/models 拉取模型列表(OpenAI 兼容)。
 * 不同 provider 适配:
 *  - openai/anthropic(用 OpenAI 兼容端点)/google/.../ollama/lmstudio: GET {baseUrl}/models
 *  - anthropic 原生: GET {baseUrl}/v1/models
 *  - google(generateContent): 直接硬编码列表(原生 API 无 list 端点)
 *  - 自定义: 用户填的 baseUrl + /models
 */
async function fetchUpstreamModels(row: {
  baseUrl: string
  apiKeyEnc: string | null
  providerCode: string
  apiFormat: string
}): Promise<FetchModelsResult> {
  const apiKey = await getApiKey(row)
  if (!apiKey) return { ok: false, models: [], error: 'API Key 未配置' }
  if (!row.baseUrl) return { ok: false, models: [], error: 'Base URL 未配置' }

  // google 原生端点没有 list models 的 OpenAI 兼容路径
  if (row.providerCode === 'google' && !row.baseUrl.includes('/openai')) {
    return {
      ok: true,
      models: [
        { id: 'gemini-1.5-pro', context_length: 1000000 },
        { id: 'gemini-1.5-flash', context_length: 1000000 },
        { id: 'gemini-1.5-flash-8b', context_length: 1000000 },
        { id: 'gemini-2.0-flash-exp', context_length: 1000000 },
      ],
    }
  }

  // 大多数 OpenAI 兼容端点: GET {baseUrl}/models
  const url = `${row.baseUrl.replace(/\/$/, '')}/models`
  try {
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'x-api-key': apiKey,
      },
    })
    if (!resp.ok) {
      const t = await resp.text()
      return { ok: false, models: [], error: `HTTP ${resp.status}: ${t.slice(0, 200)}` }
    }
    const data = (await resp.json()) as { data?: UpstreamModel[]; models?: UpstreamModel[] }
    const list = data.data ?? data.models ?? []
    // 规范化字段
    const models = list
      .filter((m) => typeof m.id === 'string' && m.id.length > 0)
      .map((m) => ({
        id: m.id,
        owned_by: m.owned_by,
        context_length: m.context_length,
      }))
    return { ok: true, models }
  } catch (e) {
    return { ok: false, models: [], error: (e as Error).message }
  }
}

// =============================================================================
// Route
// =============================================================================

export const userLlmConfigRoutes: FastifyPluginAsync = async (server) => {
  /** 所有路由都要求登录 */
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      reply.status(statusCode).send(error(statusCode, (e as Error).message || '需要登录'))
    }
  })

  // -----------------------------------------------------------------
  // 1. 平台模板列表(每个用户访问都返回,无需鉴权也可考虑)
  // -----------------------------------------------------------------
  server.get('/llm-configs/templates', async (_request, reply) => {
    return reply.send(success({ templates: PLATFORM_TEMPLATES }))
  })

  // -----------------------------------------------------------------
  // 2. 用户配置列表
  // -----------------------------------------------------------------
  server.get('/llm-configs', async (request, reply) => {
    const userId = request.userId!
    const rows = await db
      .select({
        id: aiModelConfig.id,
        name: aiModelConfig.name,
        providerCode: aiModelConfig.providerCode,
        isBuiltin: aiModelConfig.isBuiltin,
        baseUrl: aiModelConfig.baseUrl,
        apiFormat: aiModelConfig.apiFormat,
        modelIdForTest: aiModelConfig.modelIdForTest,
        enabled: aiModelConfig.enabled,
        description: aiModelConfig.description,
        extraConfig: aiModelConfig.extraConfig,
        lastTestStatus: aiModelConfig.lastTestStatus,
        lastTestResponseMs: aiModelConfig.lastTestResponseMs,
        lastTestedAt: aiModelConfig.lastTestedAt,
        lastTestError: aiModelConfig.lastTestError,
        hasApiKey: sql<boolean>`${aiModelConfig.apiKeyEnc} IS NOT NULL`,
        createdAt: aiModelConfig.createdAt,
        updatedAt: aiModelConfig.updatedAt,
      })
      .from(aiModelConfig)
      .where(eq(aiModelConfig.ownerUuid, userId))
      .orderBy(asc(aiModelConfig.sortOrder), desc(aiModelConfig.createdAt))

    // 解析 extra_config 中的 context_length
    const list = rows.map((r) => {
      let contextLength = 32000
      if (r.extraConfig) {
        try {
          const parsed = JSON.parse(r.extraConfig) as { contextLength?: number }
          if (typeof parsed.contextLength === 'number') contextLength = parsed.contextLength
        } catch {
          /* ignore */
        }
      }
      return { ...r, contextLength }
    })
    return reply.send(success({ list, total: list.length }))
  })

  // -----------------------------------------------------------------
  // 3. 从模板创建用户配置
  // -----------------------------------------------------------------
  server.post('/llm-configs', async (request, reply) => {
    const parsed = createConfigSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const data = parsed.data
    const userId = request.userId!
    const tpl = resolveTemplate(data.templateCode)

    if (tpl.code === 'custom' && !data.baseUrlOverride) {
      return reply.status(400).send(error(400, '自定义平台必须填写 baseUrl'))
    }
    if (!data.apiKey) {
      return reply.status(400).send(error(400, 'API Key 必填'))
    }

    const baseUrl = data.baseUrlOverride || tpl.baseUrl
    if (!baseUrl) {
      return reply.status(400).send(error(400, 'Base URL 未配置'))
    }

    const [row] = await db
      .insert(aiModelConfig)
      .values({
        name: data.name,
        providerCode: tpl.code,
        isBuiltin: false,
        baseUrl,
        apiFormat: tpl.apiFormat,
        apiKeyEnc: JSON.stringify(encryptJSON(data.apiKey)),
        modelIdForTest: data.modelId,
        enabled: true,
        description: data.description ?? null,
        sortOrder: 0,
        ownerUuid: userId,
        extraConfig: JSON.stringify({ contextLength: data.contextLength }),
      })
      .returning({ id: aiModelConfig.id })
    if (!row) return reply.status(500).send(error(500, '创建失败'))
    return reply.status(201).send(success({ id: row.id, created: true, name: data.name }))
  })

  // -----------------------------------------------------------------
  // 4. 更新用户配置
  // -----------------------------------------------------------------
  server.put('/llm-configs/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '无效的 ID'))
    const body = updateConfigSchema.safeParse(request.body)
    if (!body.success)
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))

    const id = p.data.id
    const userId = request.userId!
    const [existing] = await db
      .select()
      .from(aiModelConfig)
      .where(and(eq(aiModelConfig.id, id), eq(aiModelConfig.ownerUuid, userId)))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '配置不存在或无权限'))

    const update: Record<string, unknown> = { updatedAt: new Date() }
    if (body.data.name !== undefined) update.name = body.data.name
    if (body.data.modelId !== undefined) update.modelIdForTest = body.data.modelId
    if (body.data.description !== undefined) update.description = body.data.description
    if (body.data.enabled !== undefined) update.enabled = body.data.enabled
    if (body.data.baseUrlOverride !== undefined) update.baseUrl = body.data.baseUrlOverride
    if (body.data.apiKey) update.apiKeyEnc = JSON.stringify(encryptJSON(body.data.apiKey))
    if (body.data.contextLength !== undefined) {
      let extra: Record<string, unknown> = {}
      if (existing.extraConfig) {
        try {
          extra = JSON.parse(existing.extraConfig) as Record<string, unknown>
        } catch {
          /* ignore */
        }
      }
      extra.contextLength = body.data.contextLength
      update.extraConfig = JSON.stringify(extra)
    }

    await db
      .update(aiModelConfig)
      .set(update as never)
      .where(and(eq(aiModelConfig.id, id), eq(aiModelConfig.ownerUuid, userId)))
    return reply.send(success({ id, updated: true }))
  })

  // -----------------------------------------------------------------
  // 5. 删除
  // -----------------------------------------------------------------
  server.delete('/llm-configs/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '无效的 ID'))
    const userId = request.userId!
    const result = await db
      .delete(aiModelConfig)
      .where(and(eq(aiModelConfig.id, p.data.id), eq(aiModelConfig.ownerUuid, userId)))
      .returning({ id: aiModelConfig.id })
    if (result.length === 0) return reply.status(404).send(error(404, '配置不存在或无权限'))
    return reply.send(success({ id: p.data.id, deleted: true }))
  })

  // -----------------------------------------------------------------
  // 6. 测试连通
  // -----------------------------------------------------------------
  server.post('/llm-configs/:id/test', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '无效的 ID'))
    const userId = request.userId!
    const [row] = await db
      .select()
      .from(aiModelConfig)
      .where(and(eq(aiModelConfig.id, p.data.id), eq(aiModelConfig.ownerUuid, userId)))
      .limit(1)
    if (!row) return reply.status(404).send(error(404, '配置不存在或无权限'))

    const result = await testConnectivity(row)

    // 记录最近一次测试状态
    await db
      .update(aiModelConfig)
      .set({
        lastTestStatus: result.status,
        lastTestResponseMs: result.responseMs ?? null,
        lastTestedAt: new Date().toISOString(),
        lastTestError: result.error ?? null,
        updatedAt: new Date(),
      } as never)
      .where(eq(aiModelConfig.id, p.data.id))

    if (!result.ok) {
      return reply
        .status(502)
        .send(
          error(
            502,
            `连通失败: ${result.error ?? '未知错误'}${result.responseMs ? ` (${result.responseMs}ms)` : ''}`,
          ),
        )
    }
    return reply.send(
      success({
        status: 'success',
        responseMs: result.responseMs,
        modelEcho: result.modelEcho,
        message: `连通成功 (${result.responseMs ?? 0}ms)${result.modelEcho ? ` · ${result.modelEcho}` : ''}`,
      }),
    )
  })

  // -----------------------------------------------------------------
  // 7. 拉取上游模型列表
  // -----------------------------------------------------------------
  server.post('/llm-configs/:id/fetch-models', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '无效的 ID'))
    const userId = request.userId!
    const [row] = await db
      .select()
      .from(aiModelConfig)
      .where(and(eq(aiModelConfig.id, p.data.id), eq(aiModelConfig.ownerUuid, userId)))
      .limit(1)
    if (!row) return reply.status(404).send(error(404, '配置不存在或无权限'))

    const result = await fetchUpstreamModels(row)
    if (!result.ok) {
      return reply.status(502).send(error(502, `拉取模型失败: ${result.error ?? '未知错误'}`))
    }
    return reply.send(
      success({
        total: result.models.length,
        models: result.models,
        message: `已拉取 ${result.models.length} 个模型`,
      }),
    )
  })

  // -----------------------------------------------------------------
  // 8. 用临时配置(未保存)直接测试连通 — 用户在表单中实时校验
  //    POST /llm-configs/preview-test
  // -----------------------------------------------------------------
  const previewTestSchema = z.object({
    templateCode: z.string().min(1).max(64),
    apiKey: z.string().min(1).max(500),
    modelId: z.string().min(1).max(128),
    baseUrlOverride: z.string().url().optional(),
  })

  server.post('/llm-configs/preview-test', async (request, reply) => {
    const parsed = previewTestSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const { templateCode, modelId, baseUrlOverride } = parsed.data
    const tpl = resolveTemplate(templateCode)
    const baseUrl = baseUrlOverride || tpl.baseUrl
    if (!baseUrl) return reply.status(400).send(error(400, 'Base URL 未配置'))

    const start = Date.now()
    try {
      const resp = await fetch(`${aiServiceUrl()}/api/llm/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'user', content: 'Hello, this is a connectivity test. Reply with "OK".' },
          ],
          model: modelId || `${tpl.code}/test`,
          metadata: { testOnly: true, userId: request.userId },
        }),
      })
      const elapsed = Date.now() - start
      const json = (await resp.json().catch(() => ({}))) as Record<string, unknown>
      if (!resp.ok || json.error) {
        return reply
          .status(502)
          .send(
            error(
              502,
              `连通失败: ${String(json.error_message || json.message || `HTTP ${resp.status}`)} (${elapsed}ms)`,
            ),
          )
      }
      return reply.send(
        success({
          status: 'success',
          responseMs: elapsed,
          modelEcho: String(json.model ?? modelId),
          message: `连通成功 (${elapsed}ms) · ${json.model ?? modelId}`,
        }),
      )
    } catch (e) {
      return reply.status(502).send(error(502, `连通失败: ${(e as Error).message}`))
    }
  })
}
