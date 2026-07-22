/**
 * 代码库语义搜索路由。
 *
 * 端点(注册前缀 /api/v1/codebase):
 * - POST /search          语义搜索代码片段(query → embedding → pgvector ANN)
 * - GET  /stats           索引统计(切片数 / 文件数 / 已向量化数)
 * - POST /index           批量索引切片(由 ai-service codebase_indexer 调用)
 * - DELETE /repo/:repoId  删除指定仓库的所有切片
 *
 * 鉴权:JWT 认证(复用 packages/auth,所有端点需登录)
 */

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { success, error } from '../utils/response.js'
import { authenticate } from '../plugins/auth.js'
import { codebaseIndexService } from '../services/codebase-index-service.js'
import type { ChunkInput } from '../services/codebase-index-service.js'

const searchSchema = z.object({
  query: z.string().min(1),
  repoId: z.string().optional(),
  language: z.string().optional(),
  topK: z.number().int().min(1).max(50).default(10),
  scoreThreshold: z.number().min(0).max(1).default(0),
})

const indexSchema = z.object({
  repoId: z.string().min(1),
  chunks: z
    .array(
      z.object({
        filePath: z.string().min(1),
        lineStart: z.number().int().min(1),
        lineEnd: z.number().int().min(1),
        content: z.string().min(1),
        language: z.string().optional(),
        symbolName: z.string().optional(),
        symbolType: z.string().optional(),
        embedding: z.array(z.number()).nullable().optional(),
      }),
    )
    .min(1)
    .max(1000),
})

export const codebaseSearchRoutes: FastifyPluginAsync = async (server) => {
  // 所有端点需 JWT 认证
  server.addHook('preHandler', async (req, reply) => {
    try {
      await authenticate(req)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      const message = (e as Error).message || 'Authentication required'
      return reply.status(statusCode).send(error(statusCode, message))
    }
  })

  // POST /search - 语义搜索代码片段
  server.post('/search', async (req, reply) => {
    const parsed = searchSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const b = parsed.data
    try {
      const chunks = await codebaseIndexService.search({
        query: b.query,
        repoId: b.repoId,
        language: b.language,
        topK: b.topK,
        scoreThreshold: b.scoreThreshold,
      })
      return reply.send(success({ chunks }))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '语义搜索失败'))
    }
  })

  // GET /stats - 索引统计
  server.get('/stats', async (req, reply) => {
    const q = (req.query as { repoId?: string }) ?? {}
    try {
      const stats = await codebaseIndexService.getStats(q.repoId)
      return reply.send(success(stats))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '统计查询失败'))
    }
  })

  // POST /index - 批量索引切片(由 ai-service codebase_indexer 调用)
  server.post('/index', async (req, reply) => {
    const parsed = indexSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const b = parsed.data
    try {
      const result = await codebaseIndexService.indexChunks(
        b.repoId,
        b.chunks as ChunkInput[],
      )
      return reply.send(success(result))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '索引失败'))
    }
  })

  // DELETE /repo/:repoId - 删除指定仓库的所有切片
  server.delete('/repo/:repoId', async (req, reply) => {
    const repoId = (req.params as { repoId: string }).repoId
    if (!repoId) {
      return reply.status(400).send(error(400, 'repoId 不能为空'))
    }
    try {
      const deleted = await codebaseIndexService.deleteByRepo(repoId)
      return reply.send(success({ deleted }))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '删除失败'))
    }
  })
}
