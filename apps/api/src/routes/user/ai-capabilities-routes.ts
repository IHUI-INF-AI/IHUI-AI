// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * /api/v1/ai/capabilities 2 端点(CLI capabilities 命令配套)。
 * 能力来源:合并 aiModelConfig + 写死 6 个基础能力(chat/translate/summarize/...)。
 * 注:GET list + GET categories 已由 frontend-stub-other-routes.ts 注册,此处仅 POST invoke + POST auto-match。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { success, error } from '../../utils/response.js'
import { callRealLlm } from '../../services/crew-llm-adapter.js'
import { AppError } from '../../errors/AppError.js'
import { AiServiceTimeoutError } from '../../utils/ai-service-fetch.js'

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
    // F-97:身份与计费上下文必须随调用进入 LLM 层。缺 userId 一律拒绝,
    // 绝不静默回落成系统票(成本记在系统身份、无用户配额/计费)。
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, 'Authentication required'))
    try {
      const llmResult = await callRealLlm({
        messages: [
          { role: 'system', content: `你是「${cap.name}」能力。${cap.description}` },
          { role: 'user', content: body.data.input },
        ],
        // 透传调用者 request(aiServiceFetch 转发其 Authorization)+ 按 userId 预检/结算/记账
        userId,
        request,
      })
      const content = llmResult.content.trim()
      if (!content) {
        // 上游 200 但正文为空:同样是失败,不得用入参或合成文案冒充成功
        request.log.warn(
          { capabilityId: cap.id, model: llmResult.modelUsed },
          'ai capability invoke 上游返回空内容',
        )
        return reply.status(502).send(error(502, 'AI 服务返回内容为空,请稍后重试'))
      }
      return reply.send(
        success({
          success: true,
          capability_id: cap.id,
          result: content,
          model: llmResult.modelUsed,
          stub: llmResult.stub,
        }),
      )
    } catch (e) {
      if (e instanceof AiServiceTimeoutError) {
        request.log.error({ err: e, capabilityId: cap.id }, 'ai capability invoke 上游超时')
        return reply.status(504).send(error(504, 'AI 服务响应超时,请稍后重试'))
      }
      if (e instanceof AppError) {
        request.log.warn(
          { capabilityId: cap.id, statusCode: e.statusCode },
          'ai capability invoke 被拒',
        )
        return reply.status(e.statusCode).send(error(e.statusCode, e.message, e.errorCode))
      }
      request.log.error({ err: e, capabilityId: cap.id }, 'ai capability invoke LLM 调用失败')
      return reply.status(502).send(error(502, 'AI 服务调用失败,请稍后重试'))
    }
  })

  server.post('/v1/ai/capabilities/auto-match', async (request, reply) => {
    const body = z.object({ input: z.string().min(1).max(2000) }).safeParse(request.body ?? {})
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
