/**
 * /v1/* 对外开放 API — 知识工具类路由(2026-07-22 立)。
 *
 * 所有端点统一 requireApiKeyAuth + requireApiKeyPermission + requireApiKeyQuota 三重 preHandler。
 * 响应格式 OpenAI 兼容(不套 { code, message, data } 壳,camelCase 字段)。
 * 鉴权由 plugins/api-key-auth.ts 提供,契约类型由 @ihui/types 提供。
 *
 * 转发策略:
 * - 内部 /api/* 路由:用 mintInternalJwt(userId) 签发短期 JWT,fetch 转发到 INTERNAL_BASE,
 *   成功响应 { code:0, message:'success', data } 自动拆壳返回 data。
 * - ai-service 路由:fetch 直接转发到 config.AI_SERVICE_URL,透传 JSON。
 *
 * 端点清单(58 个):
 * === Knowledge/RAG(14)===
 * 1.  GET    /v1/knowledge/health                  — 健康检查(knowledge:read)
 * 2.  GET    /v1/knowledge/documents               — 文档列表(knowledge:read)
 * 3.  POST   /v1/knowledge/documents               — 文档入库(knowledge:write)
 * 3b. POST   /v1/knowledge/documents/upload        — 文件上传入库(knowledge:write,multipart)
 * 4.  GET    /v1/knowledge/documents/:id           — 文档详情(knowledge:read)
 * 5.  GET    /v1/knowledge/documents/:id/chunks     — 文档分块(knowledge:read)
 * 6.  DELETE /v1/knowledge/documents/:id            — 删除文档(knowledge:write)
 * 7.  POST   /v1/knowledge/documents/batch-delete  — 批量删除(knowledge:write)
 * 8.  POST   /v1/knowledge/search                  — 语义搜索(knowledge:read)
 * 9.  POST   /v1/knowledge/rag-context             — RAG 上下文(knowledge:read)
 * 10. POST   /v1/knowledge-graph/extract            — 图谱抽取(knowledge:write)
 * 11. POST   /v1/knowledge-graph/build              — 图谱构建(knowledge:write)
 * 12. GET    /v1/knowledge-graph/data               — 图谱数据(knowledge:read)
 * 13. DELETE /v1/knowledge-graph/data               — 清空图谱(knowledge:write)
 * === MCP Tools(16)===
 * 14. GET    /v1/tools                              — 工具列表(tools:read)
 * 15. POST   /v1/tools/call                         — 调用工具(tools:call)
 * 16. GET    /v1/resources                          — 资源列表(tools:read)
 * 17. GET    /v1/resources/:uri                     — 资源详情(tools:read)
 * 18. GET    /v1/prompts                            — 提示词列表(tools:read)
 * 19. POST   /v1/prompts/invoke                     — 调用提示词(tools:call)
 * 20. GET    /v1/skills                             — 技能列表(tools:read)
 * 21. GET    /v1/slash-commands                     — 斜杠命令列表(tools:read)
 * 22. POST   /v1/slash-commands                     — 执行斜杠命令(tools:call)
 * 23. POST   /v1/sampling                           — 采样(tools:call)
 * 24. GET    /v1/personas                           — 人格列表(tools:read)
 * 25. GET    /v1/personas/:name                     — 人格详情(tools:read)
 * 26. POST   /v1/tools/search-codebase              — 搜索代码库(tools:call)
 * 27. POST   /v1/tools/search-web                   — 搜索网页(tools:call)
 * 28. POST   /v1/tools/analyze-code                 — 分析代码(tools:call)
 * 29. POST   /v1/screenshot                         — 截图(tools:call)
 * === Memory(8)===
 * 30. POST   /v1/memory                             — 保存记忆(memory:write)
 * 31. GET    /v1/memory                             — 召回记忆(memory:read)
 * 32. POST   /v1/memory/search                      — 语义搜索记忆(memory:read)
 * 33. POST   /v1/memory/dream                       — Dream 梦境(memory:write)
 * 34. DELETE /v1/memory                             — 遗忘记忆(memory:write)
 * 35. GET    /v1/memory/working                     — 工作记忆(memory:read)
 * 36. GET    /v1/memory/episodic                    — 情景记忆(memory:read)
 * 37. GET    /v1/memory/procedural                  — 程序记忆(memory:read)
 * === Messages(4)===
 * 38. POST   /v1/messages                           — 发布消息(messages:write)
 * 39. POST   /v1/messages/subscribe                — 订阅频道(messages:write)
 * 40. DELETE /v1/messages/subscribe/:id             — 取消订阅(messages:write)
 * 41. GET    /v1/messages/:id/status                — 消息状态(messages:read)
 * === Files 补齐(7)===
 * 42. GET    /v1/files/:id                          — 文件详情(files:read)
 * 43. DELETE /v1/files/:id                          — 删除文件(files:write)
 * 44. GET    /v1/files/:id/content                  — 文件内容(files:read)
 * 45. GET    /v1/files/:id/versions                 — 文件版本(files:read)
 * 46. POST   /v1/files/upload-init                  — 分片上传初始化(files:write)
 * 47. POST   /v1/files/upload-chunk                 — 上传分片(files:write)
 * 48. POST   /v1/files/complete                     — 完成上传(files:write)
 * === User/Workspace/Workflows/Stats(9)===
 * 49. GET    /v1/me                                 — 当前用户 + 配额(user:read)
 * 50. GET    /v1/projects                           — 项目列表(workspace:read)
 * 51. GET    /v1/projects/:id/files                 — 项目文件(workspace:read)
 * 52. GET    /v1/workflows/:id                      — 工作流详情(workflows:read)
 * 53. POST   /v1/workflows/instances                — 运行工作流(workflows:write)
 * 54. POST   /v1/workflows/coze/run                 — Coze 工作流(workflows:write)
 * 55. POST   /v1/workflows/n8n/run                  — n8n 工作流(workflows:write)
 * 56. GET    /v1/usage                              — 用量统计(stats:read)
 * 57. GET    /v1/usage/:vendor                       — 厂商用量(stats:read)
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { eq, sql, and, or, like } from 'drizzle-orm'
import { z } from 'zod'
import { signAccessToken } from '@ihui/auth'
import type {
  V1KnowledgeDocumentsResponse,
  V1IngestDocumentRequest,
  V1IngestDocumentResponse,
  V1KnowledgeSearchRequest,
  V1KnowledgeSearchResponse,
  V1RagContextRequest,
  V1RagContextResponse,
  V1DocumentChunksResponse,
  V1KnowledgeGraphExtractRequest,
  V1KnowledgeGraphExtractResponse,
  V1KnowledgeGraphDataResponse,
  V1ToolsResponse,
  V1ToolCallRequest,
  V1ToolCallResponse,
  V1ResourcesResponse,
  V1PromptsResponse,
  V1PromptInvokeResponse,
  V1SkillsResponse,
  V1SlashCommandsResponse,
  V1SamplingResponse,
  V1PersonasResponse,
  V1ScreenshotResponse,
  V1RecallMemoryResponse,
  V1MemorySearchRequest,
  V1MemoryDreamResponse,
  V1WorkingMemoryResponse,
  V1EpisodicMemoryResponse,
  V1ProceduralMemoryResponse,
  V1PublishMessageResponse,
  V1SubscribeMessageResponse,
  V1MessageStatusResponse,
  V1FileInfo,
  V1UploadInitResponse,
  V1FileVersionsResponse,
  V1UserInfo,
  V1ProjectsResponse,
  V1ProjectFilesResponse,
  V1WorkflowInfo,
  V1RunWorkflowResponse,
  V1UsageResponse,
  V1VendorUsageResponse,
} from '@ihui/types'
import {
  requireApiKeyAuth,
  requireApiKeyPermission,
  requireApiKeyQuota,
} from '../plugins/api-key-auth.js'
import { error } from '../utils/response.js'
import { config } from '../config/index.js'
import { dbRead } from '../db/index.js'
import { users, apiLogs, apiKeyQuotas, llmCallLogs, aiCostRecords } from '@ihui/database'
import { knowledgeRagService } from '../services/knowledge-rag-service.js'
import { UnsupportedFormatError, FileTooLargeError } from '../services/document-parser.js'
import { XlsxFileTooLargeError } from '../services/xlsx-parser.js'

// =============================================================================
// 常量
// =============================================================================

/** 内部 /api/* 路由 base url(保持 API Key 鉴权隔离,不混用用户 JWT)。 */
const INTERNAL_BASE = `http://localhost:${process.env.PORT || 3001}`

/** /knowledge/documents/upload 单文件大小上限 10MB(Excel 大文件应走数据导入) */
const UPLOAD_MAX_SIZE = 10 * 1024 * 1024

/** /knowledge/documents/upload 允许的文件扩展名白名单 */
const ALLOWED_UPLOAD_EXTS = new Set([
  'xlsx',
  'xlsm',
  'xls',
  'csv',
  'pdf',
  'docx',
  'md',
  'markdown',
  'txt',
  'log',
  'html',
  'htm',
])

/** 鉴权后注入 request 的 API Key 上下文(与 AuthenticatedApiKey 结构一致)。 */
interface ApiKeyContext {
  id: string
  userId: string
  key: string
  permissions: string[]
  rateLimit: number
}

/**
 * 厂商 → 模型前缀映射(用于 /usage/:vendor 按 model 前缀聚合)。
 * 未知 vendor 返回空数组(只支持已知厂商,避免 LIKE 通配符注入)。
 */
const VENDOR_PREFIXES: Record<string, string[]> = {
  openai: ['gpt-%', 'o1-%', 'o3-%', 'text-embedding-%', 'dall-e-%', 'whisper-%', 'tts-%'],
  anthropic: ['claude-%'],
  google: ['gemini-%'],
  zhipu: ['glm-%', 'chatglm-%'],
  deepseek: ['deepseek-%'],
  alibaba: ['qwen-%', 'qwen2-%'],
  moonshot: ['moonshot-%', 'kimi-%'],
}

// =============================================================================
// Zod schemas
// =============================================================================

const ingestDocumentSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  source: z.string().optional(),
  chunkStrategy: z.string().optional(),
  chunkSize: z.number().int().positive().optional(),
  chunkOverlap: z.number().int().nonnegative().optional(),
})

const batchDeleteSchema = z.object({
  documentIds: z.array(z.string().min(1)).min(1),
})

const knowledgeSearchSchema = z.object({
  query: z.string().min(1),
  topK: z.number().int().positive().optional(),
  documentIds: z.array(z.string()).optional(),
  threshold: z.number().min(0).max(1).optional(),
})

const ragContextSchema = z.object({
  query: z.string().min(1),
  topK: z.number().int().positive().optional(),
  injectSystemPrompt: z.boolean().optional(),
})

const knowledgeGraphExtractSchema = z.object({
  text: z.string().min(1),
  extractType: z.string().optional(),
})

const toolCallSchema = z.object({
  name: z.string().min(1),
  arguments: z.record(z.unknown()).default({}),
})

const promptInvokeSchema = z.object({
  name: z.string().min(1),
  arguments: z.record(z.string()).optional(),
})

const samplingSchema = z.object({
  messages: z.array(z.object({ role: z.string(), content: z.string() })).min(1),
  modelPreferences: z
    .object({
      hints: z.array(z.string()).optional(),
      costPriority: z.number().optional(),
      speedPriority: z.number().optional(),
      intelligencePriority: z.number().optional(),
    })
    .optional(),
  maxTokens: z.number().int().positive(),
})

const searchCodebaseSchema = z.object({
  query: z.string().min(1),
  directory: z.string().optional(),
})

const searchWebSchema = z.object({
  query: z.string().min(1),
  num: z.number().int().positive().optional(),
})

const analyzeCodeSchema = z.object({
  code: z.string().min(1),
  language: z.string().optional(),
})

const screenshotSchema = z.object({
  url: z.string().url(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  fullPage: z.boolean().optional(),
})

const saveMemorySchema = z.object({
  content: z.string().min(1),
  type: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
})

const memorySearchSchema = z.object({
  query: z.string().min(1),
  topK: z.number().int().positive().optional(),
  type: z.string().optional(),
})

const memoryDreamSchema = z.object({
  mode: z.string().optional(),
})

const forgetMemorySchema = z.object({
  memoryId: z.string().min(1),
})

const publishMessageSchema = z.object({
  channel: z.string().min(1),
  content: z.string().min(1),
  recipients: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const subscribeMessageSchema = z.object({
  channel: z.string().min(1),
  callbackUrl: z.string().url(),
})

const uploadInitSchema = z.object({
  filename: z.string().min(1),
  size: z.number().int().positive(),
  mimeType: z.string().min(1),
  chunkSize: z.number().int().positive(),
})

const uploadChunkSchema = z.object({
  uploadId: z.string().min(1),
  index: z.number().int().nonnegative(),
  chunk: z.string().min(1),
})

const uploadCompleteSchema = z.object({
  uploadId: z.string().min(1),
})

const runWorkflowSchema = z.object({
  workflowId: z.string().min(1),
  inputs: z.record(z.unknown()).optional(),
})

const runCozeWorkflowSchema = z.object({
  workflowId: z.string().min(1),
  parameters: z.record(z.unknown()),
})

const runN8nWorkflowSchema = z.object({
  workflowId: z.string().min(1),
  data: z.record(z.unknown()).optional(),
})

// =============================================================================
// Fastify OpenAPI schemas(共享)
// =============================================================================

const errorResponseSchema = {
  type: 'object',
  properties: { code: { type: 'number' }, message: { type: 'string' } },
}

// =============================================================================
// 辅助函数
// =============================================================================

/** 从 apiKey 上下文取 userId,失败 reply 401。 */
function getUserId(request: FastifyRequest, reply: FastifyReply): string | null {
  const apiKey = (request as FastifyRequest & { apiKey?: ApiKeyContext }).apiKey
  if (!apiKey) {
    reply.status(401).send(error(401, 'API key authentication required'))
    return null
  }
  return apiKey.userId
}

/** 用 apiKey.userId 签发短期内部 JWT,模拟内部调用满足 /api/* 的 JWT 鉴权。 */
function mintInternalJwt(userId: string): Promise<string> {
  return signAccessToken({ userId, phone: '', familyId: `apikey-${userId}`, roleId: 0 })
}

/** 构造 JSON 请求 init。 */
function jsonInit(
  body: unknown,
  method: 'POST' | 'PUT' | 'DELETE' = 'POST',
): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

function asObj(v: unknown): Record<string, unknown> {
  return (v ?? {}) as Record<string, unknown>
}

interface InternalResult {
  ok: boolean
  status: number
  code: number
  message: string
  data: unknown
  isBinary: boolean
  buffer: Buffer | null
  contentType: string
}

/** 调用内部 /api/* 路由,自动附加内部 JWT Bearer。 */
async function callInternal(
  path: string,
  init: RequestInit,
  userId: string,
): Promise<InternalResult> {
  const token = await mintInternalJwt(userId)
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${token}`)
  const resp = await fetch(`${INTERNAL_BASE}${path}`, { ...init, headers })
  const contentType = resp.headers.get('content-type') ?? ''

  // 二进制文件直返
  if (
    contentType.includes('octet-stream') ||
    contentType.includes('image') ||
    contentType.includes('application/pdf')
  ) {
    const buffer = Buffer.from(await resp.arrayBuffer())
    return {
      ok: resp.ok,
      status: resp.status,
      code: resp.ok ? 0 : resp.status,
      message: '',
      data: null,
      isBinary: true,
      buffer,
      contentType,
    }
  }

  const json = (await resp.json().catch(() => null)) as Record<string, unknown> | null

  // 拆壳 { code, message, data }
  if (json && typeof json === 'object' && 'code' in json) {
    const code = (json as { code: number }).code
    if (code === 0) {
      return {
        ok: true,
        status: resp.status,
        code: 0,
        message: '',
        data: (json as { data: unknown }).data,
        isBinary: false,
        buffer: null,
        contentType,
      }
    }
    return {
      ok: false,
      status: resp.status,
      code,
      message: (json as { message?: string }).message ?? '',
      data: null,
      isBinary: false,
      buffer: null,
      contentType,
    }
  }

  // 未包装的直接对象
  return {
    ok: resp.ok,
    status: resp.status,
    code: resp.ok ? 0 : resp.status,
    message: '',
    data: json,
    isBinary: false,
    buffer: null,
    contentType,
  }
}

/**
 * 通用内部转发(JSON 请求 + JSON/二进制响应)。
 * 成功返回 mapper(data) 或 data;失败返回 reply.status(httpStatus).send(error(...))。
 */
async function forwardInternal(
  reply: FastifyReply,
  path: string,
  init: RequestInit,
  userId: string,
  mapper?: (data: unknown) => unknown,
): Promise<void> {
  try {
    const result = await callInternal(path, init, userId)
    if (result.isBinary && result.buffer) {
      reply.header('Content-Type', result.contentType)
      return reply.send(result.buffer)
    }
    if (!result.ok) {
      const httpStatus = result.status >= 400 && result.status < 600 ? result.status : 502
      return reply
        .status(httpStatus)
        .send(error(httpStatus, result.message || `Internal service error (${result.status})`))
    }
    return reply.send(mapper ? mapper(result.data) : result.data)
  } catch (e) {
    return reply
      .status(503)
      .send(error(503, (e as Error).message || 'Internal service unavailable'))
  }
}

/**
 * 通用 ai-service 转发(JSON 请求 + JSON 响应)。
 * ai-service 返回裸 JSON(无 { code, message, data } 壳),error 字段标识错误。
 */
async function forwardAiService(
  reply: FastifyReply,
  path: string,
  init: RequestInit,
  mapper?: (data: unknown) => unknown,
): Promise<void> {
  try {
    const resp = await fetch(`${config.AI_SERVICE_URL}${path}`, init)
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '')
      return reply
        .status(503)
        .send(error(503, `AI service unavailable (${resp.status}): ${txt.slice(0, 200)}`))
    }
    const data = (await resp.json().catch(() => null)) as unknown
    if (
      data &&
      typeof data === 'object' &&
      'error' in data &&
      (data as { error: unknown }).error
    ) {
      const msg =
        (data as { error_message?: string }).error_message ??
        (data as { message?: string }).message ??
        'AI service error'
      return reply.status(502).send(error(502, msg))
    }
    return reply.send(mapper ? mapper(data) : data)
  } catch (e) {
    return reply.status(503).send(error(503, (e as Error).message || 'AI service unavailable'))
  }
}

// =============================================================================
// 路由插件
// =============================================================================

const v1KnowledgeToolsRoutes: FastifyPluginAsync = async (server) => {
  // ===== 1. GET /knowledge/health — 健康检查 =====
  server.get(
    '/knowledge/health',
    {
      schema: {
        description: '知识库健康检查',
        tags: ['Knowledge'],
        response: {
          200: { type: 'object' },
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('knowledge:read'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const userId = getUserId(request, reply)
      if (!userId) return
      return forwardInternal(reply, '/api/knowledge/health', { method: 'GET' }, userId)
    },
  )

  // ===== 2. GET /knowledge/documents — 文档列表 =====
  server.get(
    '/knowledge/documents',
    {
      schema: {
        description: '文档列表',
        tags: ['Knowledge'],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'number' },
            limit: { type: 'number' },
            keyword: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              object: { type: 'string' },
              data: { type: 'array' },
            },
          },
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('knowledge:read'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const userId = getUserId(request, reply)
      if (!userId) return
      const qs = new URLSearchParams(request.query as Record<string, string>)
      const path = qs.toString() ? `/api/knowledge/docs?${qs}` : '/api/knowledge/docs'
      return forwardInternal(reply, path, { method: 'GET' }, userId, (data) => {
        const d = asObj(data)
        const docs = Array.isArray(d.data) ? d.data : Array.isArray(d) ? d : []
        const result: V1KnowledgeDocumentsResponse = {
          object: 'list',
          data: docs.map((doc) => {
            const o = asObj(doc)
            return {
              id: String(o.id ?? ''),
              title: String(o.title ?? ''),
              source: String(o.source ?? ''),
              chunkCount: typeof o.chunkCount === 'number' ? o.chunkCount : typeof o.chunk_count === 'number' ? o.chunk_count : 0,
              sizeBytes: typeof o.sizeBytes === 'number' ? o.sizeBytes : typeof o.size_bytes === 'number' ? o.size_bytes : 0,
              createdAt: String(o.createdAt ?? o.created_at ?? new Date().toISOString()),
            }
          }),
        }
        return result
      })
    },
  )

  // ===== 3. POST /knowledge/documents — 文档入库 =====
  server.post(
    '/knowledge/documents',
    {
      schema: {
        description: '文档入库',
        tags: ['Knowledge'],
        body: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            content: { type: 'string' },
            source: { type: 'string' },
            chunkStrategy: { type: 'string' },
            chunkSize: { type: 'number' },
            chunkOverlap: { type: 'number' },
          },
          required: ['title', 'content'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              documentId: { type: 'string' },
              chunkCount: { type: 'number' },
              status: { type: 'string' },
            },
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('knowledge:write'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const userId = getUserId(request, reply)
      if (!userId) return
      const parsed = ingestDocumentSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { title, content, source, chunkStrategy, chunkSize, chunkOverlap } =
        parsed.data as V1IngestDocumentRequest
      const body: Record<string, unknown> = { title, content }
      if (source) body.source = source
      if (chunkStrategy) body.chunkStrategy = chunkStrategy
      if (chunkSize !== undefined) body.chunkSize = chunkSize
      if (chunkOverlap !== undefined) body.chunkOverlap = chunkOverlap
      return forwardInternal(reply, '/api/knowledge/ingest', jsonInit(body), userId, (data) => {
        const d = asObj(data)
        const result: V1IngestDocumentResponse = {
          documentId: String(d.documentId ?? d.document_id ?? d.id ?? ''),
          chunkCount: typeof d.chunkCount === 'number' ? d.chunkCount : typeof d.chunk_count === 'number' ? d.chunk_count : 0,
          status: 'ingested',
        }
        return result
      })
    },
  )

  // ===== 3b. POST /knowledge/documents/upload — 文件上传入库(multipart/form-data) =====
  // 支持 .xlsx/.xlsm/.xls/.csv/.pdf/.docx/.md/.txt/.html,单文件 ≤10MB
  // 直接调用 knowledgeRagService.ingestFile(解析→切片→embedding→入库),不走内部 HTTP 转发
  server.post(
    '/knowledge/documents/upload',
    {
      schema: {
        description: '文件上传入库(multipart/form-data,≤10MB)',
        tags: ['Knowledge'],
        consumes: ['multipart/form-data'],
        response: {
          200: {
            type: 'object',
            properties: {
              documentId: { type: 'string' },
              chunkCount: { type: 'number' },
              status: { type: 'string' },
            },
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
          413: errorResponseSchema,
          415: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('knowledge:write'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const userId = getUserId(request, reply)
      if (!userId) return

      if (!request.isMultipart()) {
        return reply.status(400).send(error(400, 'Request must be multipart/form-data'))
      }

      const data = await request.file().catch(() => null)
      if (!data) {
        return reply.status(400).send(error(400, 'No file uploaded'))
      }

      const buffer = await data.toBuffer()
      if (buffer.length === 0) {
        return reply.status(400).send(error(400, 'File is empty'))
      }

      // 文件大小限制 10MB
      if (buffer.length > UPLOAD_MAX_SIZE) {
        return reply
          .status(413)
          .send(error(413, `File too large: ${buffer.length} bytes (max ${UPLOAD_MAX_SIZE} bytes)`))
      }

      // 扩展名白名单校验
      const filename = data.filename ?? 'untitled'
      const ext = /\.([a-z0-9]+)$/i.exec(filename)?.[1]?.toLowerCase() ?? ''
      if (!ext || !ALLOWED_UPLOAD_EXTS.has(ext)) {
        return reply
          .status(415)
          .send(
            error(
              415,
              `Unsupported file type: .${ext || 'unknown'} (allowed: xlsx/xlsm/xls/csv/pdf/docx/md/txt/html)`,
            ),
          )
      }

      // 读取可选 form 字段:title / collectionName
      const titleField = data.fields?.title
      const collectionField = data.fields?.collectionName
      const formTitle = Array.isArray(titleField) ? titleField[0] : titleField
      const formCollection = Array.isArray(collectionField) ? collectionField[0] : collectionField
      const titleRaw =
        formTitle && typeof formTitle === 'object' && 'value' in formTitle
          ? (formTitle as { value: string }).value
          : ''
      const collectionRaw =
        formCollection && typeof formCollection === 'object' && 'value' in formCollection
          ? (formCollection as { value: string }).value
          : ''

      const title = (titleRaw && titleRaw.trim()) || filename.replace(/\.[^.]+$/, '') || 'untitled'
      const collectionName = (collectionRaw && collectionRaw.trim()) || 'default'

      try {
        const result = await knowledgeRagService.ingestFile({
          ownerUuid: userId,
          title,
          buffer,
          mimeType: data.mimetype ?? 'application/octet-stream',
          filename,
          collectionName,
        })
        const response: V1IngestDocumentResponse = {
          documentId: String(result.docId),
          chunkCount: result.chunkCount,
          status: 'ingested',
        }
        return reply.send(response)
      } catch (e) {
        if (e instanceof UnsupportedFormatError) {
          return reply.status(415).send(error(415, e.message))
        }
        if (e instanceof FileTooLargeError || e instanceof XlsxFileTooLargeError) {
          return reply.status(413).send(error(413, e.message))
        }
        request.log.error(e)
        return reply.status(500).send(error(500, (e as Error).message || '文件解析失败'))
      }
    },
  )

  // ===== 4. GET /knowledge/documents/:id — 文档详情 =====
  server.get(
    '/knowledge/documents/:id',
    {
      schema: {
        description: '文档详情',
        tags: ['Knowledge'],
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
        response: {
          200: { type: 'object' },
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('knowledge:read'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const userId = getUserId(request, reply)
      if (!userId) return
      const { id } = request.params as { id: string }
      return forwardInternal(
        reply,
        `/api/knowledge/docs/${encodeURIComponent(id)}`,
        { method: 'GET' },
        userId,
      )
    },
  )

  // ===== 5. GET /knowledge/documents/:id/chunks — 文档分块 =====
  server.get(
    '/knowledge/documents/:id/chunks',
    {
      schema: {
        description: '文档分块列表',
        tags: ['Knowledge'],
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              object: { type: 'string' },
              data: { type: 'array' },
            },
          },
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('knowledge:read'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const userId = getUserId(request, reply)
      if (!userId) return
      const { id } = request.params as { id: string }
      return forwardInternal(
        reply,
        `/api/knowledge/docs/${encodeURIComponent(id)}/chunks`,
        { method: 'GET' },
        userId,
        (data) => {
          const d = asObj(data)
          const chunks = Array.isArray(d.data) ? d.data : Array.isArray(d) ? d : []
          const result: V1DocumentChunksResponse = {
            object: 'list',
            data: chunks.map((c) => {
              const o = asObj(c)
              return {
                id: String(o.id ?? ''),
                content: String(o.content ?? ''),
                index: typeof o.index === 'number' ? o.index : 0,
                ...(o.metadata ? { metadata: o.metadata as Record<string, unknown> } : {}),
              }
            }),
          }
          return result
        },
      )
    },
  )

  // ===== 6. DELETE /knowledge/documents/:id — 删除文档 =====
  server.delete(
    '/knowledge/documents/:id',
    {
      schema: {
        description: '删除文档',
        tags: ['Knowledge'],
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
        response: {
          200: { type: 'object' },
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('knowledge:write'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const userId = getUserId(request, reply)
      if (!userId) return
      const { id } = request.params as { id: string }
      return forwardInternal(
        reply,
        `/api/knowledge/docs/${encodeURIComponent(id)}`,
        jsonInit({}, 'DELETE'),
        userId,
      )
    },
  )

  // ===== 7. POST /knowledge/documents/batch-delete — 批量删除 =====
  server.post(
    '/knowledge/documents/batch-delete',
    {
      schema: {
        description: '批量删除文档',
        tags: ['Knowledge'],
        body: {
          type: 'object',
          properties: {
            documentIds: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: ['documentIds'],
        },
        response: {
          200: { type: 'object' },
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('knowledge:write'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const userId = getUserId(request, reply)
      if (!userId) return
      const parsed = batchDeleteSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      return forwardInternal(
        reply,
        '/api/knowledge/docs/batch-delete',
        jsonInit({ documentIds: parsed.data.documentIds }),
        userId,
      )
    },
  )

  // ===== 8. POST /knowledge/search — 语义搜索 =====
  server.post(
    '/knowledge/search',
    {
      schema: {
        description: '语义搜索',
        tags: ['Knowledge'],
        body: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            topK: { type: 'number' },
            documentIds: {
              type: 'array',
              items: { type: 'string' },
            },
            threshold: { type: 'number' },
          },
          required: ['query'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              object: { type: 'string' },
              data: { type: 'array' },
            },
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('knowledge:read'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const userId = getUserId(request, reply)
      if (!userId) return
      const parsed = knowledgeSearchSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { query, topK, documentIds, threshold } = parsed.data as V1KnowledgeSearchRequest
      const body: Record<string, unknown> = { query }
      if (topK !== undefined) body.topK = topK
      if (documentIds) body.documentIds = documentIds
      if (threshold !== undefined) body.threshold = threshold
      return forwardInternal(reply, '/api/knowledge/search', jsonInit(body), userId, (data) => {
        const d = asObj(data)
        const results = Array.isArray(d.data) ? d.data : Array.isArray(d.results) ? d.results : Array.isArray(d) ? d : []
        const result: V1KnowledgeSearchResponse = {
          object: 'list',
          data: results.map((r) => {
            const o = asObj(r)
            return {
              id: String(o.id ?? ''),
              documentId: String(o.documentId ?? o.document_id ?? ''),
              content: String(o.content ?? ''),
              score: typeof o.score === 'number' ? o.score : 0,
              ...(o.metadata ? { metadata: o.metadata as Record<string, unknown> } : {}),
            }
          }),
        }
        return result
      })
    },
  )

  // ===== 9. POST /knowledge/rag-context — RAG 上下文 =====
  server.post(
    '/knowledge/rag-context',
    {
      schema: {
        description: 'RAG 上下文检索',
        tags: ['Knowledge'],
        body: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            topK: { type: 'number' },
            injectSystemPrompt: { type: 'boolean' },
          },
          required: ['query'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              context: { type: 'string' },
              sources: { type: 'array' },
            },
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('knowledge:read'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const userId = getUserId(request, reply)
      if (!userId) return
      const parsed = ragContextSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { query, topK, injectSystemPrompt } = parsed.data as V1RagContextRequest
      const body: Record<string, unknown> = { query }
      if (topK !== undefined) body.topK = topK
      if (injectSystemPrompt !== undefined) body.injectSystemPrompt = injectSystemPrompt
      return forwardInternal(reply, '/api/knowledge/rag-context', jsonInit(body), userId, (data) => {
        const d = asObj(data)
        const result: V1RagContextResponse = {
          context: String(d.context ?? ''),
          sources: Array.isArray(d.sources)
            ? d.sources.map((s) => {
                const o = asObj(s)
                return {
                  documentId: String(o.documentId ?? o.document_id ?? ''),
                  chunkId: String(o.chunkId ?? o.chunk_id ?? ''),
                  score: typeof o.score === 'number' ? o.score : 0,
                }
              })
            : [],
        }
        return result
      })
    },
  )

  // ===== 10. POST /knowledge-graph/extract — 图谱抽取 =====
  server.post(
    '/knowledge-graph/extract',
    {
      schema: {
        description: '知识图谱抽取',
        tags: ['Knowledge Graph'],
        body: {
          type: 'object',
          properties: {
            text: { type: 'string' },
            extractType: { type: 'string' },
          },
          required: ['text'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              entities: { type: 'array' },
              relations: { type: 'array' },
            },
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('knowledge:write'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const parsed = knowledgeGraphExtractSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { text, extractType } = parsed.data as V1KnowledgeGraphExtractRequest
      const body: Record<string, unknown> = { text }
      if (extractType) body.extractType = extractType
      return forwardAiService(reply, '/api/v1/extract', jsonInit(body), (data) => {
        const d = asObj(data)
        const result: V1KnowledgeGraphExtractResponse = {
          entities: Array.isArray(d.entities)
            ? d.entities.map((e) => {
                const o = asObj(e)
                return {
                  id: String(o.id ?? ''),
                  name: String(o.name ?? ''),
                  type: String(o.type ?? ''),
                  ...(o.properties ? { properties: o.properties as Record<string, unknown> } : {}),
                }
              })
            : [],
          relations: Array.isArray(d.relations)
            ? d.relations.map((r) => {
                const o = asObj(r)
                return {
                  source: String(o.source ?? ''),
                  target: String(o.target ?? ''),
                  type: String(o.type ?? ''),
                  ...(o.properties ? { properties: o.properties as Record<string, unknown> } : {}),
                }
              })
            : [],
        }
        return result
      })
    },
  )

  // ===== 11. POST /knowledge-graph/build — 图谱构建 =====
  server.post(
    '/knowledge-graph/build',
    {
      schema: {
        description: '知识图谱构建',
        tags: ['Knowledge Graph'],
        body: { type: 'object' },
        response: {
          200: { type: 'object' },
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('knowledge:write'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      return forwardAiService(reply, '/api/v1/build', jsonInit(request.body ?? {}))
    },
  )

  // ===== 12. GET /knowledge-graph/data — 图谱数据 =====
  server.get(
    '/knowledge-graph/data',
    {
      schema: {
        description: '知识图谱数据',
        tags: ['Knowledge Graph'],
        response: {
          200: {
            type: 'object',
            properties: {
              nodes: { type: 'array' },
              edges: { type: 'array' },
            },
          },
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('knowledge:read'),
        requireApiKeyQuota(),
      ],
    },
    async (_request, reply) => {
      return forwardAiService(reply, '/api/v1/data', { method: 'GET' }, (data) => {
        const d = asObj(data)
        const result: V1KnowledgeGraphDataResponse = {
          nodes: Array.isArray(d.nodes)
            ? d.nodes.map((n) => {
                const o = asObj(n)
                return {
                  id: String(o.id ?? ''),
                  label: String(o.label ?? ''),
                  type: String(o.type ?? ''),
                }
              })
            : [],
          edges: Array.isArray(d.edges)
            ? d.edges.map((e) => {
                const o = asObj(e)
                return {
                  source: String(o.source ?? ''),
                  target: String(o.target ?? ''),
                  label: String(o.label ?? ''),
                }
              })
            : [],
        }
        return result
      })
    },
  )

  // ===== 13. DELETE /knowledge-graph/data — 清空图谱 =====
  server.delete(
    '/knowledge-graph/data',
    {
      schema: {
        description: '清空知识图谱',
        tags: ['Knowledge Graph'],
        response: {
          200: { type: 'object' },
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('knowledge:write'),
        requireApiKeyQuota(),
      ],
    },
    async (_request, reply) => {
      return forwardAiService(reply, '/api/v1/data', { method: 'DELETE' })
    },
  )

  // ===== 14. GET /tools — MCP 工具列表 =====
  server.get(
    '/tools',
    {
      schema: {
        description: 'MCP 工具列表',
        tags: ['MCP Tools'],
        response: {
          200: {
            type: 'object',
            properties: {
              object: { type: 'string' },
              data: { type: 'array' },
            },
          },
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('tools:read'),
        requireApiKeyQuota(),
      ],
    },
    async (_request, reply) => {
      return forwardAiService(reply, '/api/mcp/tools', { method: 'GET' }, (data) => {
        const d = asObj(data)
        const tools = Array.isArray(d.tools) ? d.tools : Array.isArray(d.data) ? d.data : Array.isArray(d) ? d : []
        const result: V1ToolsResponse = {
          object: 'list',
          data: tools.map((t) => {
            const o = asObj(t)
            return {
              name: String(o.name ?? ''),
              description: String(o.description ?? ''),
              inputSchema: (o.inputSchema ?? o.input_schema ?? {}) as Record<string, unknown>,
              ...(o.category ? { category: String(o.category) } : {}),
            }
          }),
        }
        return result
      })
    },
  )

  // ===== 15. POST /tools/call — 调用工具 =====
  server.post(
    '/tools/call',
    {
      schema: {
        description: '调用 MCP 工具',
        tags: ['MCP Tools'],
        body: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            arguments: { type: 'object' },
          },
          required: ['name'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              toolName: { type: 'string' },
              result: {},
              isError: { type: 'boolean' },
            },
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('tools:call'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const parsed = toolCallSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { name, arguments: args } = parsed.data as V1ToolCallRequest
      return forwardAiService(
        reply,
        '/api/mcp/tools/call',
        jsonInit({ name, arguments: args }),
        (data) => {
          const d = asObj(data)
          const result: V1ToolCallResponse = {
            toolName: name,
            result: d.result ?? d.content ?? data,
            isError: Boolean(d.isError ?? d.is_error ?? false),
          }
          return result
        },
      )
    },
  )

  // ===== 16. GET /resources — MCP 资源列表 =====
  server.get(
    '/resources',
    {
      schema: {
        description: 'MCP 资源列表',
        tags: ['MCP Tools'],
        response: {
          200: {
            type: 'object',
            properties: {
              object: { type: 'string' },
              data: { type: 'array' },
            },
          },
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('tools:read'),
        requireApiKeyQuota(),
      ],
    },
    async (_request, reply) => {
      return forwardAiService(reply, '/api/mcp/resources', { method: 'GET' }, (data) => {
        const d = asObj(data)
        const resources = Array.isArray(d.resources) ? d.resources : Array.isArray(d.data) ? d.data : Array.isArray(d) ? d : []
        const result: V1ResourcesResponse = {
          object: 'list',
          data: resources.map((r) => {
            const o = asObj(r)
            return {
              uri: String(o.uri ?? ''),
              name: String(o.name ?? ''),
              ...(o.description ? { description: String(o.description) } : {}),
              ...(o.mimeType || o.mime_type ? { mimeType: String(o.mimeType ?? o.mime_type) } : {}),
            }
          }),
        }
        return result
      })
    },
  )

  // ===== 17. GET /resources/:uri — 资源详情 =====
  server.get(
    '/resources/:uri',
    {
      schema: {
        description: 'MCP 资源详情',
        tags: ['MCP Tools'],
        params: {
          type: 'object',
          properties: { uri: { type: 'string' } },
          required: ['uri'],
        },
        response: {
          200: { type: 'object' },
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('tools:read'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const { uri } = request.params as { uri: string }
      return forwardAiService(
        reply,
        `/api/mcp/resources/${encodeURIComponent(uri)}`,
        { method: 'GET' },
      )
    },
  )

  // ===== 18. GET /prompts — 提示词列表 =====
  server.get(
    '/prompts',
    {
      schema: {
        description: '提示词列表',
        tags: ['MCP Tools'],
        response: {
          200: {
            type: 'object',
            properties: {
              object: { type: 'string' },
              data: { type: 'array' },
            },
          },
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('tools:read'),
        requireApiKeyQuota(),
      ],
    },
    async (_request, reply) => {
      return forwardAiService(reply, '/api/mcp/prompts', { method: 'GET' }, (data) => {
        const d = asObj(data)
        const prompts = Array.isArray(d.prompts) ? d.prompts : Array.isArray(d.data) ? d.data : Array.isArray(d) ? d : []
        const result: V1PromptsResponse = {
          object: 'list',
          data: prompts.map((p) => {
            const o = asObj(p)
            return {
              name: String(o.name ?? ''),
              description: String(o.description ?? ''),
              ...(o.arguments
                ? {
                    arguments: (o.arguments as unknown[]).map((a) => {
                      const ao = asObj(a)
                      return {
                        name: String(ao.name ?? ''),
                        description: String(ao.description ?? ''),
                        required: Boolean(ao.required ?? false),
                      }
                    }),
                  }
                : {}),
            }
          }),
        }
        return result
      })
    },
  )

  // ===== 19. POST /prompts/invoke — 调用提示词 =====
  server.post(
    '/prompts/invoke',
    {
      schema: {
        description: '调用提示词',
        tags: ['MCP Tools'],
        body: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            arguments: { type: 'object' },
          },
          required: ['name'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              messages: { type: 'array' },
            },
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('tools:call'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const parsed = promptInvokeSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { name, arguments: args } = parsed.data
      const body: Record<string, unknown> = { name }
      if (args) body.arguments = args
      return forwardAiService(reply, '/api/mcp/prompts/invoke', jsonInit(body), (data) => {
        const d = asObj(data)
        const result: V1PromptInvokeResponse = {
          messages: Array.isArray(d.messages)
            ? d.messages.map((m) => {
                const o = asObj(m)
                const c = asObj(o.content)
                return {
                  role: String(o.role ?? ''),
                  content: {
                    type: String(c.type ?? 'text'),
                    text: String(c.text ?? ''),
                  },
                }
              })
            : [],
        }
        return result
      })
    },
  )

  // ===== 20. GET /skills — 技能列表 =====
  server.get(
    '/skills',
    {
      schema: {
        description: '技能列表',
        tags: ['MCP Tools'],
        response: {
          200: {
            type: 'object',
            properties: {
              object: { type: 'string' },
              data: { type: 'array' },
            },
          },
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('tools:read'),
        requireApiKeyQuota(),
      ],
    },
    async (_request, reply) => {
      return forwardAiService(reply, '/api/mcp/skills', { method: 'GET' }, (data) => {
        const d = asObj(data)
        const skills = Array.isArray(d.skills) ? d.skills : Array.isArray(d.data) ? d.data : Array.isArray(d) ? d : []
        const result: V1SkillsResponse = {
          object: 'list',
          data: skills.map((s) => {
            const o = asObj(s)
            return {
              name: String(o.name ?? ''),
              description: String(o.description ?? ''),
              version: String(o.version ?? '1.0.0'),
              capabilities: Array.isArray(o.capabilities) ? (o.capabilities as string[]) : [],
            }
          }),
        }
        return result
      })
    },
  )

  // ===== 21. GET /slash-commands — 斜杠命令列表 =====
  server.get(
    '/slash-commands',
    {
      schema: {
        description: '斜杠命令列表',
        tags: ['MCP Tools'],
        response: {
          200: {
            type: 'object',
            properties: {
              object: { type: 'string' },
              data: { type: 'array' },
            },
          },
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('tools:read'),
        requireApiKeyQuota(),
      ],
    },
    async (_request, reply) => {
      return forwardAiService(reply, '/api/mcp/slash-commands', { method: 'GET' }, (data) => {
        const d = asObj(data)
        const cmds = Array.isArray(d.commands) ? d.commands : Array.isArray(d.data) ? d.data : Array.isArray(d) ? d : []
        const result: V1SlashCommandsResponse = {
          object: 'list',
          data: cmds.map((c) => {
            const o = asObj(c)
            return {
              command: String(o.command ?? o.name ?? ''),
              description: String(o.description ?? ''),
            }
          }),
        }
        return result
      })
    },
  )

  // ===== 22. POST /slash-commands — 执行斜杠命令 =====
  server.post(
    '/slash-commands',
    {
      schema: {
        description: '执行斜杠命令',
        tags: ['MCP Tools'],
        body: { type: 'object' },
        response: {
          200: { type: 'object' },
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('tools:call'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      return forwardAiService(
        reply,
        '/api/mcp/slash-commands',
        jsonInit(request.body ?? {}),
      )
    },
  )

  // ===== 23. POST /sampling — 采样 =====
  server.post(
    '/sampling',
    {
      schema: {
        description: 'LLM 采样',
        tags: ['MCP Tools'],
        body: {
          type: 'object',
          properties: {
            messages: { type: 'array' },
            modelPreferences: { type: 'object' },
            maxTokens: { type: 'number' },
          },
          required: ['messages', 'maxTokens'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              model: { type: 'string' },
              role: { type: 'string' },
              content: { type: 'string' },
              stopReason: { type: 'string' },
            },
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('tools:call'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const parsed = samplingSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      return forwardAiService(
        reply,
        '/api/mcp/sampling',
        jsonInit(parsed.data),
        (data) => {
          const d = asObj(data)
          const result: V1SamplingResponse = {
            model: String(d.model ?? ''),
            role: String(d.role ?? 'assistant'),
            content: String(d.content ?? ''),
            stopReason: String(d.stopReason ?? d.stop_reason ?? 'stop'),
          }
          return result
        },
      )
    },
  )

  // ===== 24. GET /personas — 人格列表 =====
  server.get(
    '/personas',
    {
      schema: {
        description: '人格列表',
        tags: ['MCP Tools'],
        response: {
          200: {
            type: 'object',
            properties: {
              object: { type: 'string' },
              data: { type: 'array' },
            },
          },
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('tools:read'),
        requireApiKeyQuota(),
      ],
    },
    async (_request, reply) => {
      return forwardAiService(reply, '/api/personas', { method: 'GET' }, (data) => {
        const d = asObj(data)
        const personas = Array.isArray(d.personas) ? d.personas : Array.isArray(d.data) ? d.data : Array.isArray(d) ? d : []
        const result: V1PersonasResponse = {
          object: 'list',
          data: personas.map((p) => {
            const o = asObj(p)
            return {
              name: String(o.name ?? ''),
              description: String(o.description ?? ''),
              systemPrompt: String(o.systemPrompt ?? o.system_prompt ?? ''),
              traits: Array.isArray(o.traits) ? (o.traits as string[]) : [],
            }
          }),
        }
        return result
      })
    },
  )

  // ===== 25. GET /personas/:name — 人格详情 =====
  server.get(
    '/personas/:name',
    {
      schema: {
        description: '人格详情',
        tags: ['MCP Tools'],
        params: {
          type: 'object',
          properties: { name: { type: 'string' } },
          required: ['name'],
        },
        response: {
          200: { type: 'object' },
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('tools:read'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const { name } = request.params as { name: string }
      return forwardAiService(
        reply,
        `/api/personas/${encodeURIComponent(name)}`,
        { method: 'GET' },
      )
    },
  )

  // ===== 26. POST /tools/search-codebase — 搜索代码库 =====
  server.post(
    '/tools/search-codebase',
    {
      schema: {
        description: '搜索代码库',
        tags: ['MCP Tools'],
        body: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            directory: { type: 'string' },
          },
          required: ['query'],
        },
        response: {
          200: { type: 'object' },
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('tools:call'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const parsed = searchCodebaseSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      return forwardAiService(
        reply,
        '/api/tools/search-codebase',
        jsonInit(parsed.data),
      )
    },
  )

  // ===== 27. POST /tools/search-web — 搜索网页 =====
  server.post(
    '/tools/search-web',
    {
      schema: {
        description: '搜索网页',
        tags: ['MCP Tools'],
        body: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            num: { type: 'number' },
          },
          required: ['query'],
        },
        response: {
          200: { type: 'object' },
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('tools:call'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const parsed = searchWebSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      return forwardAiService(reply, '/api/tools/search-web', jsonInit(parsed.data))
    },
  )

  // ===== 28. POST /tools/analyze-code — 分析代码 =====
  server.post(
    '/tools/analyze-code',
    {
      schema: {
        description: '分析代码',
        tags: ['MCP Tools'],
        body: {
          type: 'object',
          properties: {
            code: { type: 'string' },
            language: { type: 'string' },
          },
          required: ['code'],
        },
        response: {
          200: { type: 'object' },
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('tools:call'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const parsed = analyzeCodeSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      return forwardAiService(reply, '/api/tools/analyze-code', jsonInit(parsed.data))
    },
  )

  // ===== 29. POST /screenshot — 截图 =====
  server.post(
    '/screenshot',
    {
      schema: {
        description: '网页截图',
        tags: ['MCP Tools'],
        body: {
          type: 'object',
          properties: {
            url: { type: 'string' },
            width: { type: 'number' },
            height: { type: 'number' },
            fullPage: { type: 'boolean' },
          },
          required: ['url'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              image: { type: 'string' },
              format: { type: 'string' },
              width: { type: 'number' },
              height: { type: 'number' },
            },
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('tools:call'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const parsed = screenshotSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      return forwardAiService(
        reply,
        '/api/screenshot/take',
        jsonInit(parsed.data),
        (data) => {
          const d = asObj(data)
          const result: V1ScreenshotResponse = {
            image: String(d.image ?? d.data ?? ''),
            format: String(d.format ?? 'png'),
            width: typeof d.width === 'number' ? d.width : 0,
            height: typeof d.height === 'number' ? d.height : 0,
          }
          return result
        },
      )
    },
  )

  // ===== 30. POST /memory — 保存记忆 =====
  server.post(
    '/memory',
    {
      schema: {
        description: '保存记忆',
        tags: ['Memory'],
        body: {
          type: 'object',
          properties: {
            content: { type: 'string' },
            type: { type: 'string' },
            metadata: { type: 'object' },
          },
          required: ['content'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              memoryId: { type: 'string' },
              status: { type: 'string' },
            },
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('memory:write'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const parsed = saveMemorySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      return forwardAiService(reply, '/api/memory/save', jsonInit(parsed.data), (data) => {
        const d = asObj(data)
        return {
          memoryId: String(d.memoryId ?? d.id ?? ''),
          status: 'saved' as const,
        }
      })
    },
  )

  // ===== 31. GET /memory — 召回记忆 =====
  server.get(
    '/memory',
    {
      schema: {
        description: '召回记忆',
        tags: ['Memory'],
        querystring: {
          type: 'object',
          properties: {
            type: { type: 'string' },
            limit: { type: 'number' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              object: { type: 'string' },
              data: { type: 'array' },
            },
          },
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('memory:read'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const qs = new URLSearchParams(request.query as Record<string, string>)
      const path = qs.toString() ? `/api/memory/recall?${qs}` : '/api/memory/recall'
      return forwardAiService(reply, path, { method: 'GET' }, (data) => {
        const d = asObj(data)
        const items = Array.isArray(d.data) ? d.data : Array.isArray(d.memories) ? d.memories : Array.isArray(d) ? d : []
        const result: V1RecallMemoryResponse = {
          object: 'list',
          data: items.map((m) => {
            const o = asObj(m)
            return {
              id: String(o.id ?? ''),
              content: String(o.content ?? ''),
              type: String(o.type ?? 'working'),
              score: typeof o.score === 'number' ? o.score : 0,
              createdAt: String(o.createdAt ?? o.created_at ?? new Date().toISOString()),
              ...(o.metadata ? { metadata: o.metadata as Record<string, unknown> } : {}),
            }
          }),
        }
        return result
      })
    },
  )

  // ===== 32. POST /memory/search — 语义搜索记忆 =====
  server.post(
    '/memory/search',
    {
      schema: {
        description: '语义搜索记忆',
        tags: ['Memory'],
        body: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            topK: { type: 'number' },
            type: { type: 'string' },
          },
          required: ['query'],
        },
        response: {
          200: { type: 'object' },
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('memory:read'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const parsed = memorySearchSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      return forwardAiService(
        reply,
        '/api/agents/memory/search',
        jsonInit(parsed.data as V1MemorySearchRequest),
      )
    },
  )

  // ===== 33. POST /memory/dream — Dream 梦境 =====
  server.post(
    '/memory/dream',
    {
      schema: {
        description: 'Dream 梦境(记忆整理)',
        tags: ['Memory'],
        body: {
          type: 'object',
          properties: {
            mode: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              dreamId: { type: 'string' },
              insights: { type: 'array', items: { type: 'string' } },
              newMemories: { type: 'number' },
            },
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('memory:write'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const parsed = memoryDreamSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      return forwardAiService(
        reply,
        '/api/memory/dream',
        jsonInit(parsed.data),
        (data) => {
          const d = asObj(data)
          const result: V1MemoryDreamResponse = {
            dreamId: String(d.dreamId ?? d.dream_id ?? ''),
            insights: Array.isArray(d.insights) ? (d.insights as string[]) : [],
            newMemories: typeof d.newMemories === 'number' ? d.newMemories : typeof d.new_memories === 'number' ? d.new_memories : 0,
          }
          return result
        },
      )
    },
  )

  // ===== 34. DELETE /memory — 遗忘记忆 =====
  server.delete(
    '/memory',
    {
      schema: {
        description: '遗忘记忆',
        tags: ['Memory'],
        body: {
          type: 'object',
          properties: {
            memoryId: { type: 'string' },
          },
          required: ['memoryId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              memoryId: { type: 'string' },
              status: { type: 'string' },
            },
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('memory:write'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const parsed = forgetMemorySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { memoryId } = parsed.data
      return forwardAiService(
        reply,
        '/api/memory/forget',
        jsonInit({ memoryId }, 'DELETE'),
        () => ({ memoryId, status: 'forgotten' as const }),
      )
    },
  )

  // ===== 35. GET /memory/working — 工作记忆 =====
  server.get(
    '/memory/working',
    {
      schema: {
        description: '工作记忆',
        tags: ['Memory'],
        response: {
          200: {
            type: 'object',
            properties: {
              items: { type: 'array' },
            },
          },
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('memory:read'),
        requireApiKeyQuota(),
      ],
    },
    async (_request, reply) => {
      return forwardAiService(reply, '/api/memory/working', { method: 'GET' }, (data) => {
        const d = asObj(data)
        const items = Array.isArray(d.items) ? d.items : Array.isArray(d.data) ? d.data : []
        const result: V1WorkingMemoryResponse = {
          items: items.map((m) => {
            const o = asObj(m)
            return {
              id: String(o.id ?? ''),
              content: String(o.content ?? ''),
              createdAt: String(o.createdAt ?? o.created_at ?? new Date().toISOString()),
            }
          }),
        }
        return result
      })
    },
  )

  // ===== 36. GET /memory/episodic — 情景记忆 =====
  server.get(
    '/memory/episodic',
    {
      schema: {
        description: '情景记忆',
        tags: ['Memory'],
        response: {
          200: {
            type: 'object',
            properties: {
              episodes: { type: 'array' },
            },
          },
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('memory:read'),
        requireApiKeyQuota(),
      ],
    },
    async (_request, reply) => {
      return forwardAiService(reply, '/api/memory/episodic', { method: 'GET' }, (data) => {
        const d = asObj(data)
        const episodes = Array.isArray(d.episodes) ? d.episodes : Array.isArray(d.data) ? d.data : []
        const result: V1EpisodicMemoryResponse = {
          episodes: episodes.map((e) => {
            const o = asObj(e)
            return {
              id: String(o.id ?? ''),
              summary: String(o.summary ?? ''),
              timestamp: String(o.timestamp ?? o.created_at ?? new Date().toISOString()),
              participants: Array.isArray(o.participants) ? (o.participants as string[]) : [],
            }
          }),
        }
        return result
      })
    },
  )

  // ===== 37. GET /memory/procedural — 程序记忆 =====
  server.get(
    '/memory/procedural',
    {
      schema: {
        description: '程序记忆',
        tags: ['Memory'],
        response: {
          200: {
            type: 'object',
            properties: {
              procedures: { type: 'array' },
            },
          },
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('memory:read'),
        requireApiKeyQuota(),
      ],
    },
    async (_request, reply) => {
      return forwardAiService(reply, '/api/memory/procedural', { method: 'GET' }, (data) => {
        const d = asObj(data)
        const procedures = Array.isArray(d.procedures) ? d.procedures : Array.isArray(d.data) ? d.data : []
        const result: V1ProceduralMemoryResponse = {
          procedures: procedures.map((p) => {
            const o = asObj(p)
            return {
              id: String(o.id ?? ''),
              name: String(o.name ?? ''),
              steps: Array.isArray(o.steps) ? (o.steps as string[]) : [],
              successRate: typeof o.successRate === 'number' ? o.successRate : typeof o.success_rate === 'number' ? o.success_rate : 0,
            }
          }),
        }
        return result
      })
    },
  )

  // ===== 38. POST /messages — 发布消息 =====
  server.post(
    '/messages',
    {
      schema: {
        description: '发布消息',
        tags: ['Messages'],
        body: {
          type: 'object',
          properties: {
            channel: { type: 'string' },
            content: { type: 'string' },
            recipients: { type: 'array', items: { type: 'string' } },
            metadata: { type: 'object' },
          },
          required: ['channel', 'content'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              messageId: { type: 'string' },
              status: { type: 'string' },
              subscriberCount: { type: 'number' },
            },
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('messages:write'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const parsed = publishMessageSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      return forwardAiService(
        reply,
        '/api/message-bus/publish',
        jsonInit(parsed.data),
        (data) => {
          const d = asObj(data)
          const result: V1PublishMessageResponse = {
            messageId: String(d.messageId ?? d.message_id ?? d.id ?? ''),
            status: 'published' as const,
            subscriberCount: typeof d.subscriberCount === 'number' ? d.subscriberCount : typeof d.subscriber_count === 'number' ? d.subscriber_count : 0,
          }
          return result
        },
      )
    },
  )

  // ===== 39. POST /messages/subscribe — 订阅频道 =====
  server.post(
    '/messages/subscribe',
    {
      schema: {
        description: '订阅频道',
        tags: ['Messages'],
        body: {
          type: 'object',
          properties: {
            channel: { type: 'string' },
            callbackUrl: { type: 'string' },
          },
          required: ['channel', 'callbackUrl'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              subscriptionId: { type: 'string' },
              status: { type: 'string' },
            },
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('messages:write'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const parsed = subscribeMessageSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      return forwardAiService(
        reply,
        '/api/message-bus/subscribe',
        jsonInit(parsed.data),
        (data) => {
          const d = asObj(data)
          const result: V1SubscribeMessageResponse = {
            subscriptionId: String(d.subscriptionId ?? d.subscription_id ?? d.id ?? ''),
            status: 'subscribed' as const,
          }
          return result
        },
      )
    },
  )

  // ===== 40. DELETE /messages/subscribe/:id — 取消订阅 =====
  server.delete(
    '/messages/subscribe/:id',
    {
      schema: {
        description: '取消订阅',
        tags: ['Messages'],
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
        response: {
          200: { type: 'object' },
          204: { type: 'null' },
          401: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('messages:write'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      try {
        const resp = await fetch(
          `${config.AI_SERVICE_URL}/api/message-bus/subscribe/${encodeURIComponent(id)}`,
          { method: 'DELETE' },
        )
        if (!resp.ok) {
          const txt = await resp.text().catch(() => '')
          return reply
            .status(503)
            .send(error(503, `AI service unavailable (${resp.status}): ${txt.slice(0, 200)}`))
        }
        if (resp.status === 204) return reply.status(204).send()
        const data = await resp.json().catch(() => ({}))
        return reply.send(data)
      } catch (e) {
        return reply.status(503).send(error(503, (e as Error).message || 'AI service unavailable'))
      }
    },
  )

  // ===== 41. GET /messages/:id/status — 消息状态 =====
  server.get(
    '/messages/:id/status',
    {
      schema: {
        description: '消息状态',
        tags: ['Messages'],
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              messageId: { type: 'string' },
              status: { type: 'string' },
              deliveredCount: { type: 'number' },
              failedCount: { type: 'number' },
            },
          },
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('messages:read'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      return forwardAiService(
        reply,
        `/api/message-bus/status/${encodeURIComponent(id)}`,
        { method: 'GET' },
        (data) => {
          const d = asObj(data)
          const result: V1MessageStatusResponse = {
            messageId: String(d.messageId ?? d.message_id ?? id),
            status: (d.status as 'pending' | 'delivered' | 'failed') ?? 'pending',
            deliveredCount: typeof d.deliveredCount === 'number' ? d.deliveredCount : typeof d.delivered_count === 'number' ? d.delivered_count : 0,
            failedCount: typeof d.failedCount === 'number' ? d.failedCount : typeof d.failed_count === 'number' ? d.failed_count : 0,
          }
          return result
        },
      )
    },
  )

  // ===== 42. GET /files/:id — 文件详情 =====
  server.get(
    '/files/:id',
    {
      schema: {
        description: '文件详情',
        tags: ['Files'],
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              object: { type: 'string' },
              filename: { type: 'string' },
              bytes: { type: 'number' },
              mimeType: { type: 'string' },
              createdAt: { type: 'string' },
              updatedAt: { type: 'string' },
            },
          },
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('files:read'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const userId = getUserId(request, reply)
      if (!userId) return
      const { id } = request.params as { id: string }
      return forwardInternal(
        reply,
        `/api/files/${encodeURIComponent(id)}`,
        { method: 'GET' },
        userId,
        (data) => {
          const d = asObj(data)
          const result: V1FileInfo = {
            id: String(d.id ?? id),
            object: 'file',
            filename: String(d.filename ?? d.name ?? ''),
            bytes: typeof d.bytes === 'number' ? d.bytes : typeof d.size === 'number' ? d.size : 0,
            mimeType: String(d.mimeType ?? d.mime_type ?? 'application/octet-stream'),
            createdAt: String(d.createdAt ?? d.created_at ?? new Date().toISOString()),
            updatedAt: String(d.updatedAt ?? d.updated_at ?? d.created_at ?? new Date().toISOString()),
          }
          return result
        },
      )
    },
  )

  // ===== 43. DELETE /files/:id — 删除文件 =====
  server.delete(
    '/files/:id',
    {
      schema: {
        description: '删除文件',
        tags: ['Files'],
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
        response: {
          200: { type: 'object' },
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('files:write'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const userId = getUserId(request, reply)
      if (!userId) return
      const { id } = request.params as { id: string }
      return forwardInternal(
        reply,
        `/api/files/${encodeURIComponent(id)}`,
        jsonInit({}, 'DELETE'),
        userId,
      )
    },
  )

  // ===== 44. GET /files/:id/content — 文件内容 =====
  server.get(
    '/files/:id/content',
    {
      schema: {
        description: '文件内容(二进制流)',
        tags: ['Files'],
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
        response: {
          200: { type: 'string' },
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('files:read'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const userId = getUserId(request, reply)
      if (!userId) return
      const { id } = request.params as { id: string }
      return forwardInternal(
        reply,
        `/api/files/${encodeURIComponent(id)}/content`,
        { method: 'GET' },
        userId,
      )
    },
  )

  // ===== 45. GET /files/:id/versions — 文件版本 =====
  server.get(
    '/files/:id/versions',
    {
      schema: {
        description: '文件版本列表',
        tags: ['Files'],
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              object: { type: 'string' },
              data: { type: 'array' },
            },
          },
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('files:read'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const userId = getUserId(request, reply)
      if (!userId) return
      const { id } = request.params as { id: string }
      return forwardInternal(
        reply,
        `/api/files/${encodeURIComponent(id)}/versions`,
        { method: 'GET' },
        userId,
        (data) => {
          const d = asObj(data)
          const versions = Array.isArray(d.data) ? d.data : Array.isArray(d.versions) ? d.versions : Array.isArray(d) ? d : []
          const result: V1FileVersionsResponse = {
            object: 'list',
            data: versions.map((v) => {
              const o = asObj(v)
              return {
                version: typeof o.version === 'number' ? o.version : 0,
                size: typeof o.size === 'number' ? o.size : typeof o.bytes === 'number' ? o.bytes : 0,
                createdAt: String(o.createdAt ?? o.created_at ?? new Date().toISOString()),
                checksum: String(o.checksum ?? o.hash ?? ''),
              }
            }),
          }
          return result
        },
      )
    },
  )

  // ===== 46. POST /files/upload-init — 分片上传初始化 =====
  server.post(
    '/files/upload-init',
    {
      schema: {
        description: '分片上传初始化',
        tags: ['Files'],
        body: {
          type: 'object',
          properties: {
            filename: { type: 'string' },
            size: { type: 'number' },
            mimeType: { type: 'string' },
            chunkSize: { type: 'number' },
          },
          required: ['filename', 'size', 'mimeType', 'chunkSize'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              uploadId: { type: 'string' },
              chunkCount: { type: 'number' },
            },
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('files:write'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const userId = getUserId(request, reply)
      if (!userId) return
      const parsed = uploadInitSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      return forwardInternal(
        reply,
        '/api/chunked-upload/init',
        jsonInit(parsed.data),
        userId,
        (data) => {
          const d = asObj(data)
          const result: V1UploadInitResponse = {
            uploadId: String(d.uploadId ?? d.upload_id ?? d.id ?? ''),
            chunkCount: typeof d.chunkCount === 'number' ? d.chunkCount : typeof d.chunk_count === 'number' ? d.chunk_count : 0,
          }
          return result
        },
      )
    },
  )

  // ===== 47. POST /files/upload-chunk — 上传分片 =====
  server.post(
    '/files/upload-chunk',
    {
      schema: {
        description: '上传分片',
        tags: ['Files'],
        body: {
          type: 'object',
          properties: {
            uploadId: { type: 'string' },
            index: { type: 'number' },
            chunk: { type: 'string' },
          },
          required: ['uploadId', 'index', 'chunk'],
        },
        response: {
          200: { type: 'object' },
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('files:write'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const userId = getUserId(request, reply)
      if (!userId) return
      const parsed = uploadChunkSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      return forwardInternal(
        reply,
        '/api/chunked-upload/upload',
        jsonInit(parsed.data),
        userId,
      )
    },
  )

  // ===== 48. POST /files/complete — 完成上传 =====
  server.post(
    '/files/complete',
    {
      schema: {
        description: '完成分片上传',
        tags: ['Files'],
        body: {
          type: 'object',
          properties: {
            uploadId: { type: 'string' },
          },
          required: ['uploadId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              fileId: { type: 'string' },
              status: { type: 'string' },
            },
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('files:write'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const userId = getUserId(request, reply)
      if (!userId) return
      const parsed = uploadCompleteSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      return forwardInternal(
        reply,
        '/api/chunked-upload/merge',
        jsonInit(parsed.data),
        userId,
        (data) => {
          const d = asObj(data)
          return {
            fileId: String(d.fileId ?? d.file_id ?? d.id ?? ''),
            status: 'completed' as const,
          }
        },
      )
    },
  )

  // ===== 49. GET /me — 当前用户 + 配额 =====
  server.get(
    '/me',
    {
      schema: {
        description: '当前用户信息 + 配额',
        tags: ['User'],
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              username: { type: 'string' },
              email: { type: 'string' },
              avatar: { type: 'string' },
              createdAt: { type: 'string' },
              quota: { type: 'object' },
            },
          },
          401: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('user:read'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const apiKey = (request as FastifyRequest & { apiKey?: ApiKeyContext }).apiKey
      if (!apiKey) {
        return reply.status(401).send(error(401, 'API key authentication required'))
      }
      const [userRow] = await dbRead
        .select({
          id: users.id,
          username: users.username,
          email: users.email,
          avatar: users.avatar,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.id, apiKey.userId))
        .limit(1)
      if (!userRow) {
        return reply.status(404).send(error(404, 'User not found'))
      }
      const [quotaRow] = await dbRead
        .select({
          hourlyUsed: apiKeyQuotas.hourlyUsed,
          hourlyLimit: apiKeyQuotas.hourlyLimit,
          dailyUsed: apiKeyQuotas.dailyUsed,
          dailyLimit: apiKeyQuotas.dailyLimit,
          resetAt: apiKeyQuotas.resetAt,
        })
        .from(apiKeyQuotas)
        .where(eq(apiKeyQuotas.apiKeyId, apiKey.id))
        .limit(1)
      const result: V1UserInfo = {
        id: userRow.id,
        username: userRow.username ?? userRow.email ?? '',
        email: userRow.email ?? '',
        ...(userRow.avatar ? { avatar: userRow.avatar } : {}),
        createdAt: userRow.createdAt?.toISOString() ?? new Date().toISOString(),
        quota: {
          hourlyUsed: quotaRow?.hourlyUsed ?? 0,
          hourlyLimit: quotaRow?.hourlyLimit ?? apiKey.rateLimit,
          dailyUsed: quotaRow?.dailyUsed ?? 0,
          dailyLimit: quotaRow?.dailyLimit ?? apiKey.rateLimit * 24,
          resetAt: quotaRow?.resetAt?.toISOString() ?? new Date(Date.now() + 3600000).toISOString(),
        },
      }
      return reply.send(result)
    },
  )

  // ===== 50. GET /projects — 项目列表 =====
  server.get(
    '/projects',
    {
      schema: {
        description: '项目列表',
        tags: ['Workspace'],
        response: {
          200: {
            type: 'object',
            properties: {
              object: { type: 'string' },
              data: { type: 'array' },
            },
          },
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('workspace:read'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const userId = getUserId(request, reply)
      if (!userId) return
      return forwardInternal(
        reply,
        '/api/workspace/projects',
        { method: 'GET' },
        userId,
        (data) => {
          const d = asObj(data)
          const projects = Array.isArray(d.data) ? d.data : Array.isArray(d.projects) ? d.projects : Array.isArray(d) ? d : []
          const result: V1ProjectsResponse = {
            object: 'list',
            data: projects.map((p) => {
              const o = asObj(p)
              return {
                id: String(o.id ?? ''),
                name: String(o.name ?? ''),
                ...(o.description ? { description: String(o.description) } : {}),
                fileCount: typeof o.fileCount === 'number' ? o.fileCount : typeof o.file_count === 'number' ? o.file_count : 0,
                createdAt: String(o.createdAt ?? o.created_at ?? new Date().toISOString()),
                updatedAt: String(o.updatedAt ?? o.updated_at ?? new Date().toISOString()),
              }
            }),
          }
          return result
        },
      )
    },
  )

  // ===== 51. GET /projects/:id/files — 项目文件 =====
  server.get(
    '/projects/:id/files',
    {
      schema: {
        description: '项目文件列表',
        tags: ['Workspace'],
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              object: { type: 'string' },
              data: { type: 'array' },
            },
          },
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('workspace:read'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const userId = getUserId(request, reply)
      if (!userId) return
      const { id } = request.params as { id: string }
      return forwardInternal(
        reply,
        `/api/workspace/projects/${encodeURIComponent(id)}/files`,
        { method: 'GET' },
        userId,
        (data) => {
          const d = asObj(data)
          const files = Array.isArray(d.data) ? d.data : Array.isArray(d.files) ? d.files : Array.isArray(d) ? d : []
          const result: V1ProjectFilesResponse = {
            object: 'list',
            data: files.map((f) => {
              const o = asObj(f)
              return {
                id: String(o.id ?? ''),
                object: 'file' as const,
                filename: String(o.filename ?? o.name ?? ''),
                bytes: typeof o.bytes === 'number' ? o.bytes : typeof o.size === 'number' ? o.size : 0,
                mimeType: String(o.mimeType ?? o.mime_type ?? 'application/octet-stream'),
                createdAt: String(o.createdAt ?? o.created_at ?? new Date().toISOString()),
                updatedAt: String(o.updatedAt ?? o.updated_at ?? o.created_at ?? new Date().toISOString()),
              }
            }),
          }
          return result
        },
      )
    },
  )

  // ===== 52. GET /workflows/:id — 工作流详情 =====
  server.get(
    '/workflows/:id',
    {
      schema: {
        description: '工作流详情',
        tags: ['Workflows'],
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              description: { type: 'string' },
              steps: { type: 'array' },
              createdAt: { type: 'string' },
            },
          },
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('workflows:read'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const userId = getUserId(request, reply)
      if (!userId) return
      const { id } = request.params as { id: string }
      return forwardInternal(
        reply,
        `/api/workflows/${encodeURIComponent(id)}`,
        { method: 'GET' },
        userId,
        (data) => {
          const d = asObj(data)
          const stepsRaw = Array.isArray(d.steps) ? d.steps : Array.isArray(d.nodes) ? d.nodes : []
          const result: V1WorkflowInfo = {
            id: String(d.id ?? id),
            name: String(d.name ?? ''),
            ...(d.description ? { description: String(d.description) } : {}),
            steps: stepsRaw.map((s) => {
              const o = asObj(s)
              return {
                id: String(o.id ?? ''),
                name: String(o.name ?? ''),
                type: String(o.type ?? ''),
                ...(o.config ? { config: o.config as Record<string, unknown> } : {}),
              }
            }),
            createdAt: String(d.createdAt ?? d.created_at ?? new Date().toISOString()),
          }
          return result
        },
      )
    },
  )

  // ===== 53. POST /workflows/instances — 运行工作流 =====
  server.post(
    '/workflows/instances',
    {
      schema: {
        description: '运行工作流',
        tags: ['Workflows'],
        body: {
          type: 'object',
          properties: {
            workflowId: { type: 'string' },
            inputs: { type: 'object' },
          },
          required: ['workflowId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              instanceId: { type: 'string' },
              status: { type: 'string' },
              outputs: { type: 'object' },
            },
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('workflows:write'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const userId = getUserId(request, reply)
      if (!userId) return
      const parsed = runWorkflowSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      return forwardInternal(
        reply,
        '/api/workflows/instances',
        jsonInit(parsed.data),
        userId,
        (data) => {
          const d = asObj(data)
          const result: V1RunWorkflowResponse = {
            instanceId: String(d.instanceId ?? d.instance_id ?? d.id ?? ''),
            status: (d.status as 'running' | 'completed' | 'failed') ?? 'running',
            ...(d.outputs ? { outputs: d.outputs as Record<string, unknown> } : {}),
          }
          return result
        },
      )
    },
  )

  // ===== 54. POST /workflows/coze/run — Coze 工作流 =====
  server.post(
    '/workflows/coze/run',
    {
      schema: {
        description: 'Coze 工作流运行',
        tags: ['Workflows'],
        body: {
          type: 'object',
          properties: {
            workflowId: { type: 'string' },
            parameters: { type: 'object' },
          },
          required: ['workflowId', 'parameters'],
        },
        response: {
          200: { type: 'object' },
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('workflows:write'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const userId = getUserId(request, reply)
      if (!userId) return
      const parsed = runCozeWorkflowSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      return forwardInternal(
        reply,
        '/api/ai/coze/workflow/run',
        jsonInit(parsed.data),
        userId,
      )
    },
  )

  // ===== 55. POST /workflows/n8n/run — n8n 工作流 =====
  server.post(
    '/workflows/n8n/run',
    {
      schema: {
        description: 'n8n 工作流运行',
        tags: ['Workflows'],
        body: {
          type: 'object',
          properties: {
            workflowId: { type: 'string' },
            data: { type: 'object' },
          },
          required: ['workflowId'],
        },
        response: {
          200: { type: 'object' },
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('workflows:write'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const userId = getUserId(request, reply)
      if (!userId) return
      const parsed = runN8nWorkflowSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      return forwardInternal(
        reply,
        '/api/ai/n8n/workflow/run',
        jsonInit(parsed.data),
        userId,
      )
    },
  )

  // ===== 56. GET /usage — 用量统计 =====
  server.get(
    '/usage',
    {
      schema: {
        description: '用量统计',
        tags: ['Stats'],
        response: {
          200: {
            type: 'object',
            properties: {
              apiKeyId: { type: 'string' },
              period: { type: 'string' },
              totalRequests: { type: 'number' },
              byCategory: { type: 'object' },
              byModel: { type: 'object' },
              tokensUsed: { type: 'number' },
            },
          },
          401: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('stats:read'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const apiKey = (request as FastifyRequest & { apiKey?: ApiKeyContext }).apiKey
      if (!apiKey) {
        return reply.status(401).send(error(401, 'API key authentication required'))
      }
      try {
        // totalRequests: api_logs 按 user_id 统计(api_logs 无 api_key_id 列,用 user_id 替代)
        const totalRow = await dbRead
          .select({ total: sql<number>`count(*)::int` })
          .from(apiLogs)
          .where(eq(apiLogs.userId, apiKey.userId))
        const totalRequests = totalRow[0]?.total ?? 0

        // byCategory: api_logs 按 path 前缀分组(作为 category 代理)
        const categoryRows = await dbRead
          .select({
            category: sql<string>`split_part(path, '/', 4)`,
            count: sql<number>`count(*)::int`,
          })
          .from(apiLogs)
          .where(eq(apiLogs.userId, apiKey.userId))
          .groupBy(sql`split_part(path, '/', 4)`)
        const byCategory: Record<string, number> = {}
        for (const r of categoryRows) {
          if (r.category) byCategory[r.category] = r.count
        }

        // byModel: llm_call_logs 按 model 分组,统计 token 用量
        const modelRows = await dbRead
          .select({
            model: llmCallLogs.model,
            tokens: sql<number>`coalesce(sum(${llmCallLogs.totalTokens}), 0)::int`,
          })
          .from(llmCallLogs)
          .where(eq(llmCallLogs.userId, apiKey.userId))
          .groupBy(llmCallLogs.model)
        const byModel: Record<string, number> = {}
        for (const r of modelRows) {
          byModel[r.model] = r.tokens
        }

        // tokensUsed: llm_call_logs 总 token 数
        const tokenRow = await dbRead
          .select({ total: sql<number>`coalesce(sum(${llmCallLogs.totalTokens}), 0)::int` })
          .from(llmCallLogs)
          .where(eq(llmCallLogs.userId, apiKey.userId))
        const tokensUsed = tokenRow[0]?.total ?? 0

        const result: V1UsageResponse = {
          apiKeyId: apiKey.id,
          period: 'all',
          totalRequests,
          byCategory,
          byModel,
          tokensUsed,
        }
        return reply.send(result)
      } catch (e) {
        return reply.status(500).send(error(500, (e as Error).message || 'Failed to fetch usage'))
      }
    },
  )

  // ===== 57. GET /usage/:vendor — 厂商用量 =====
  server.get(
    '/usage/:vendor',
    {
      schema: {
        description: '厂商用量统计',
        tags: ['Stats'],
        params: {
          type: 'object',
          properties: { vendor: { type: 'string' } },
          required: ['vendor'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              vendor: { type: 'string' },
              requests: { type: 'number' },
              tokens: { type: 'number' },
              cost: { type: 'number' },
            },
          },
          401: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('stats:read'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const apiKey = (request as FastifyRequest & { apiKey?: ApiKeyContext }).apiKey
      if (!apiKey) {
        return reply.status(401).send(error(401, 'API key authentication required'))
      }
      const { vendor } = request.params as { vendor: string }
      try {
        const prefixes = VENDOR_PREFIXES[vendor.toLowerCase()] ?? []
        if (prefixes.length === 0) {
          // 未知厂商:只支持已知厂商,避免 LIKE 通配符注入
          return reply.send({ vendor, requests: 0, tokens: 0, cost: 0 } satisfies V1VendorUsageResponse)
        }

        // requests + tokens: llm_call_logs 按 model 前缀过滤
        const modelConds = prefixes.map((p) => like(llmCallLogs.model, p))
        const llmRow = await dbRead
          .select({
            requests: sql<number>`count(*)::int`,
            tokens: sql<number>`coalesce(sum(${llmCallLogs.totalTokens}), 0)::int`,
          })
          .from(llmCallLogs)
          .where(and(eq(llmCallLogs.userId, apiKey.userId), or(...modelConds)))
        const requests = llmRow[0]?.requests ?? 0
        const tokens = llmRow[0]?.tokens ?? 0

        // cost: ai_cost_records 按 model 前缀过滤,汇总成本(USD)
        const costConds = prefixes.map((p) => like(aiCostRecords.model, p))
        const costRow = await dbRead
          .select({ total: sql<number>`coalesce(sum(${aiCostRecords.cost}), 0)::float` })
          .from(aiCostRecords)
          .where(and(eq(aiCostRecords.userId, apiKey.userId), or(...costConds)))
        const cost = costRow[0]?.total ?? 0

        const result: V1VendorUsageResponse = { vendor, requests, tokens, cost }
        return reply.send(result)
      } catch (e) {
        return reply.status(500).send(error(500, (e as Error).message || 'Failed to fetch vendor usage'))
      }
    },
  )
}

export default v1KnowledgeToolsRoutes
