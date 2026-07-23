/**
 * 用户 LLM 配置中心 v2 路由(Phase 1:1:N provider-model 数据模型)。
 *
 * 与 v1(user-llm-configs.ts)并存,**不破坏**现有接口,完全向后兼容。
 *
 * 数据模型(三张表):
 *  - ai_model_config            (v1 已有,作为 provider 主表)
 *  - ai_model_config_models     (Phase 1 新增,1:N 关联到 provider)
 *  - ai_model_config_groups     (Phase 1 新增,按用户分组聚合 provider)
 *
 * 设计原则:
 *  1. 全部 Zod 严格校验入参,禁止 any。
 *  2. 复用 v1 的 encryptJSON / decryptJSON / isEncryptedPayload(apiKey 加密存储)。
 *  3. 复用 v1 的 fetch + ai-service 协议做连通测试。
 *  4. 复用 PLATFORM_TEMPLATES(providerCode 必须在白名单内或 'custom')。
 *  5. 新表 schema 由 database subagent 同步落地,本文件**使用 raw SQL + db.execute**
 *     而非 Drizzle 对象,避免在 database 包未发布前 import 失败。
 *  6. 错误处理:表不存在 / 列不存在 → 返回空数据(列表)/ 503(写操作),不抛 500。
 *  7. 响应统一 { code, message, data }。
 *  8. 路由前缀:server.ts 注册 `prefix: '/api/v2/user'`,内部路径相对前缀。
 *
 * 接口清单(15 个):
 *  D. GET    /llm-providers/templates                预置平台模板
 *  A. GET    /llm-providers                          provider 列表(带 group 折叠)
 *  A. GET    /llm-providers/:id                      provider 详情(含 models)
 *  A. POST   /llm-providers                          创建 provider
 *  A. PUT    /llm-providers/:id                      更新 provider
 *  A. DELETE /llm-providers/:id                      删除 provider
 *  A. POST   /llm-providers/:id/test                 provider 连通测试
 *  A. POST   /llm-providers/:id/fetch-models         拉取上游模型列表
 *  A. POST   /llm-providers/:id/toggle               切换 enabled
 *  B. GET    /llm-providers/:id/models               model 列表
 *  B. POST   /llm-providers/:id/models               手动添加 model
 *  B. PUT    /llm-providers/:pid/models/:mid         更新 model
 *  B. DELETE /llm-providers/:pid/models/:mid         删除 model
 *  B. POST   /llm-providers/:pid/models/:mid/test    单 model 连通测试
 *  C. GET    /llm-groups                             group 列表
 *  C. POST   /llm-groups                             创建 group
 *  C. PUT    /llm-groups/:id                         更新 group
 *  C. DELETE /llm-groups/:id                         删除 group
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { eq, and, desc, sql, asc } from 'drizzle-orm'
import { db } from '../db/index.js'
import { aiModelConfig } from '@ihui/database'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import { encryptJSON, decryptJSON, isEncryptedPayload } from '../utils/crypto.js'
import { AppError } from '../errors/AppError.js'
import { PLATFORM_TEMPLATES, TEMPLATE_MAP, type PlatformTemplate } from '../utils/platform-templates.js'
import { fetchProviderModels, SUPPORTED_PROVIDERS } from '../services/provider-models.js'

// =============================================================================
// 常量
// =============================================================================

/** providerCode 白名单:已知模板 + custom */
const ALLOWED_PROVIDER_CODES = new Set<string>(PLATFORM_TEMPLATES.map((t) => t.code))

/** DB 缺失错误(relation/table 不存在)时的静默降级提示 */
const SCHEMA_NOT_READY_MSG = 'LLM 配置中心 v2 数据表尚未就绪,请等待 database 同步完成'

/** 全部 raw SQL 走 try/catch,捕获 42P01(relation not exists)/42703(column not exists) */
function isSchemaMissingError(err: unknown): boolean {
  const code = (err as { code?: string })?.code
  return code === '42P01' || code === '42703'
}

// =============================================================================
// Zod Schemas
// =============================================================================

const idParamSchema = z.object({ id: z.coerce.number().int().positive() })
const pidMidParamSchema = z.object({
  pid: z.coerce.number().int().positive(),
  mid: z.coerce.number().int().positive(),
})

/** 价格字段:用 numeric 字符串接收,避免 JS 浮点精度损失 */
const priceString = z
  .string()
  .regex(/^\d+(\.\d{1,6})?$/, '价格必须为非负数字字符串(最多 6 位小数)')
  .max(20)

const createProviderSchema = z.object({
  providerCode: z.string().min(1).max(64),
  name: z.string().min(1).max(100),
  apiKey: z.string().min(1).max(500),
  baseUrlOverride: z.string().url().max(500).optional(),
  apiFormat: z.enum(['openai_chat', 'anthropic_messages', 'openai_responses']).default('openai_chat'),
  providerGroup: z.string().min(1).max(64).default('default'),
  groupLabel: z.string().min(1).max(64).optional(),
  description: z.string().max(500).optional(),
  sortOrder: z.number().int().min(-10000).max(10000).default(0),
})

const updateProviderSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  apiKey: z.string().min(1).max(500).optional(),
  baseUrlOverride: z.string().url().max(500).optional(),
  apiFormat: z.enum(['openai_chat', 'anthropic_messages', 'openai_responses']).optional(),
  providerGroup: z.string().min(1).max(64).optional(),
  groupLabel: z.string().min(1).max(64).optional(),
  description: z.string().max(500).optional(),
  sortOrder: z.number().int().min(-10000).max(10000).optional(),
  enabled: z.boolean().optional(),
})

const createModelSchema = z.object({
  modelId: z.string().min(1).max(128),
  displayName: z.string().min(1).max(128).optional(),
  contextLength: z.number().int().min(512).max(2000000).default(32000),
  inputPricePer1k: priceString.default('0'),
  outputPricePer1k: priceString.default('0'),
  defaultParams: z.record(z.unknown()).default({}),
  enabled: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  sortOrder: z.number().int().min(-10000).max(10000).default(0),
  extraMetadata: z.record(z.unknown()).default({}),
})

const updateModelSchema = z.object({
  displayName: z.string().min(1).max(128).optional(),
  contextLength: z.number().int().min(512).max(2000000).optional(),
  inputPricePer1k: priceString.optional(),
  outputPricePer1k: priceString.optional(),
  defaultParams: z.record(z.unknown()).optional(),
  enabled: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  sortOrder: z.number().int().min(-10000).max(10000).optional(),
  extraMetadata: z.record(z.unknown()).optional(),
})

const createGroupSchema = z.object({
  label: z.string().min(1).max(64),
  sortOrder: z.number().int().min(-10000).max(10000).default(0),
})

const updateGroupSchema = z.object({
  label: z.string().min(1).max(64).optional(),
  sortOrder: z.number().int().min(-10000).max(10000).optional(),
})

/** 按 provider 名称拉取上游模型(7 个预置 provider) */
const fetchModelsByProviderSchema = z.object({
  provider: z.string().min(1).max(64),
  apiKey: z.string().min(1).max(500).optional(),
})

// =============================================================================
// Helpers
// =============================================================================

function resolveTemplate(code: string): PlatformTemplate {
  const t = TEMPLATE_MAP[code]
  if (!t) throw new AppError(`未知的平台模板: ${code}`, 400, 'INVALID_PROVIDER_CODE')
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
  return process.env.AI_SERVICE_URL || 'http://localhost:8000'
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
 * 与 v1 行为一致:模型参数格式为 `{providerCode}/{modelId}`。
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
  if (!apiKey) return { ok: false, status: 'failed', error: 'API Key 未配置或解密失败' }
  const start = Date.now()
  try {
    const resp = await fetch(`${aiServiceUrl()}/api/llm/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Hello, this is a connectivity test. Reply with "OK".' }],
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
    return { ok: false, status: 'failed', responseMs: Date.now() - start, error: (e as Error).message }
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
 * 与 v1 行为一致:google 原生端点没有 list 路径,直接硬编码。
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
  const url = `${row.baseUrl.replace(/\/$/, '')}/models`
  try {
    const resp = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}`, 'x-api-key': apiKey },
    })
    if (!resp.ok) {
      const t = await resp.text()
      return { ok: false, models: [], error: `HTTP ${resp.status}: ${t.slice(0, 200)}` }
    }
    const data = (await resp.json()) as { data?: UpstreamModel[]; models?: UpstreamModel[] }
    const list = data.data ?? data.models ?? []
    const models = list
      .filter((m) => typeof m.id === 'string' && m.id.length > 0)
      .map((m) => ({ id: m.id, owned_by: m.owned_by, context_length: m.context_length }))
    return { ok: true, models }
  } catch (e) {
    return { ok: false, models: [], error: (e as Error).message }
  }
}

// =============================================================================
// Model 行序列化
// =============================================================================

interface ModelRow {
  id: number
  config_id: number
  model_id: string
  display_name: string | null
  context_length: number
  input_price_per_1k: string
  output_price_per_1k: string
  default_params: unknown
  enabled: boolean
  is_default: boolean
  sort_order: number
  health_status: string
  last_health_check_at: string | null
  extra_metadata: unknown
  usage_30d_tokens: number
  usage_30d_cost_cents: number
  created_at: string
  updated_at: string
}

function parseModelRow(row: ModelRow): Record<string, unknown> {
  let defaultParams: Record<string, unknown> = {}
  if (row.default_params) {
    if (typeof row.default_params === 'string') {
      try {
        defaultParams = JSON.parse(row.default_params) as Record<string, unknown>
      } catch {
        /* ignore */
      }
    } else if (typeof row.default_params === 'object') {
      defaultParams = row.default_params as Record<string, unknown>
    }
  }
  let extraMetadata: Record<string, unknown> = {}
  if (row.extra_metadata) {
    if (typeof row.extra_metadata === 'string') {
      try {
        extraMetadata = JSON.parse(row.extra_metadata) as Record<string, unknown>
      } catch {
        /* ignore */
      }
    } else if (typeof row.extra_metadata === 'object') {
      extraMetadata = row.extra_metadata as Record<string, unknown>
    }
  }
  return {
    id: row.id,
    configId: row.config_id,
    modelId: row.model_id,
    displayName: row.display_name,
    contextLength: row.context_length,
    inputPricePer1k: row.input_price_per_1k,
    outputPricePer1k: row.output_price_per_1k,
    defaultParams,
    enabled: row.enabled,
    isDefault: row.is_default,
    sortOrder: row.sort_order,
    healthStatus: row.health_status,
    lastHealthCheckAt: row.last_health_check_at,
    extraMetadata,
    usage30dTokens: row.usage_30d_tokens,
    usage30dCostCents: row.usage_30d_cost_cents,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// =============================================================================
// 鉴权 preHandler
// =============================================================================

export const userLlmConfigV2Routes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      reply.status(statusCode).send(error(statusCode, (e as Error).message || '需要登录'))
    }
  })

  // ---------------------------------------------------------------------------
  // D. 平台模板
  // ---------------------------------------------------------------------------
  server.get('/llm-providers/templates', async (_request, reply) => {
    return reply.send(success({ templates: PLATFORM_TEMPLATES }))
  })

  // ---------------------------------------------------------------------------
  // A. Provider 列表(带 group 折叠)
  // ---------------------------------------------------------------------------
  server.get('/llm-providers', async (request, reply) => {
    const userId = request.userId!
    const providers = await db
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
        sortOrder: aiModelConfig.sortOrder,
        providerGroup: aiModelConfig.providerGroup,
        groupLabel: aiModelConfig.groupLabel,
        defaultModelId: aiModelConfig.defaultModelId,
        sortOrderInGroup: aiModelConfig.sortOrderInGroup,
        healthStatus: aiModelConfig.healthStatus,
        lastHealthCheckAt: aiModelConfig.lastHealthCheckAt,
        usage30dTokens: aiModelConfig.usage30dTokens,
        usage30dCostCents: aiModelConfig.usage30dCostCents,
        hasApiKey: sql<boolean>`${aiModelConfig.apiKeyEnc} IS NOT NULL`,
        lastTestStatus: aiModelConfig.lastTestStatus,
        lastTestedAt: aiModelConfig.lastTestedAt,
        createdAt: aiModelConfig.createdAt,
      })
      .from(aiModelConfig)
      .where(eq(aiModelConfig.ownerUuid, userId))
      .orderBy(
        asc(sql`COALESCE(${aiModelConfig.providerGroup}, 'default')`),
        asc(aiModelConfig.sortOrderInGroup),
        asc(aiModelConfig.sortOrder),
        desc(aiModelConfig.createdAt),
      )

    // 列出每个 provider 下的 models(用 raw SQL 静默降级)
    const providerIds = providers.map((p) => p.id)
    let modelRows: ModelRow[] = []
    if (providerIds.length > 0) {
      try {
        const res = await db.execute(sql`
          SELECT * FROM ai_model_config_models
          WHERE config_id IN (${sql.join(providerIds.map((id) => sql`${id}`), sql`, `)})
          ORDER BY config_id, sort_order ASC, id ASC
        `)
        modelRows = Array.isArray(res) ? (res as unknown as ModelRow[]) : ((res as { rows?: ModelRow[] }).rows ?? [])
      } catch (e) {
        if (!isSchemaMissingError(e)) throw e
        // schema 未就绪 → 静默降级,modelRows 留空
      }
    }
    const modelsByProvider = new Map<number, ReturnType<typeof parseModelRow>[]>()
    for (const m of modelRows) {
      const parsed = parseModelRow(m)
      const arr = modelsByProvider.get(m.config_id) ?? []
      arr.push(parsed)
      modelsByProvider.set(m.config_id, arr)
    }

    // 按 group 折叠
    const groupMap = new Map<
      string,
      { group: string; groupLabel: string; providers: Array<Record<string, unknown>> }
    >()
    for (const p of providers) {
      const g: string = p.providerGroup ?? 'default'
      const existing = groupMap.get(g)
      const entry = {
        ...p,
        models: modelsByProvider.get(p.id) ?? [],
      }
      if (existing) {
        existing.providers.push(entry)
      } else {
        groupMap.set(g, { group: g, groupLabel: p.groupLabel ?? g, providers: [entry] })
      }
    }

    return reply.send(
      success({
        groups: Array.from(groupMap.values()),
        total: providers.length,
      }),
    )
  })

  // ---------------------------------------------------------------------------
  // A. Provider 详情(含 models)
  // ---------------------------------------------------------------------------
  server.get<{ Params: { id: number } }>('/llm-providers/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '无效的 ID'))
    const userId = request.userId!
    const [row] = await db
      .select()
      .from(aiModelConfig)
      .where(and(eq(aiModelConfig.id, p.data.id), eq(aiModelConfig.ownerUuid, userId)))
      .limit(1)
    if (!row) return reply.status(404).send(error(404, 'provider 不存在或无权限'))

    let models: ReturnType<typeof parseModelRow>[] = []
    try {
      const res = await db.execute(sql`
        SELECT * FROM ai_model_config_models
        WHERE config_id = ${p.data.id}
        ORDER BY sort_order ASC, id ASC
      `)
      const rows = Array.isArray(res) ? (res as unknown as ModelRow[]) : ((res as { rows?: ModelRow[] }).rows ?? [])
      models = rows.map(parseModelRow)
    } catch (e) {
      if (!isSchemaMissingError(e)) throw e
    }

    return reply.send(success({ ...row, models }))
  })

  // ---------------------------------------------------------------------------
  // A. 创建 provider
  // ---------------------------------------------------------------------------
  server.post('/llm-providers', async (request, reply) => {
    const parsed = createProviderSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const data = parsed.data
    if (!ALLOWED_PROVIDER_CODES.has(data.providerCode)) {
      return reply.status(400).send(error(400, `providerCode 必须在白名单内或为 'custom'`))
    }
    const tpl = resolveTemplate(data.providerCode)
    if (data.providerCode === 'custom' && !data.baseUrlOverride) {
      return reply.status(400).send(error(400, '自定义平台必须填写 baseUrl'))
    }
    const baseUrl = data.baseUrlOverride || tpl.baseUrl
    if (!baseUrl) return reply.status(400).send(error(400, 'Base URL 未配置'))

    const userId = request.userId!
    const [created] = await db
      .insert(aiModelConfig)
      .values({
        name: data.name,
        providerCode: tpl.code,
        isBuiltin: false,
        baseUrl,
        apiFormat: data.apiFormat,
        apiKeyEnc: JSON.stringify(encryptJSON(data.apiKey)),
        modelIdForTest: null,
        enabled: true,
        description: data.description ?? null,
        sortOrder: data.sortOrder,
        ownerUuid: userId,
        // Phase 1: 写入专用列,不再走 extraConfig
        providerGroup: data.providerGroup,
        groupLabel: data.groupLabel ?? data.providerGroup,
        sortOrderInGroup: data.sortOrder,
        healthStatus: 'unknown',
      })
      .returning({ id: aiModelConfig.id })
    if (!created) return reply.status(500).send(error(500, '创建失败'))
    return reply.status(201).send(success({ id: created.id, created: true, name: data.name }))
  })

  // ---------------------------------------------------------------------------
  // A. 更新 provider
  // ---------------------------------------------------------------------------
  server.put<{ Params: { id: number } }>('/llm-providers/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '无效的 ID'))
    const body = updateProviderSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const id = p.data.id
    const userId = request.userId!
    const [existing] = await db
      .select()
      .from(aiModelConfig)
      .where(and(eq(aiModelConfig.id, id), eq(aiModelConfig.ownerUuid, userId)))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, 'provider 不存在或无权限'))

    const update: Record<string, unknown> = { updatedAt: new Date() }
    if (body.data.name !== undefined) update.name = body.data.name
    if (body.data.baseUrlOverride !== undefined) update.baseUrl = body.data.baseUrlOverride
    if (body.data.apiFormat !== undefined) update.apiFormat = body.data.apiFormat
    if (body.data.description !== undefined) update.description = body.data.description
    if (body.data.enabled !== undefined) update.enabled = body.data.enabled
    if (body.data.sortOrder !== undefined) update.sortOrder = body.data.sortOrder
    if (body.data.apiKey) update.apiKeyEnc = JSON.stringify(encryptJSON(body.data.apiKey))

    // providerGroup / groupLabel 写入专用列(2026-07-22 立)
    if (body.data.providerGroup !== undefined) update.providerGroup = body.data.providerGroup
    if (body.data.groupLabel !== undefined) update.groupLabel = body.data.groupLabel

    await db
      .update(aiModelConfig)
      .set(update as never)
      .where(and(eq(aiModelConfig.id, id), eq(aiModelConfig.ownerUuid, userId)))
    return reply.send(success({ id, updated: true }))
  })

  // ---------------------------------------------------------------------------
  // A. 删除 provider(CASCADE 自动删 models)
  // ---------------------------------------------------------------------------
  server.delete<{ Params: { id: number } }>('/llm-providers/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '无效的 ID'))
    const userId = request.userId!
    const result = await db
      .delete(aiModelConfig)
      .where(and(eq(aiModelConfig.id, p.data.id), eq(aiModelConfig.ownerUuid, userId)))
      .returning({ id: aiModelConfig.id })
    if (result.length === 0) return reply.status(404).send(error(404, 'provider 不存在或无权限'))
    return reply.send(success({ id: p.data.id, deleted: true }))
  })

  // ---------------------------------------------------------------------------
  // A. provider 测试连通
  // ---------------------------------------------------------------------------
  server.post<{ Params: { id: number } }>('/llm-providers/:id/test', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '无效的 ID'))
    const userId = request.userId!
    const [row] = await db
      .select()
      .from(aiModelConfig)
      .where(and(eq(aiModelConfig.id, p.data.id), eq(aiModelConfig.ownerUuid, userId)))
      .limit(1)
    if (!row) return reply.status(404).send(error(404, 'provider 不存在或无权限'))

    const result = await testConnectivity(row)
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
      return reply.status(502).send(
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

  // ---------------------------------------------------------------------------
  // A. 拉取上游模型
  // ---------------------------------------------------------------------------
  server.post<{ Params: { id: number } }>('/llm-providers/:id/fetch-models', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '无效的 ID'))
    const userId = request.userId!
    const [row] = await db
      .select()
      .from(aiModelConfig)
      .where(and(eq(aiModelConfig.id, p.data.id), eq(aiModelConfig.ownerUuid, userId)))
      .limit(1)
    if (!row) return reply.status(404).send(error(404, 'provider 不存在或无权限'))

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

  // ---------------------------------------------------------------------------
  // A. 按 provider 名称拉取上游模型(7 个预置 provider,Redis 缓存 24h,失败降级 FALLBACK)
  //    POST /llm-providers/fetch-models  body: { provider, apiKey? }
  //    与上面的 :id/fetch-models 区别:此处按 provider 名称(非用户已保存配置),
  //    使用环境变量 API key(或 body 传入),命中 Redis 缓存优先返回。
  // ---------------------------------------------------------------------------
  server.post('/llm-providers/fetch-models', async (request, reply) => {
    const body = fetchModelsByProviderSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const { provider, apiKey } = body.data
    if (!SUPPORTED_PROVIDERS.includes(provider)) {
      return reply.status(400).send(error(400, `不支持的 provider: ${provider}`))
    }
    const result = await fetchProviderModels(provider, apiKey, server.redis)
    return reply.send(success(result))
  })

  // ---------------------------------------------------------------------------
  // A. 切换 enabled
  // ---------------------------------------------------------------------------
  server.post<{ Params: { id: number } }>('/llm-providers/:id/toggle', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '无效的 ID'))
    const userId = request.userId!
    const [row] = await db
      .select({ id: aiModelConfig.id, enabled: aiModelConfig.enabled })
      .from(aiModelConfig)
      .where(and(eq(aiModelConfig.id, p.data.id), eq(aiModelConfig.ownerUuid, userId)))
      .limit(1)
    if (!row) return reply.status(404).send(error(404, 'provider 不存在或无权限'))

    const next = !row.enabled
    await db
      .update(aiModelConfig)
      .set({ enabled: next, updatedAt: new Date() } as never)
      .where(eq(aiModelConfig.id, p.data.id))
    return reply.send(success({ id: p.data.id, enabled: next }))
  })

  // ---------------------------------------------------------------------------
  // B. 列出某 provider 下所有 models
  // ---------------------------------------------------------------------------
  server.get<{ Params: { id: number } }>('/llm-providers/:id/models', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '无效的 ID'))
    const userId = request.userId!
    const [row] = await db
      .select({ id: aiModelConfig.id })
      .from(aiModelConfig)
      .where(and(eq(aiModelConfig.id, p.data.id), eq(aiModelConfig.ownerUuid, userId)))
      .limit(1)
    if (!row) return reply.status(404).send(error(404, 'provider 不存在或无权限'))

    try {
      const res = await db.execute(sql`
        SELECT * FROM ai_model_config_models
        WHERE config_id = ${p.data.id}
        ORDER BY sort_order ASC, id ASC
      `)
      const rows = Array.isArray(res) ? (res as unknown as ModelRow[]) : ((res as { rows?: ModelRow[] }).rows ?? [])
      return reply.send(success({ list: rows.map(parseModelRow), total: rows.length }))
    } catch (e) {
      if (isSchemaMissingError(e)) {
        return reply.status(503).send(error(503, SCHEMA_NOT_READY_MSG))
      }
      throw e
    }
  })

  // ---------------------------------------------------------------------------
  // B. 手动添加 model(isDefault 唯一性用事务保证)
  // ---------------------------------------------------------------------------
  server.post<{ Params: { id: number } }>('/llm-providers/:id/models', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '无效的 ID'))
    const body = createModelSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const data = body.data
    const userId = request.userId!
    const [parent] = await db
      .select({ id: aiModelConfig.id })
      .from(aiModelConfig)
      .where(and(eq(aiModelConfig.id, p.data.id), eq(aiModelConfig.ownerUuid, userId)))
      .limit(1)
    if (!parent) return reply.status(404).send(error(404, 'provider 不存在或无权限'))

    try {
      const result = await db.transaction(async (tx) => {
        if (data.isDefault) {
          // 同一 provider 下其他 is_default=true 全部置为 false
          await tx.execute(sql`
            UPDATE ai_model_config_models
            SET is_default = FALSE, updated_at = NOW()
            WHERE config_id = ${p.data.id} AND is_default = TRUE
          `)
        }
        const res = await tx.execute(sql`
          INSERT INTO ai_model_config_models (
            config_id, model_id, display_name, context_length,
            input_price_per_1k, output_price_per_1k,
            default_params, enabled, is_default, sort_order,
            health_status, last_health_check_at, extra_metadata,
            usage_30d_tokens, usage_30d_cost_cents,
            created_at, updated_at
          ) VALUES (
            ${p.data.id}, ${data.modelId}, ${data.displayName ?? data.modelId}, ${data.contextLength},
            ${data.inputPricePer1k}, ${data.outputPricePer1k},
            ${JSON.stringify(data.defaultParams)}::jsonb, ${data.enabled}, ${data.isDefault}, ${data.sortOrder},
            'unknown', NULL, ${JSON.stringify(data.extraMetadata)}::jsonb,
            0, 0,
            NOW(), NOW()
          )
          RETURNING id
        `)
        const rows = Array.isArray(res) ? (res as unknown as Array<{ id: number }>) : ((res as { rows?: Array<{ id: number }> }).rows ?? [])
        return rows[0]?.id
      })
      if (!result) return reply.status(500).send(error(500, '创建失败'))
      return reply.status(201).send(success({ id: result, created: true, modelId: data.modelId }))
    } catch (e) {
      if (isSchemaMissingError(e)) {
        return reply.status(503).send(error(503, SCHEMA_NOT_READY_MSG))
      }
      throw e
    }
  })

  // ---------------------------------------------------------------------------
  // B. 更新 model
  // ---------------------------------------------------------------------------
  server.put<{ Params: { pid: number; mid: number } }>(
    '/llm-providers/:pid/models/:mid',
    async (request, reply) => {
      const p = pidMidParamSchema.safeParse(request.params)
      if (!p.success) return reply.status(400).send(error(400, '无效的 ID'))
      const body = updateModelSchema.safeParse(request.body)
      if (!body.success) {
        return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
      }
      const userId = request.userId!
      const [parent] = await db
        .select({ id: aiModelConfig.id })
        .from(aiModelConfig)
        .where(and(eq(aiModelConfig.id, p.data.pid), eq(aiModelConfig.ownerUuid, userId)))
        .limit(1)
      if (!parent) return reply.status(404).send(error(404, 'provider 不存在或无权限'))

      try {
        await db.transaction(async (tx) => {
          if (body.data.isDefault === true) {
            await tx.execute(sql`
              UPDATE ai_model_config_models
              SET is_default = FALSE, updated_at = NOW()
              WHERE config_id = ${p.data.pid} AND id <> ${p.data.mid} AND is_default = TRUE
            `)
          }
          const sets: ReturnType<typeof sql>[] = []
          if (body.data.displayName !== undefined) sets.push(sql`display_name = ${body.data.displayName}`)
          if (body.data.contextLength !== undefined)
            sets.push(sql`context_length = ${body.data.contextLength}`)
          if (body.data.inputPricePer1k !== undefined)
            sets.push(sql`input_price_per_1k = ${body.data.inputPricePer1k}`)
          if (body.data.outputPricePer1k !== undefined)
            sets.push(sql`output_price_per_1k = ${body.data.outputPricePer1k}`)
          if (body.data.defaultParams !== undefined)
            sets.push(sql`default_params = ${JSON.stringify(body.data.defaultParams)}::jsonb`)
          if (body.data.enabled !== undefined) sets.push(sql`enabled = ${body.data.enabled}`)
          if (body.data.isDefault !== undefined) sets.push(sql`is_default = ${body.data.isDefault}`)
          if (body.data.sortOrder !== undefined) sets.push(sql`sort_order = ${body.data.sortOrder}`)
          if (body.data.extraMetadata !== undefined)
            sets.push(sql`extra_metadata = ${JSON.stringify(body.data.extraMetadata)}::jsonb`)
          sets.push(sql`updated_at = NOW()`)
          if (sets.length === 1) return
          await tx.execute(sql`
            UPDATE ai_model_config_models
            SET ${sql.join(sets, sql`, `)}
            WHERE id = ${p.data.mid} AND config_id = ${p.data.pid}
          `)
        })
        return reply.send(success({ id: p.data.mid, updated: true }))
      } catch (e) {
        if (isSchemaMissingError(e)) {
          return reply.status(503).send(error(503, SCHEMA_NOT_READY_MSG))
        }
        throw e
      }
    },
  )

  // ---------------------------------------------------------------------------
  // B. 删除 model
  // ---------------------------------------------------------------------------
  server.delete<{ Params: { pid: number; mid: number } }>(
    '/llm-providers/:pid/models/:mid',
    async (request, reply) => {
      const p = pidMidParamSchema.safeParse(request.params)
      if (!p.success) return reply.status(400).send(error(400, '无效的 ID'))
      const userId = request.userId!
      const [parent] = await db
        .select({ id: aiModelConfig.id })
        .from(aiModelConfig)
        .where(and(eq(aiModelConfig.id, p.data.pid), eq(aiModelConfig.ownerUuid, userId)))
        .limit(1)
      if (!parent) return reply.status(404).send(error(404, 'provider 不存在或无权限'))

      try {
        const res = await db.execute(sql`
          DELETE FROM ai_model_config_models
          WHERE id = ${p.data.mid} AND config_id = ${p.data.pid}
          RETURNING id
        `)
        const rows = Array.isArray(res) ? (res as unknown as Array<{ id: number }>) : ((res as { rows?: Array<{ id: number }> }).rows ?? [])
        if (rows.length === 0) return reply.status(404).send(error(404, 'model 不存在'))
        return reply.send(success({ id: p.data.mid, deleted: true }))
      } catch (e) {
        if (isSchemaMissingError(e)) {
          return reply.status(503).send(error(503, SCHEMA_NOT_READY_MSG))
        }
        throw e
      }
    },
  )

  // ---------------------------------------------------------------------------
  // B. 单 model 连通测试(用该 model 的 model_id 替换 provider 默认 model)
  // ---------------------------------------------------------------------------
  server.post<{ Params: { pid: number; mid: number } }>(
    '/llm-providers/:pid/models/:mid/test',
    async (request, reply) => {
      const p = pidMidParamSchema.safeParse(request.params)
      if (!p.success) return reply.status(400).send(error(400, '无效的 ID'))
      const userId = request.userId!
      const [row] = await db
        .select()
        .from(aiModelConfig)
        .where(and(eq(aiModelConfig.id, p.data.pid), eq(aiModelConfig.ownerUuid, userId)))
        .limit(1)
      if (!row) return reply.status(404).send(error(404, 'provider 不存在或无权限'))

      let modelIdForTest: string | null = null
      try {
        const res = await db.execute(sql`
          SELECT model_id FROM ai_model_config_models
          WHERE id = ${p.data.mid} AND config_id = ${p.data.pid}
          LIMIT 1
        `)
        const rows = Array.isArray(res)
          ? (res as unknown as Array<{ model_id: string }>)
          : ((res as { rows?: Array<{ model_id: string }> }).rows ?? [])
        modelIdForTest = rows[0]?.model_id ?? null
      } catch (e) {
        if (!isSchemaMissingError(e)) throw e
      }
      if (!modelIdForTest) return reply.status(404).send(error(404, 'model 不存在'))

      const result = await testConnectivity({ ...row, modelIdForTest })
      if (!result.ok) {
        return reply.status(502).send(
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
    },
  )

  // ---------------------------------------------------------------------------
  // C. Group 列表
  // ---------------------------------------------------------------------------
  server.get('/llm-groups', async (request, reply) => {
    const userId = request.userId!
    try {
      const res = await db.execute(sql`
        SELECT id, label, sort_order, created_at, updated_at
        FROM ai_model_config_groups
        WHERE owner_uuid = ${userId}
        ORDER BY sort_order ASC, id ASC
      `)
      const rows = Array.isArray(res) ? (res as unknown as Array<Record<string, unknown>>) : ((res as { rows?: Array<Record<string, unknown>> }).rows ?? [])
      return reply.send(success({ list: rows, total: rows.length }))
    } catch (e) {
      if (isSchemaMissingError(e)) {
        return reply.send(success({ list: [], total: 0, schemaPending: true }))
      }
      throw e
    }
  })

  // ---------------------------------------------------------------------------
  // C. 创建 group
  // ---------------------------------------------------------------------------
  server.post('/llm-groups', async (request, reply) => {
    const parsed = createGroupSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const userId = request.userId!
    try {
      const res = await db.execute(sql`
        INSERT INTO ai_model_config_groups (owner_uuid, label, sort_order, created_at, updated_at)
        VALUES (${userId}, ${parsed.data.label}, ${parsed.data.sortOrder}, NOW(), NOW())
        RETURNING id
      `)
      const rows = Array.isArray(res) ? (res as unknown as Array<{ id: number }>) : ((res as { rows?: Array<{ id: number }> }).rows ?? [])
      if (!rows[0]) return reply.status(500).send(error(500, '创建失败'))
      return reply.status(201).send(success({ id: rows[0].id, created: true, label: parsed.data.label }))
    } catch (e) {
      if (isSchemaMissingError(e)) {
        return reply.status(503).send(error(503, SCHEMA_NOT_READY_MSG))
      }
      throw e
    }
  })

  // ---------------------------------------------------------------------------
  // C. 更新 group
  // ---------------------------------------------------------------------------
  server.put<{ Params: { id: number } }>('/llm-groups/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '无效的 ID'))
    const body = updateGroupSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const userId = request.userId!
    const sets: ReturnType<typeof sql>[] = []
    if (body.data.label !== undefined) sets.push(sql`label = ${body.data.label}`)
    if (body.data.sortOrder !== undefined) sets.push(sql`sort_order = ${body.data.sortOrder}`)
    if (sets.length === 0) return reply.send(success({ id: p.data.id, updated: false, noop: true }))
    sets.push(sql`updated_at = NOW()`)
    try {
      const res = await db.execute(sql`
        UPDATE ai_model_config_groups
        SET ${sql.join(sets, sql`, `)}
        WHERE id = ${p.data.id} AND owner_uuid = ${userId}
        RETURNING id
      `)
      const rows = Array.isArray(res) ? (res as unknown as Array<{ id: number }>) : ((res as { rows?: Array<{ id: number }> }).rows ?? [])
      if (rows.length === 0) return reply.status(404).send(error(404, 'group 不存在或无权限'))
      return reply.send(success({ id: p.data.id, updated: true }))
    } catch (e) {
      if (isSchemaMissingError(e)) {
        return reply.status(503).send(error(503, SCHEMA_NOT_READY_MSG))
      }
      throw e
    }
  })

  // ---------------------------------------------------------------------------
  // C. 删除 group(若 group 下还有 provider → 拒绝)
  // ---------------------------------------------------------------------------
  server.delete<{ Params: { id: number } }>('/llm-groups/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '无效的 ID'))
    const userId = request.userId!
    const groupLabel = String(p.data.id) // 用 id 强转 label 查询冗余
    try {
      // 先查 group label
      const groupRes = await db.execute(sql`
        SELECT id, label FROM ai_model_config_groups
        WHERE id = ${p.data.id} AND owner_uuid = ${userId}
        LIMIT 1
      `)
      const groupRows = Array.isArray(groupRes)
        ? (groupRes as unknown as Array<{ id: number; label: string }>)
        : ((groupRes as { rows?: Array<{ id: number; label: string }> }).rows ?? [])
      if (groupRows.length === 0) return reply.status(404).send(error(404, 'group 不存在或无权限'))
      const label = groupRows[0]?.label ?? groupLabel

      // 检查 group 下是否还有 provider(用独立列 provider_group 查询)
      const countRes = await db.execute(sql`
        SELECT COUNT(*)::int AS cnt FROM ai_model_config
        WHERE owner_uuid = ${userId}
          AND provider_group = ${label}
      `)
      const cntRows = Array.isArray(countRes)
        ? (countRes as unknown as Array<{ cnt: number }>)
        : ((countRes as { rows?: Array<{ cnt: number }> }).rows ?? [])
      const cnt = cntRows[0]?.cnt ?? 0
      if (cnt > 0) {
        return reply.status(409).send(error(409, `group 下还有 ${cnt} 个 provider,无法删除`))
      }

      const delRes = await db.execute(sql`
        DELETE FROM ai_model_config_groups
        WHERE id = ${p.data.id} AND owner_uuid = ${userId}
        RETURNING id
      `)
      const delRows = Array.isArray(delRes)
        ? (delRes as unknown as Array<{ id: number }>)
        : ((delRes as { rows?: Array<{ id: number }> }).rows ?? [])
      if (delRows.length === 0) return reply.status(404).send(error(404, 'group 不存在或无权限'))
      return reply.send(success({ id: p.data.id, deleted: true }))
    } catch (e) {
      if (isSchemaMissingError(e)) {
        return reply.status(503).send(error(503, SCHEMA_NOT_READY_MSG))
      }
      throw e
    }
  })
}
