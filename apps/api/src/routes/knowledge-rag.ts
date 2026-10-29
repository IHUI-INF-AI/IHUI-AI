// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 知识库 RAG 路由。
 * 迁移自 v1.0.2-sealed: server/app/api/v1/knowledge/__init__.py
 *
 * 端点(注册前缀 /api/knowledge):
 * - GET  /health                健康检查
 * - POST /ingest                纯文本入库 (返回切片数)
 * - POST /upload                多格式文件入库 (PDF / DOCX / MD / Text / HTML)
 * - POST /search                语义检索
 * - POST /rag-context           生成 RAG 上下文文本
 * - GET  /docs                  文档列表
 * - GET  /docs/:id              文档详情
 * - GET  /docs/:id/chunks       文档切片预览
 * - DELETE /docs/:id            软删除文档
 * - POST /docs/batch-delete     批量删除
 */

import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { success, error } from '../utils/response.js'
import { knowledgeRagService } from '../services/knowledge-rag-service.js'
import { UnsupportedFormatError, FileTooLargeError } from '../services/document-parser.js'
import { checkAuth } from '../plugins/auth.js'

const ingestSchema = z.object({
  title: z.string().min(1),
  text: z.string().min(1),
  collectionName: z.string().default('default'),
})

const searchSchema = z.object({
  query: z.string().min(1),
  collectionName: z.string().default('default'),
  topK: z.number().int().min(1).max(50).default(5),
  scoreThreshold: z.number().min(0).max(1).default(0),
})

const ragContextSchema = z.object({
  query: z.string().min(1),
  collectionName: z.string().default('default'),
  topK: z.number().int().min(1).max(50).default(5),
})

const batchDeleteSchema = z.object({
  docIds: z.array(z.number().int().positive()).max(100),
})

/**
 * 归属只认凭据。preHandler 已强制鉴权，此处仅做类型收敛：
 * 一旦某条路由被误加进公开名单，缺 userId 的请求会 401 而不是落到某个空 owner。
 */
function requireUserId(req: FastifyRequest): string {
  const userId = req.userId
  if (!userId) {
    throw Object.assign(new Error('未登录'), { statusCode: 401 })
  }
  return userId
}

export const knowledgeRagRoutes: FastifyPluginAsync = async (server) => {
  // 用户数据面：除健康检查外一律要求登录。归属取自凭据，不接受请求参数指定。
  server.addHook('preHandler', async (request, reply) => {
    if (request.url.split('?')[0] === '/api/knowledge/health') return
    if (!(await checkAuth(request, reply))) return
  })

  // GET /health - 健康检查
  server.get('/health', async (_req, reply) => {
    return reply.send(success({ status: 'ok' }))
  })

  // POST /ingest - 纯文本入库
  server.post('/ingest', async (req, reply) => {
    const parsed = ingestSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const b = parsed.data
    const owner = requireUserId(req)
    try {
      const chunkCount = await knowledgeRagService.ingestText({
        ownerUuid: owner,
        title: b.title,
        text: b.text,
        collectionName: b.collectionName,
      })
      return reply.send(success({ chunkCount }))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '入库失败'))
    }
  })

  // POST /search - 语义检索
  server.post('/search', async (req, reply) => {
    const parsed = searchSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const b = parsed.data
    const owner = requireUserId(req)
    try {
      const results = await knowledgeRagService.search({
        query: b.query,
        collectionName: b.collectionName,
        topK: b.topK,
        scoreThreshold: b.scoreThreshold,
        ownerUuid: owner,
      })
      return reply.send(success(results))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '检索失败'))
    }
  })

  // POST /rag-context - 生成 RAG 上下文
  server.post('/rag-context', async (req, reply) => {
    const parsed = ragContextSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const b = parsed.data
    const owner = requireUserId(req)
    try {
      const context = await knowledgeRagService.getRagContext({
        query: b.query,
        collectionName: b.collectionName,
        topK: b.topK,
        ownerUuid: owner,
      })
      return reply.send(success({ context, hasResult: Boolean(context) }))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '生成上下文失败'))
    }
  })

  // GET /docs - 文档列表
  server.get('/docs', async (req, reply) => {
    const owner = requireUserId(req)
    try {
      const docs = await knowledgeRagService.listDocs(owner)
      return reply.send(success(docs))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '列表查询失败'))
    }
  })

  // GET /docs/:id - 文档详情
  server.get('/docs/:id', async (req, reply) => {
    const id = Number((req.params as { id: string }).id)
    if (!Number.isInteger(id) || id <= 0) {
      return reply.status(400).send(error(400, 'doc_id 非法'))
    }
    const owner = requireUserId(req)
    try {
      const doc = await knowledgeRagService.getDocDetail(id, owner)
      if (!doc) return reply.status(404).send(error(404, '文档不存在'))
      return reply.send(success(doc))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询失败'))
    }
  })

  // GET /docs/:id/chunks - 文档切片预览
  server.get('/docs/:id/chunks', async (req, reply) => {
    const id = Number((req.params as { id: string }).id)
    if (!Number.isInteger(id) || id <= 0) {
      return reply.status(400).send(error(400, 'doc_id 非法'))
    }
    const q = (req.query as { limit?: string }) ?? {}
    const limit = q.limit ? Math.max(1, Math.min(100, Number(q.limit))) : 10
    const owner = requireUserId(req)
    try {
      const chunks = await knowledgeRagService.getDocChunks(id, owner, limit)
      return reply.send(success(chunks))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '切片查询失败'))
    }
  })

  // DELETE /docs/:id - 软删除文档
  server.delete('/docs/:id', async (req, reply) => {
    const id = Number((req.params as { id: string }).id)
    if (!Number.isInteger(id) || id <= 0) {
      return reply.status(400).send(error(400, 'doc_id 非法'))
    }
    const owner = requireUserId(req)
    try {
      const ok = await knowledgeRagService.deleteDoc(id, owner)
      if (!ok) return reply.status(404).send(error(404, '文档不存在或已删除'))
      return reply.send(success({ deleted: ok }))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '删除失败'))
    }
  })

  // POST /docs/batch-delete - 批量删除
  server.post('/docs/batch-delete', async (req, reply) => {
    const parsed = batchDeleteSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const b = parsed.data
    const owner = requireUserId(req)
    try {
      const result = await knowledgeRagService.batchDeleteDocs(b.docIds, owner)
      return reply.send(success(result))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '批量删除失败'))
    }
  })

  // POST /upload - 多格式文件入库 (PDF / DOCX / MD / Text / HTML)
  // multipart/form-data:
  //   file: 必填,单文件 (PDF / DOCX / Markdown / 纯文本 / HTML),≤20MB
  //   title: 可选,默认用 filename 去扩展名
  //   collectionName: 可选,默认 'default'
  // 鉴权:登录用户 (preHandler 统一校验,未登录 → 401)
  // 2026-10-28 DDoS P2:文档上传上限 20MB(对齐路由注释),显式放开脱离全局 2MiB。
  server.post('/upload', { bodyLimit: 21 * 1024 * 1024 }, async (req, reply) => {
    // 1) 解析 multipart 单文件
    const data = await req.file().catch(() => null)
    if (!data) {
      return reply.status(400).send(error(400, '缺少 file 字段'))
    }
    const buffer = await data.toBuffer()
    // 2) 读取可选 form 字段
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

    const filename = data.filename ?? 'untitled'
    const title = (titleRaw && titleRaw.trim()) || filename.replace(/\.[^.]+$/, '') || 'untitled'
    const collectionName = (collectionRaw && collectionRaw.trim()) || 'default'

    // 3) 解析 + 入库
    try {
      const result = await knowledgeRagService.ingestFile({
        ownerUuid: requireUserId(req),
        title,
        buffer,
        mimeType: data.mimetype ?? 'application/octet-stream',
        filename,
        collectionName,
      })
      return reply.send(success({ ...result, filename, mimeType: data.mimetype ?? '' }))
    } catch (e) {
      if (e instanceof UnsupportedFormatError) {
        return reply.status(400).send(error(400, e.message))
      }
      if (e instanceof FileTooLargeError) {
        return reply.status(400).send(error(400, e.message))
      }
      req.log.error(e)
      return reply.status(500).send(error(500, '文件入库失败'))
    }
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
