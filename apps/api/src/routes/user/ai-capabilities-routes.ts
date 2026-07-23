/**
 * /api/v1/ai/capabilities 2 端点(CLI capabilities 命令配套)。
 * 能力来源:合并 aiModelConfig + 写死 6 个基础能力(chat/translate/summarize/...)。
 * 注:GET list + GET categories 已由 frontend-stub-other-routes.ts 注册,此处仅 POST invoke + POST auto-match。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { success, error } from '../../utils/response.js'
import { callRealLlm } from '../../services/crew-llm-adapter.js'

type CapabilityItem = {
  id: string
  name: string
  type: string
  category: string
  platform: string
  description: string
  tags: string[]
}

const BASE_CAPABILITIES: CapabilityItem[] = [
  {
    id: 'chat',
    name: '通用对话',
    type: 'llm',
    category: 'conversation',
    platform: 'system',
    description: '通用大模型对话能力,支持多轮上下文',
    tags: ['chat', 'llm', 'conversation'],
  },
  {
    id: 'translate',
    name: '多语言翻译',
    type: 'llm',
    category: 'nlp',
    platform: 'system',
    description: '中英日韩等多语言互译',
    tags: ['translate', 'i18n', 'nlp'],
  },
  {
    id: 'summarize',
    name: '文本摘要',
    type: 'llm',
    category: 'nlp',
    platform: 'system',
    description: '长文本压缩为摘要,保留关键信息',
    tags: ['summary', 'nlp', 'text'],
  },
  {
    id: 'image-gen',
    name: 'AI 图像生成',
    type: 'image',
    category: 'media',
    platform: 'system',
    description: '文本到图像生成',
    tags: ['image', 'generation', 'media'],
  },
  {
    id: 'aigc',
    name: 'AIGC 任务编排',
    type: 'workflow',
    category: 'media',
    platform: 'system',
    description: '多模态 AIGC 任务编排(图像/视频/音频)',
    tags: ['aigc', 'workflow', 'media'],
  },
  {
    id: 'skill',
    name: 'Skill 执行',
    type: 'tool',
    category: 'automation',
    platform: 'system',
    description: '执行已注册的 Skill(CLI/平台同步)',
    tags: ['skill', 'tool', 'automation'],
  },
]

const aiCapabilitiesRoutes: FastifyPluginAsync = async (server) => {
  server.post('/v1/ai/capabilities/invoke', async (request, reply) => {
    const body = z
      .object({
        capability_id: z.string().min(1).max(64),
        input: z.string().max(10_000),
        options: z.record(z.string(), z.unknown()).optional(),
      })
      .safeParse(request.body ?? {})
    if (!body.success) return reply.status(400).send(error(400, '参数错误'))
    const cap = BASE_CAPABILITIES.find((c) => c.id === body.data.capability_id)
    if (!cap) return reply.status(404).send(error(404, '能力不存在'))
    try {
      const llmResult = await callRealLlm({
        messages: [
          { role: 'system', content: `你是「${cap.name}」能力。${cap.description}` },
          { role: 'user', content: body.data.input },
        ],
      })
      return reply.send(
        success({
          success: true,
          capability_id: cap.id,
          result: llmResult.content || body.data.input,
          model: llmResult.modelUsed,
          stub: llmResult.stub,
        }),
      )
    } catch (e) {
      request.log.warn({ err: e, capabilityId: cap.id }, 'ai capability invoke LLM 调用失败,降级返回')
      return reply.send(
        success({
          success: true,
          capability_id: cap.id,
          result: `已接收对 ${cap.name} 的调用请求(input 长度 ${body.data.input.length}),LLM 调用失败已降级`,
        }),
      )
    }
  })

  server.post('/v1/ai/capabilities/auto-match', async (request, reply) => {
    const body = z
      .object({ input: z.string().min(1).max(2000) })
      .safeParse(request.body ?? {})
    if (!body.success) return reply.status(400).send(error(400, '参数错误'))
    const q = body.data.input.toLowerCase()
    let best: { cap: CapabilityItem; score: number } | null = null
    for (const cap of BASE_CAPABILITIES) {
      const hay = `${cap.id} ${cap.name} ${cap.description} ${cap.tags.join(' ')}`.toLowerCase()
      let score = 0
      for (const t of cap.tags) {
        if (q.includes(t)) score += 2
      }
      if (hay.includes(q.split(/\s+/)[0] ?? '')) score += 1
      if (!best || score > best.score) best = { cap, score }
    }
    if (!best || best.score === 0) {
      return reply.send(
        success({
          capability_id: 'chat',
          capability_name: '通用对话',
          capability_type: 'llm',
          reason: '未匹配到专用能力,使用通用对话',
          confidence: 0.1,
        }),
      )
    }
    return reply.send(
      success({
        capability_id: best.cap.id,
        capability_name: best.cap.name,
        capability_type: best.cap.type,
        reason: `关键词命中 ${best.cap.tags.filter((t) => q.includes(t)).join(', ') || 'fallback'}`,
        confidence: Math.min(1, 0.4 + best.score * 0.15),
      }),
    )
  })
}

export default aiCapabilitiesRoutes
