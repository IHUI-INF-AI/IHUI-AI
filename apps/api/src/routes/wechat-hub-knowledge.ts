// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 微信智联知识库与群发路由。
 * 知识库按账号 collection 隔离；群发逐条走 manager.send，不绕过出站策略。
 */

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { checkAuth } from '../plugins/auth.js'
import { AppError } from '../errors/AppError.js'
import { parseOrThrow, success } from '../utils/response.js'
import { broadcast } from '../services/wechat-hub/broadcast.js'
import {
  deleteKnowledge,
  ingestKnowledge,
  listKnowledgeDocs,
  searchKnowledge,
} from '../services/wechat-hub/knowledge.js'
import { answerError, requireUserId } from './wechat-hub-route-utils.js'

const knowledgeIngestSchema = z.object({
  title: z.string().min(1).max(200),
  text: z.string().min(1).max(200_000),
})

const knowledgeSearchSchema = z.object({
  query: z.string().min(1).max(500),
  topK: z.coerce.number().int().min(1).max(20).optional(),
})

const broadcastSchema = z.object({
  kind: z.enum(['text', 'image', 'file', 'link', 'card']).optional(),
  text: z.string().max(5000).optional(),
  mediaUrl: z.string().url().max(2048).optional(),
  targets: z.array(z.string().min(1).max(255)).max(100).optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).optional(),
  includeBlocked: z.boolean().optional(),
  batchSize: z.coerce.number().int().min(1).max(50).optional(),
  dryRun: z.boolean().optional(),
})

export const wechatHubKnowledgeRoutes: FastifyPluginAsync = async (server) => {
  server.get<{ Params: { id: string } }>(
    '/wechat-hub/accounts/:id/knowledge',
    async (request, reply) => {
      if (!(await checkAuth(request, reply))) return
      try {
        return reply.send(
          success(await listKnowledgeDocs(requireUserId(request), request.params.id)),
        )
      } catch (e) {
        return answerError(reply, e)
      }
    },
  )

  server.post<{ Params: { id: string } }>(
    '/wechat-hub/accounts/:id/knowledge',
    async (request, reply) => {
      if (!(await checkAuth(request, reply))) return
      try {
        const input = parseOrThrow(knowledgeIngestSchema, request.body)
        return reply
          .status(201)
          .send(
            success(
              await ingestKnowledge(
                requireUserId(request),
                request.params.id,
                input.title,
                input.text,
              ),
            ),
          )
      } catch (e) {
        return answerError(reply, e)
      }
    },
  )

  server.post<{ Params: { id: string } }>(
    '/wechat-hub/accounts/:id/knowledge/search',
    async (request, reply) => {
      if (!(await checkAuth(request, reply))) return
      try {
        const input = parseOrThrow(knowledgeSearchSchema, request.body)
        return reply.send(
          success(
            await searchKnowledge(
              requireUserId(request),
              request.params.id,
              input.query,
              input.topK ?? 5,
            ),
          ),
        )
      } catch (e) {
        return answerError(reply, e)
      }
    },
  )

  server.delete<{ Params: { id: string; docId: string } }>(
    '/wechat-hub/accounts/:id/knowledge/:docId',
    async (request, reply) => {
      if (!(await checkAuth(request, reply))) return
      try {
        const docId = Number(request.params.docId)
        if (!Number.isSafeInteger(docId) || docId <= 0) {
          throw new AppError('docId 非法', 400, 'WECHAT_KNOWLEDGE_DOC_INVALID')
        }
        return reply.send(
          success(await deleteKnowledge(requireUserId(request), request.params.id, docId)),
        )
      } catch (e) {
        return answerError(reply, e)
      }
    },
  )

  server.post<{ Params: { id: string } }>(
    '/wechat-hub/accounts/:id/broadcast',
    async (request, reply) => {
      if (!(await checkAuth(request, reply))) return
      try {
        const input = parseOrThrow(broadcastSchema, request.body)
        return reply.send(
          success(
            await broadcast(requireUserId(request), {
              accountId: request.params.id,
              ...input,
            }),
          ),
        )
      } catch (e) {
        return answerError(reply, e)
      }
    },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
