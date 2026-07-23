/**
 * 知识库 /knowledge/*(8 个端点:3 个公开 GET + 1 个 like + 4 个 CRUD)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { success, error } from '../../utils/response.js'
import {
  findPublishedKnowledge,
  findKnowledgeById,
  createKnowledge,
  updateKnowledge,
  deleteKnowledge,
} from '../../db/knowledge-queries.js'
import { toggleLike } from '../../db/resource-likes-queries.js'
import { parsePagination, parseIdParam } from './_shared.js'

const knowledgeRoutes: FastifyPluginAsync = async (server) => {
  server.get('/knowledge', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const result = await findPublishedKnowledge({
      page: q.page,
      pageSize: q.pageSize,
      search: q.search,
    })
    return reply.send(
      success({
        list: result.list,
        total: result.total,
        page: q.page,
        pageSize: q.pageSize,
      }),
    )
  })

  server.get('/knowledge/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const knowledge = await findKnowledgeById(id)
    if (!knowledge) return reply.status(404).send(error(404, '知识库不存在'))
    return reply.send(success({ knowledge }))
  })

  server.post('/knowledge/:id/like', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const result = await toggleLike('knowledge', id, request.userId!)
    return reply.send(success({ success: true, liked: result.liked }))
  })

  server.post('/knowledge', async (request, reply) => {
    const body = z
      .object({
        title: z.string().min(1),
        content: z.string().min(1),
        summary: z.string().optional(),
        coverImage: z.string().optional(),
        categoryId: z.string().optional(),
        isPublished: z.boolean().optional(),
      })
      .safeParse(request.body)
    if (!body.success) return reply.status(400).send(error(400, '标题和内容不能为空'))
    const knowledge = await createKnowledge({
      title: body.data.title,
      content: body.data.content,
      summary: body.data.summary,
      coverImage: body.data.coverImage,
      categoryId: body.data.categoryId,
      authorId: request.userId,
      isPublished: body.data.isPublished ?? false,
    })
    return reply.status(201).send(success({ id: knowledge.id, knowledge }))
  })

  server.put('/knowledge/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const body = z
      .object({
        title: z.string().optional(),
        content: z.string().optional(),
        summary: z.string().optional(),
        coverImage: z.string().optional(),
        categoryId: z.string().optional(),
        isPublished: z.boolean().optional(),
      })
      .safeParse(request.body)
    if (!body.success) return reply.status(400).send(error(400, '参数错误'))
    const knowledge = await updateKnowledge(id, body.data)
    if (!knowledge) return reply.status(404).send(error(404, '知识库不存在'))
    return reply.send(success({ success: true, knowledge }))
  })

  server.delete('/knowledge/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    await deleteKnowledge(id)
    return reply.send(success({ success: true }))
  })
}

export default knowledgeRoutes
