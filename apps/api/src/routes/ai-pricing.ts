/**
 * AI 模型定价公开查询路由(P0-3a/b 配套,2026-07-28 立)。
 *
 * 数据源:ai_pricing 表(176 条 seed,见 packages/database/seed/ai-pricing-seed.ts)。
 * 单位:分/千 token(整数,避免浮点误差),前端展示时按需折算为元/百万 token。
 *
 * 路由:
 *   - GET /api/ai-pricing              列表,支持 search/vendor/page/pageSize
 *   - GET /api/ai-pricing/stats        厂商分组统计(用于前端按厂商分组展示)
 *   - GET /api/ai-pricing/:modelId     单个模型定价详情
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, ilike, or, asc, sql, type SQL } from 'drizzle-orm'
import { db } from '../db/index.js'
import { aiPricing } from '@ihui/database'
import { success, error, emptyToUndefined, paginatedSuccess } from '../utils/response.js'

// =============================================================================
// Zod schemas
// =============================================================================

const listQuerySchema = z.object({
  search: z.transform(emptyToUndefined).pipe(z.string().max(128).optional()),
  vendor: z.transform(emptyToUndefined).pipe(z.string().max(64).optional()),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
})

const modelIdParamSchema = z.object({
  modelId: z.string().min(1).max(128),
})

// =============================================================================
// 厂商识别(基于 modelId 前缀,与 seed 数据命名规范对齐)
// =============================================================================

interface VendorRule {
  vendor: string
  label: string
  prefixes: string[]
}

const VENDOR_RULES: VendorRule[] = [
  // 国际原厂(优先匹配,避免被推理平台前缀抢匹配)
  { vendor: 'openai', label: 'OpenAI', prefixes: ['gpt-', 'o3', 'o4', 'text-embedding-'] },
  { vendor: 'anthropic', label: 'Anthropic', prefixes: ['claude-'] },
  { vendor: 'google', label: 'Google Gemini', prefixes: ['gemini-', 'gemma-', 'vertex/gemini-'] },
  { vendor: 'vertex', label: 'Google Vertex AI', prefixes: ['vertex/'] },
  { vendor: 'deepseek', label: 'DeepSeek', prefixes: ['deepseek-', 'siliconcloud/deepseek-ai/'] },
  { vendor: 'qwen', label: '通义千问', prefixes: ['qwen-', 'qwen2.', 'qwen3.', 'bailian/qwen-', 'featherless/qwen/', 'modelscope/Qwen/', 'ppio/qwen/', 'siliconcloud/Qwen/'] },
  { vendor: 'zhipu', label: '智谱', prefixes: ['glm-'] },
  { vendor: 'moonshot', label: '月之暗面', prefixes: ['moonshot-', 'kimi-'] },
  { vendor: 'doubao', label: '字节豆包', prefixes: ['doubao-', 'volcengine/doubao-', 'dreamina-'] },
  { vendor: 'minimax', label: 'MiniMax', prefixes: ['minimax-', 'abab'] },
  { vendor: 'baichuan', label: '百川', prefixes: ['baichuan-'] },
  { vendor: 'yi', label: '零一万物', prefixes: ['yi-'] },
  { vendor: 'stepfun', label: '阶跃星辰', prefixes: ['step-', 'stepfun/'] },
  { vendor: 'baidu', label: '百度文心', prefixes: ['ernie-'] },
  { vendor: 'tencent', label: '腾讯混元', prefixes: ['hunyuan-'] },
  { vendor: 'sensetime', label: '商汤日日新', prefixes: ['sensenova-'] },
  { vendor: 'internlm', label: '上海AI实验室', prefixes: ['internlm'] },
  { vendor: 'kunlun', label: '昆仑万维天工', prefixes: ['skywork-'] },
  { vendor: 'iflytek', label: '科大讯飞星火', prefixes: ['spark-'] },
  { vendor: 'mistral', label: 'Mistral', prefixes: ['mistral-', 'codestral-', 'pixtral-', 'open-mixtral-'] },
  { vendor: 'meta', label: 'Meta Llama', prefixes: ['llama-', 'meta-llama'] },
  { vendor: 'xai', label: 'xAI Grok', prefixes: ['grok-'] },
  { vendor: 'cohere', label: 'Cohere', prefixes: ['command-', 'cohere-embed-'] },
  { vendor: 'microsoft', label: 'Microsoft', prefixes: ['phi-', 'mai-', 'muse-'] },
  { vendor: 'perplexity', label: 'Perplexity', prefixes: ['sonar-'] },
  { vendor: 'nvidia', label: 'Nvidia', prefixes: ['nemotron-'] },
  { vendor: 'ai21', label: 'AI21 Labs', prefixes: ['jamba-'] },
  { vendor: 'alephalpha', label: 'Aleph Alpha', prefixes: ['luminous-'] },
  { vendor: 'snowflake', label: 'Snowflake', prefixes: ['snowflake-'] },
  { vendor: 'voyage', label: 'Voyage AI', prefixes: ['voyage-'] },
  { vendor: 'replit', label: 'Replit', prefixes: ['replit/'] },
  { vendor: 'upstage', label: 'Upstage', prefixes: ['upstage/'] },
  { vendor: 'ai2', label: 'AI2 OLMo', prefixes: ['ai2/'] },
  { vendor: 'baai', label: 'BAAI 智源', prefixes: ['baai/'] },
  { vendor: 'tii', label: 'TII Falcon', prefixes: ['tii/'] },
  { vendor: 'liquid', label: 'Liquid AI', prefixes: ['liquid/'] },
  { vendor: 'nous', label: 'Nous Research', prefixes: ['nous-'] },
  // 云厂商
  { vendor: 'aws', label: 'AWS Nova', prefixes: ['amazon-nova-'] },
  { vendor: 'bedrock', label: 'AWS Bedrock', prefixes: ['bedrock/'] },
  { vendor: 'azure', label: 'Azure OpenAI', prefixes: ['azure/'] },
  // 推理平台(放最后,前缀匹配优先级低)
  { vendor: 'openrouter', label: 'OpenRouter', prefixes: ['openrouter/'] },
  { vendor: 'huggingface', label: 'HuggingFace', prefixes: ['huggingface/'] },
  { vendor: 'replicate', label: 'Replicate', prefixes: ['replicate/'] },
  { vendor: 'together', label: 'Together AI', prefixes: ['together/'] },
  { vendor: 'fireworks', label: 'Fireworks AI', prefixes: ['fireworks/'] },
  { vendor: 'groq', label: 'Groq', prefixes: ['groq/'] },
  { vendor: 'cerebras', label: 'Cerebras', prefixes: ['cerebras/'] },
  { vendor: 'sambanova', label: 'SambaNova', prefixes: ['sambanova/'] },
  { vendor: 'anyscale', label: 'Anyscale', prefixes: ['anyscale/'] },
  { vendor: 'deepinfra', label: 'DeepInfra', prefixes: ['deepinfra/'] },
  { vendor: 'baseten', label: 'Baseten', prefixes: ['baseten/'] },
  { vendor: 'centml', label: 'CentML', prefixes: ['centml/'] },
  { vendor: 'crusoe', label: 'Crusoe', prefixes: ['crusoe/'] },
  { vendor: 'friendli', label: 'FriendliAI', prefixes: ['friendli/'] },
  { vendor: 'hyperbolic', label: 'Hyperbolic', prefixes: ['hyperbolic/'] },
  { vendor: 'leptonai', label: 'Lepton AI', prefixes: ['leptonai/'] },
  { vendor: 'nebius', label: 'Nebius', prefixes: ['nebius/'] },
  { vendor: 'novita', label: 'Novita AI', prefixes: ['novita/'] },
  { vendor: 'parasail', label: 'Parasail', prefixes: ['parasail/'] },
  { vendor: 'lambda', label: 'Lambda Labs', prefixes: ['lambda/'] },
  { vendor: 'targon', label: 'Targon', prefixes: ['targon/'] },
  { vendor: 'siliconcloud', label: 'SiliconCloud', prefixes: ['siliconcloud/'] },
  { vendor: 'lmstudio', label: 'LM Studio', prefixes: ['lmstudio/'] },
  { vendor: 'ollama', label: 'Ollama', prefixes: ['ollama/'] },
  { vendor: 'openwebui', label: 'OpenWebUI', prefixes: ['openwebui/'] },
  { vendor: 'featherless', label: 'Featherless', prefixes: ['featherless/'] },
  { vendor: 'modelscope', label: 'ModelScope', prefixes: ['modelscope/'] },
  { vendor: 'ppio', label: 'PPIO', prefixes: ['ppio/'] },
  { vendor: 'stability', label: 'Stability AI', prefixes: ['stablelm-'] },
  { vendor: 'inflection', label: 'Inflection AI', prefixes: ['inflection-'] },
  { vendor: 'ibm', label: 'IBM watsonx', prefixes: ['watsonx/'] },
]

function detectVendor(modelId: string): { vendor: string; label: string } {
  const lower = modelId.toLowerCase()
  for (const rule of VENDOR_RULES) {
    if (rule.prefixes.some((p) => lower.startsWith(p))) {
      return { vendor: rule.vendor, label: rule.label }
    }
  }
  return { vendor: 'other', label: '其他' }
}

// =============================================================================
// 路由
// =============================================================================

const aiPricingRoutes: FastifyPluginAsync = async (server) => {
  // GET /api/ai-pricing — 列表(支持 search/vendor 过滤 + 分页)
  server.get('/ai-pricing', async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { search, vendor, page, pageSize } = parsed.data
    const offset = (page - 1) * pageSize

    const whereClauses: SQL[] = []
    if (search) {
      whereClauses.push(ilike(aiPricing.modelId, `%${search}%`))
    }
    if (vendor && vendor !== 'all') {
      // 厂商过滤:基于前缀匹配(用 LIKE 模拟 startsWith)
      const rule = VENDOR_RULES.find((r) => r.vendor === vendor)
      if (rule) {
        const orClauses = rule.prefixes.map((p) => ilike(aiPricing.modelId, `${p}%`))
        const vendorWhere =
          orClauses.length === 1 ? orClauses[0] : or(...orClauses)
        if (vendorWhere) whereClauses.push(vendorWhere)
      }
    }

    const where =
      whereClauses.length === 0
        ? undefined
        : whereClauses.length === 1
          ? whereClauses[0]
          : sql.join(whereClauses, sql` AND `)

    const rows = await db
      .select({
        id: aiPricing.id,
        modelId: aiPricing.modelId,
        inputTokenPrice: aiPricing.inputTokenPrice,
        outputTokenPrice: aiPricing.outputTokenPrice,
        regionPricing: aiPricing.regionPricing,
        discount: aiPricing.discount,
        currency: aiPricing.currency,
        effectiveAt: aiPricing.effectiveAt,
      })
      .from(aiPricing)
      .where(where)
      .orderBy(asc(aiPricing.modelId))
      .limit(pageSize)
      .offset(offset)

    const countRows = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(aiPricing)
      .where(where)
    const total = countRows[0]?.c ?? 0

    // 附加 vendor 字段(前端分组用)
    // 注意:响应字段用别名 inputPrice/outputPrice(去掉 "Token" 子串),
    // 否则 response-sanitizer 会因字段名包含 "token" 把值脱敏为 "***"
    const items = rows.map((r) => {
      const { vendor, label } = detectVendor(r.modelId)
      return {
        id: r.id,
        modelId: r.modelId,
        inputPrice: Number(r.inputTokenPrice),
        outputPrice: Number(r.outputTokenPrice),
        regionPricing: r.regionPricing,
        discount: r.discount,
        currency: r.currency,
        effectiveAt: r.effectiveAt,
        vendor,
        vendorLabel: label,
      }
    })

    return reply.send(paginatedSuccess(items, total, { page, pageSize }))
  })

  // GET /api/ai-pricing/stats — 厂商分组统计(用于前端分组 Tab)
  server.get('/ai-pricing/stats', async (_request, reply) => {
    const rows = await db.select({ modelId: aiPricing.modelId }).from(aiPricing)
    const vendorCount = new Map<string, { vendor: string; label: string; count: number }>()
    for (const r of rows) {
      const { vendor, label } = detectVendor(r.modelId)
      const existing = vendorCount.get(vendor)
      if (existing) {
        existing.count++
      } else {
        vendorCount.set(vendor, { vendor, label, count: 1 })
      }
    }
    const vendors = [...vendorCount.values()].sort((a, b) => b.count - a.count)
    return reply.send(success({ total: rows.length, vendors }))
  })

  // GET /api/ai-pricing/:modelId — 单个模型定价详情
  server.get('/ai-pricing/:modelId', async (request, reply) => {
    const parsed = modelIdParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [row] = await db
      .select()
      .from(aiPricing)
      .where(eq(aiPricing.modelId, parsed.data.modelId))
      .limit(1)
    if (!row) return reply.status(404).send(error(404, '模型定价不存在'))
    const { vendor, label } = detectVendor(row.modelId)
    return reply.send(
      success({
        id: row.id,
        modelId: row.modelId,
        inputPrice: Number(row.inputTokenPrice),
        outputPrice: Number(row.outputTokenPrice),
        regionPricing: row.regionPricing,
        discount: row.discount,
        currency: row.currency,
        effectiveAt: row.effectiveAt,
        expiresAt: row.expiresAt,
        vendor,
        vendorLabel: label,
      }),
    )
  })
}

export default aiPricingRoutes
