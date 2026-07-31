/**
 * /v1/rerank + /v1/moderations 路由(2026-07-31 立)。
 *
 * 补齐 SwiftAPI + New API 已有但 IHUI-AI 缺失的两个 OpenAI/Cohere 兼容端点:
 * 1. POST /v1/rerank      — Cohere/Jina 兼容重排序(rerank-* 模型)
 * 2. POST /v1/moderations — OpenAI 兼容内容审核(text-moderation-* 模型)
 *
 * 鉴权:复用 plugins/api-key-auth.ts 的 requireApiKeyAuth(Bearer token + developer_api_keys 表)。
 *       模型白名单检查由 requireApiKeyAuth 内置 checkAllowedModels 完成(返回 403)。
 *       TODO(主 agent):若需返回 New API 风格的 1003 业务码,需在 routes/index.ts 整合时
 *       替换为自定义 preHandler 或扩展 api-key-auth 支持 businessCode 映射。
 * 上游:fetch 调用 Cohere/Jina/OpenAI,rerank-* → UPSTREAM_RERANK_BASE/KEY,
 *       text-moderation-* → UPSTREAM_MODERATION_BASE/KEY,未配置返回 5013。
 *
 * 待主 agent 在 routes/index.ts 注册:
 *   import v1RerankModerations from './v1-rerank-moderations.js'
 *   server.register(v1RerankModerations, { prefix: '/v1' })
 *
 * 响应格式:OpenAI/Cohere 兼容(不套 { code, message, data } 壳,与 v1-public.ts 一致)。
 * 错误格式:{ code, message } + HTTP 状态码(400/401/403/502)。
 */
import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { requireApiKeyAuth } from '../plugins/api-key-auth.js'
import { error } from '../utils/response.js'
// P0 第二批次(2026-07-31 立):rerank/moderations 计费集成
import { recordCall, modelToProviderCode } from '../services/relay-billing-service.js'

/** 鉴权后注入 request 的 API Key 上下文(与 v1-public.ts ApiKeyContext 结构一致) */
interface ApiKeyContext {
  id: string
  userId: string
  key: string
  permissions: string[]
  rateLimit: number
}

// =============================================================================
// 类型定义(OpenAI/Cohere 兼容响应类型,inline 定义避免污染 @ihui/types)
// =============================================================================

/** Cohere/Jina rerank 响应单个结果 */
interface RerankResult {
  index: number
  relevance_score: number
  document?: { text: string }
}

/** Cohere/Jina rerank 完整响应 */
interface RerankResponse {
  id: string
  results: RerankResult[]
  meta?: {
    tokens?: { input?: number; output?: number }
    billed_units?: { input?: number; output?: number }
  }
}

/** OpenAI moderation 单个结果 */
interface ModerationResult {
  flagged: boolean
  categories: Record<string, boolean>
  category_scores: Record<string, number>
}

/** OpenAI moderation 完整响应 */
interface ModerationResponse {
  id: string
  model: string
  results: ModerationResult[]
}

/** 上游渠道配置 */
interface UpstreamConfig {
  baseUrl: string
  apiKey: string
}

// =============================================================================
// Zod schemas(请求体校验)
// =============================================================================

const rerankSchema = z.object({
  model: z.string().min(1),
  query: z.string().min(1),
  documents: z.array(z.union([z.string(), z.object({ text: z.string() })])).min(1),
  top_n: z.number().int().positive().optional(),
  return_documents: z.boolean().optional().default(true),
})

const moderationsSchema = z.object({
  model: z.string().optional().default('text-moderation-latest'),
  input: z.union([z.string(), z.array(z.string().min(1))]),
})

// =============================================================================
// 上游配置解析
// =============================================================================

/** 解析 rerank 上游配置(UPSTREAM_RERANK_BASE / UPSTREAM_RERANK_KEY) */
function getRerankUpstream(): UpstreamConfig | null {
  const baseUrl = process.env.UPSTREAM_RERANK_BASE
  const apiKey = process.env.UPSTREAM_RERANK_KEY
  if (!baseUrl || !apiKey) return null
  return { baseUrl: baseUrl.replace(/\/+$/, ''), apiKey }
}

/** 解析 moderations 上游配置(UPSTREAM_MODERATION_BASE / UPSTREAM_MODERATION_KEY) */
function getModerationUpstream(): UpstreamConfig | null {
  const baseUrl = process.env.UPSTREAM_MODERATION_BASE
  const apiKey = process.env.UPSTREAM_MODERATION_KEY
  if (!baseUrl || !apiKey) return null
  return { baseUrl: baseUrl.replace(/\/+$/, ''), apiKey }
}

// =============================================================================
// 路由插件
// =============================================================================

const v1RerankModerations: FastifyPluginAsync = async (server) => {
  // ===== 1. POST /rerank — Cohere/Jina 兼容重排序 =====
  server.post(
    '/rerank',
    {
      schema: {
        description: 'Cohere/Jina 兼容重排序(rerank-* 模型)',
        tags: ['Rerank'],
        body: {
          type: 'object',
          properties: {
            model: { type: 'string', description: '如 rerank-multilingual-v3.0' },
            query: { type: 'string' },
            documents: {
              type: 'array',
              items: {
                anyOf: [
                  { type: 'string' },
                  {
                    type: 'object',
                    properties: { text: { type: 'string' } },
                    required: ['text'],
                  },
                ],
              },
            },
            top_n: { type: 'integer', minimum: 1 },
            return_documents: { type: 'boolean', default: true },
          },
          required: ['model', 'query', 'documents'],
        },
      },
      preHandler: [requireApiKeyAuth],
    },
    async (request, reply) => {
      const parsed = rerankSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { model, query, documents, top_n, return_documents } = parsed.data

      const upstream = getRerankUpstream()
      if (!upstream) {
        return reply.status(502).send(error(5013, '上游 rerank 渠道未配置'))
      }

      try {
        const body: Record<string, unknown> = {
          model,
          query,
          documents,
          return_documents,
        }
        if (top_n !== undefined) body.top_n = top_n

        const resp = await fetch(`${upstream.baseUrl}/v1/rerank`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${upstream.apiKey}`,
          },
          body: JSON.stringify(body),
        })

        if (!resp.ok) {
          const errText = await resp.text().catch(() => '')
          return reply
            .status(502)
            .send(error(502, `上游 rerank 调用失败 (${resp.status}): ${errText.slice(0, 200)}`))
        }

        const data = (await resp.json()) as Partial<RerankResponse>
        const result: RerankResponse = {
          id: data.id ?? `rerank-${randomUUID()}`,
          results: Array.isArray(data.results) ? data.results : [],
          meta: data.meta,
        }
        // P0 第二批次(2026-07-31 立):rerank 计费(按 input tokens 计费,output tokens 为 0)
        const apiKey = (request as FastifyRequest & { apiKey?: ApiKeyContext }).apiKey
        if (apiKey) {
          const inputTokens =
            data.meta?.tokens?.input ??
            data.meta?.billed_units?.input ??
            Math.ceil(query.length / 4)
          void recordCall({
            apiKeyId: apiKey.id,
            userId: apiKey.userId,
            model,
            prompt: query,
            response: JSON.stringify(result.results.slice(0, 10)),
            promptTokens: inputTokens,
            completionTokens: 0,
            totalTokens: inputTokens,
            latencyMs: 0,
            status: 'success',
            providerCode: modelToProviderCode(model),
            clientIp: request.ip,
            httpStatus: resp.status,
            metadata: { endpoint: 'rerank', documentsCount: documents.length },
          }).catch((e) => {
            console.error('[v1/rerank] recordCall FAIL', e?.message || e)
          })
        }
        return reply.send(result)
      } catch (e) {
        return reply.status(502).send(error(502, (e as Error).message || '上游 rerank 调用失败'))
      }
    },
  )

  // ===== 2. POST /moderations — OpenAI 兼容内容审核 =====
  server.post(
    '/moderations',
    {
      schema: {
        description: 'OpenAI 兼容内容审核(text-moderation-* 模型)',
        tags: ['Moderations'],
        body: {
          type: 'object',
          properties: {
            model: {
              type: 'string',
              default: 'text-moderation-latest',
              description: 'text-moderation-latest / text-moderation-stable',
            },
            input: {
              anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
            },
          },
          required: ['input'],
        },
      },
      preHandler: [requireApiKeyAuth],
    },
    async (request, reply) => {
      const parsed = moderationsSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { model, input } = parsed.data

      const upstream = getModerationUpstream()
      if (!upstream) {
        return reply.status(502).send(error(5013, '上游 moderations 渠道未配置'))
      }

      try {
        const body: Record<string, unknown> = { input, model }

        const resp = await fetch(`${upstream.baseUrl}/v1/moderations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${upstream.apiKey}`,
          },
          body: JSON.stringify(body),
        })

        if (!resp.ok) {
          const errText = await resp.text().catch(() => '')
          return reply
            .status(502)
            .send(
              error(502, `上游 moderations 调用失败 (${resp.status}): ${errText.slice(0, 200)}`),
            )
        }

        const data = (await resp.json()) as Partial<ModerationResponse>
        const result: ModerationResponse = {
          id: data.id ?? `modr-${randomUUID()}`,
          model: data.model ?? model,
          results: Array.isArray(data.results) ? data.results : [],
        }
        // P0 第二批次(2026-07-31 立):moderations 计费(按 input tokens 计费,output tokens 为 0)
        const apiKey = (request as FastifyRequest & { apiKey?: ApiKeyContext }).apiKey
        if (apiKey) {
          const inputText = Array.isArray(input) ? input.join('\n') : input
          const inputTokens = Math.ceil(inputText.length / 4)
          void recordCall({
            apiKeyId: apiKey.id,
            userId: apiKey.userId,
            model,
            prompt: inputText,
            response: JSON.stringify(result.results.slice(0, 10)),
            promptTokens: inputTokens,
            completionTokens: 0,
            totalTokens: inputTokens,
            latencyMs: 0,
            status: 'success',
            providerCode: modelToProviderCode(model),
            clientIp: request.ip,
            httpStatus: resp.status,
            metadata: { endpoint: 'moderations' },
          }).catch((e) => {
            console.error('[v1/moderations] recordCall FAIL', e?.message || e)
          })
        }
        return reply.send(result)
      } catch (e) {
        return reply
          .status(502)
          .send(error(502, (e as Error).message || '上游 moderations 调用失败'))
      }
    },
  )
}

export default v1RerankModerations
