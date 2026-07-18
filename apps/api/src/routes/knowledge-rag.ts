/**
 * 知识库 RAG 路由。
 * 迁移自 v1.0.2-sealed: server/app/api/v1/knowledge/__init__.py
 *
 * 端点(注册前缀 /api/knowledge):
 * - GET  /health                健康检查
 * - POST /ingest                纯文本入库 (返回切片数)
 * - POST /search                语义检索
 * - POST /rag-context           生成 RAG 上下文文本
 * - GET  /docs                  文档列表
 * - GET  /docs/:id              文档详情
 * - GET  /docs/:id/chunks       文档切片预览
 * - DELETE /docs/:id            软删除文档
 * - POST /docs/batch-delete     批量删除
 */

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { success, error } from '../utils/response.js'
import { knowledgeRagService } from '../services/knowledge-rag-service.js'

const ingestSchema = z.object({
  ownerUuid: z.string().min(1),
  title: z.string().min(1),
  text: z.string().min(1),
  collectionName: z.string().default('default'),
})

const searchSchema = z.object({
  query: z.string().min(1),
  collectionName: z.string().default('default'),
  topK: z.number().int().min(1).max(50).default(5),
  scoreThreshold: z.number().min(0).max(1).default(0),
  ownerUuid: z.string().default(''),
})

const ragContextSchema = z.object({
  query: z.string().min(1),
  collectionName: z.string().default('default'),
  topK: z.number().int().min(1).max(50).default(5),
  ownerUuid: z.string().default(''),
})

const batchDeleteSchema = z.object({
  docIds: z.array(z.number().int().positive()),
  ownerUuid: z.string().min(1),
})

function resolveOwner(authUserId: string | undefined, paramOwner: string): string {
  if (authUserId) return authUserId
  if (!paramOwner) throw new Error('owner_uuid 不能为空 (或未登录)')
  return paramOwner
}

export const knowledgeRagRoutes: FastifyPluginAsync = async (server) => {
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
    const authUser = (req.user as { userId?: string } | undefined)?.userId
    const owner = resolveOwner(authUser, b.ownerUuid)
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
    const authUser = (req.user as { userId?: string } | undefined)?.userId
    const owner = resolveOwner(authUser, b.ownerUuid)
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
    const authUser = (req.user as { userId?: string } | undefined)?.userId
    const owner = resolveOwner(authUser, b.ownerUuid)
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
    const q = (req.query as { ownerUuid?: string }) ?? {}
    const authUser = (req.user as { userId?: string } | undefined)?.userId
    const owner = resolveOwner(authUser, q.ownerUuid ?? '')
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
    const q = (req.query as { ownerUuid?: string }) ?? {}
    const authUser = (req.user as { userId?: string } | undefined)?.userId
    const owner = resolveOwner(authUser, q.ownerUuid ?? '')
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
    const q = (req.query as { ownerUuid?: string; limit?: string }) ?? {}
    const limit = q.limit ? Math.max(1, Math.min(100, Number(q.limit))) : 10
    const authUser = (req.user as { userId?: string } | undefined)?.userId
    const owner = resolveOwner(authUser, q.ownerUuid ?? '')
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
    const q = (req.query as { ownerUuid?: string }) ?? {}
    const authUser = (req.user as { userId?: string } | undefined)?.userId
    const owner = resolveOwner(authUser, q.ownerUuid ?? '')
    try {
      const ok = await knowledgeRagService.deleteDoc(id, owner)
      if (!ok) return reply.status(404).send(error(404, '文档不存在或已删除'))
      return reply.send(success({ deleted: true }))
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
    const authUser = (req.user as { userId?: string } | undefined)?.userId
    const owner = resolveOwner(authUser, b.ownerUuid)
    try {
      const result = await knowledgeRagService.batchDeleteDocs(b.docIds, owner)
      return reply.send(success(result))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '批量删除失败'))
    }
  })
}
