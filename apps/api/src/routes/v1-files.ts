/**
 * /v1/files 路由(2026-08-01 立,§24 用户确认)。
 *
 * OpenAI Files API 兼容端点,为 v1-batches 提供 JSONL 文件上传入口。
 *
 * 端点清单(1 个):
 *   POST /files  上传 JSONL 文件,返回 file 对象(供 POST /batch 的 input_file_id 使用)
 *
 * 参考:https://platform.openai.com/docs/api-reference/files/create
 *
 * 鉴权:复用 plugins/api-key-auth.ts 的 requireApiKeyAuth(Bearer token + developer_api_keys 表)。
 * 存储:文件内容存 Redis(key = `batch:input:<fileId>`,TTL 30 天,与 batch-queue.ts saveBatchInput 配对)。
 *
 * 响应格式:OpenAI 兼容(不套 { code, message, data } 壳,与 v1-batches.ts / v1-public.ts 一致)。
 * 错误格式:{ code, message } + HTTP 状态码(400/401/500)。
 *
 * 依赖:@fastify/multipart 已在 server.ts 全局注册(limits.fileSize = 100MB)。
 */
import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import type { Multipart } from '@fastify/multipart'
import { randomUUID } from 'node:crypto'
import { requireApiKeyAuth } from '../plugins/api-key-auth.js'
import { error } from '../utils/response.js'
import { saveBatchInput } from '../queue/batch-queue.js'

/** 鉴权后注入 request 的 API Key 上下文(与 v1-batches.ts ApiKeyContext 结构一致) */
interface ApiKeyContext {
  id: string
  userId: string
  key: string
  permissions: string[]
  rateLimit: number
}

/** OpenAI Files API 响应结构 */
interface OpenAIFileObject {
  id: string
  object: 'file'
  bytes: number
  created_at: number
  filename: string
  purpose: string
  status: 'processed'
}

/**
 * 从 multipart 字段中提取字符串值。
 * - 字段可能是单个 Multipart 或数组(取第一个元素)
 * - 跳过文件字段(type='file'),只处理值字段(type='field')
 * - 值非 string 时返回 undefined
 */
function multipartStringValue(field: Multipart | Multipart[] | undefined): string | undefined {
  if (!field) return undefined
  const item = Array.isArray(field) ? field[0] : field
  if (!item || item.type !== 'field') return undefined
  return typeof item.value === 'string' ? item.value : undefined
}

const v1Files: FastifyPluginAsync = async (server) => {
  const redis = server.redis

  server.post(
    '/files',
    {
      schema: {
        description:
          'OpenAI Files API — 上传 JSONL 文件(供 POST /v1/batch 的 input_file_id 使用)',
        tags: ['Files'],
        consumes: ['multipart/form-data'],
      },
      preHandler: [requireApiKeyAuth],
    },
    async (request, reply) => {
      const apiKey = (request as FastifyRequest & { apiKey?: ApiKeyContext }).apiKey
      if (!apiKey) {
        return reply.status(401).send(error(401, 'API key authentication required'))
      }

      // multipart 解析:request.file() 返回 MultipartFile | undefined
      // (consume 单文件 + 关联字段,与 OpenAI Files API 单文件上传语义一致)
      const data = await request.file()
      if (!data) {
        return reply.status(400).send(error(400, 'No file uploaded'))
      }

      // purpose 字段(OpenAI 规范:batch/assistants/fine-tune 等,本端点校验为 batch)
      const purpose = multipartStringValue(data.fields.purpose)
      if (purpose !== 'batch') {
        return reply
          .status(400)
          .send(error(400, 'purpose must be "batch" (only batch input files are supported)'))
      }

      // 读取文件流到 buffer(限 100MB,由 @fastify/multipart 全局 limits 兜底)
      const chunks: Buffer[] = []
      for await (const chunk of data.file) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
      }
      const buffer = Buffer.concat(chunks)
      const content = buffer.toString('utf-8')

      // 生成 file_id + 存储到 Redis(与 batch-worker.ts getBatchInput 配对)
      const fileId = `file-${randomUUID()}`
      await saveBatchInput(redis, fileId, content)

      const fileObject: OpenAIFileObject = {
        id: fileId,
        object: 'file',
        bytes: buffer.length,
        created_at: Math.floor(Date.now() / 1000),
        filename: data.filename || 'batch-input.jsonl',
        purpose: 'batch',
        status: 'processed',
      }

      return reply.send(fileObject)
    },
  )
}

export default v1Files
