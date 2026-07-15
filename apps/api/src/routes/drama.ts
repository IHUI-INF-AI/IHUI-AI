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
    const { id } = z.object({ id: z.string() }).parse(request.params)
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
      const { id, sceneIndex, lineIndex } = z
        .object({ id: z.string(), sceneIndex: z.string(), lineIndex: z.string() })
        .parse(request.params)
      const parsed = enhanceLineBodySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { content, instruction } = parsed.data

      let rewritten: string
      const aiServiceUrl = process.env.AI_SERVICE_URL
      if (aiServiceUrl) {
        try {
          const prompt = instruction
            ? `改写以下剧本对白,要求:${instruction}。只返回改写后的对白文本,不要解释。\n\n原文:${content}`
            : `优化以下剧本对白,使其更自然生动。只返回改写后的对白文本,不要解释。\n\n原文:${content}`
          const llmResp = await fetch(`${aiServiceUrl}/api/llm/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: [{ role: 'user', content: prompt }],
              metadata: { source: 'drama-enhance-line', scriptId: id, sceneIndex, lineIndex },
            }),
          })
          if (llmResp.ok) {
            const llmData = (await llmResp.json().catch(() => ({}))) as {
              content?: string
              result?: string
            }
            const llmText = (llmData.content ?? llmData.result ?? '').trim()
            rewritten = llmText || content
          } else {
            request.log.warn(
              { status: llmResp.status },
              'drama enhanceLine LLM 调用失败,降级为原文',
            )
            rewritten = content
          }
        } catch (e) {
          request.log.warn({ err: e }, 'drama enhanceLine LLM 异常,降级为原文')
          rewritten = content
        }
      } else {
        rewritten = content
      }

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
