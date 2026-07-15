/**
 * LangChain API 兼容路由(迁移自 coze_zhs_py/api/langchain_api.py + langchain_api_mini.py)。
 *
 * 为旧 LangChain 客户端提供兼容入口,内部转发到 routes/chat.ts 与 routes/agents.ts
 * 所使用的同一套 AI 厂商调用层(ai-vendors/_shared.ts 的 callVendor)。
 *
 * 注册(server.ts):
 *   server.register(legacyLangchainRoutes, { prefix: '/api/langchain' })
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { success, error } from '../utils/response.js'
import {
  requireAuth,
  callVendor,
  recordUsage,
} from './ai-vendors/_shared.js'

const chatSchema = z.object({
  messages: z.array(z.unknown()).min(1),
  model: z.string().optional(),
  temperature: z.number().optional(),
  stream: z.boolean().optional(),
})

const agentSchema = z.object({
  input: z.string().min(1),
  agent: z.string().optional(),
  model: z.string().optional(),
})

interface LangChainChoice {
  message: { role: string; content: string }
  finish_reason: string
  index: number
}

function toLangChainChat(data: unknown): { choices: LangChainChoice[] } {
  const obj = (data ?? {}) as Record<string, unknown>
  const choices = Array.isArray(obj.choices) ? (obj.choices as LangChainChoice[]) : []
  if (choices.length === 0) {
    choices.push({
      message: { role: 'assistant', content: String((obj as { content?: unknown }).content ?? '') },
      finish_reason: 'stop',
      index: 0,
    })
  }
  return { choices }
}

export const legacyLangchainRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAuth(request, reply))) return
  })

  // POST /chat — 兼容旧 LangChain chat 接口(转发到 dashscope chat completions)
  server.post('/chat', async (request, reply) => {
    const body = chatSchema.parse(request.body)
    if (body.stream) {
      return reply.status(400).send(error(400, '兼容接口暂不支持 stream,请使用 /api/chat/coze/stream'))
    }
    const data = await callVendor(
      'dashscope',
      'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
      reply,
      {
        method: 'POST',
        body: JSON.stringify({
          messages: body.messages,
          model: body.model ?? 'qwen-plus',
          ...(body.temperature !== undefined ? { temperature: body.temperature } : {}),
        }),
      },
    )
    if (data === null) return
    recordUsage(request.userId!, 'dashscope')
    return reply.send(success(toLangChainChat(data)))
  })

  // POST /agent — 兼容旧 LangChain agent 接口(转发到 dashscope agent generation)
  server.post('/agent', async (request, reply) => {
    const body = agentSchema.parse(request.body)
    const data = await callVendor(
      'dashscope',
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/agents/generation',
      reply,
      {
        method: 'POST',
        body: JSON.stringify({
          agentId: body.agent ?? 'default',
          messages: [{ role: 'user', content: body.input }],
          ...(body.model ? { model: body.model } : {}),
        }),
      },
    )
    if (data === null) return
    recordUsage(request.userId!, 'dashscope')
    const obj = (data ?? {}) as Record<string, unknown>
    const output = (obj.output as Record<string, unknown> | undefined) ?? {}
    return reply.send(
      success({
        output:
          (output.text as string | undefined) ??
          (output.content as string | undefined) ??
          JSON.stringify(data),
        intermediate_steps: [],
        agent: body.agent ?? 'default',
      }),
    )
  })

  // GET /models — 兼容旧模型列表(转发到 dashscope models)
  server.get('/models', async (_request, reply) => {
    const data = await callVendor(
      'dashscope',
      'https://dashscope.aliyuncs.com/compatible-mode/v1/models',
      reply,
      { method: 'GET' },
    )
    if (data === null) return
    const obj = (data ?? {}) as Record<string, unknown>
    const models = Array.isArray(obj.data)
      ? (obj.data as Array<Record<string, unknown>>).map((m) => ({
          id: m.id ?? m.name,
          object: 'model',
          owned_by: m.owned_by ?? 'dashscope',
        }))
      : []
    return reply.send(success({ object: 'list', data: models }))
  })
}
