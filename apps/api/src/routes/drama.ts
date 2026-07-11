import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../plugins/auth.js'
import { success, error, emptyToUndefined } from '../utils/response.js'
import {
  createStory,
  checkConsistency,
  analyzePacing,
  suggestChapterOutline,
} from '../services/ai/plot-advisor-service.js'

const enhanceBodySchema = z.object({
  title: z.preprocess(emptyToUndefined, z.string().optional()),
})

const enhanceLineBodySchema = z.object({
  content: z.string().min(1).max(5000),
  instruction: z.preprocess(emptyToUndefined, z.string().optional()),
})

export const dramaRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request, reply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      return reply
        .status(statusCode)
        .send(error(statusCode, (e as Error).message || 'Authentication required'))
    }
  })

  // POST /drama/scripts/:id/enhance — 整体增强（角色一致性 + 节奏分析 + 章节大纲建议）
  server.post('/drama/scripts/:id/enhance', async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = enhanceBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const title = parsed.data.title ?? `剧本 ${id}`
    createStory(id, title)
    const consistency = checkConsistency(id)
    const pacing = analyzePacing(id)
    const outline = suggestChapterOutline(id, 1)
    return reply.send(success({ consistency, pacing, outline }))
  })

  // POST /drama/scripts/:id/scenes/:sceneIndex/lines/:lineIndex/enhance — 单行改写
  server.post(
    '/drama/scripts/:id/scenes/:sceneIndex/lines/:lineIndex/enhance',
    async (request, reply) => {
      const { sceneIndex, lineIndex } = request.params as { sceneIndex: string; lineIndex: string }
      const parsed = enhanceLineBodySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { content, instruction } = parsed.data
      const rewritten = instruction
        ? `[场景${sceneIndex}/行${lineIndex}] ${instruction}: ${content}`
        : `[场景${sceneIndex}/行${lineIndex}] 优化: ${content}`
      return reply.send(
        success({
          original: content,
          rewritten,
          sceneIndex: Number(sceneIndex),
          lineIndex: Number(lineIndex),
        }),
      )
    },
  )
}
