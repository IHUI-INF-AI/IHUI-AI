// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
import { requireAuth, callVendor, recordUsage } from './ai-vendors/_shared.js'
// F-514:平台 DashScope 密钥调用必须与 proxy-llm 同口径,过钱包闸并按 usage 扣分
import { ensurePointsBalance, chargePointsForCall } from './ai-vendors/proxy-llm.js'

const chatSchema = z.object({
  messages: z.array(z.unknown()).min(1).max(100),
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

/**
 * DashScope 应用(agents/generation)的 usage 是 {models:[{input_tokens,output_tokens}]},
 * 与 OpenAI usage 形状不同;归一一层后再交给同口径的 chargePointsForCall,避免恒跳过计费。
 */
function toBillingUsage(data: unknown): unknown {
  const obj = (data ?? {}) as Record<string, unknown>
  const usage = obj.usage as { models?: unknown } | undefined
  const models = usage?.models
  if (!Array.isArray(models) || models.length === 0) return data
  let promptTokens = 0
  let completionTokens = 0
  for (const raw of models) {
    const item = (raw ?? {}) as Record<string, unknown>
    if (typeof item.input_tokens === 'number') promptTokens += item.input_tokens
    if (typeof item.output_tokens === 'number') completionTokens += item.output_tokens
  }
  if (promptTokens + completionTokens <= 0) return data
  return { ...obj, usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens } }
}

export const legacyLangchainRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAuth(request, reply))) return
  })

  // POST /chat — 兼容旧 LangChain chat 接口(转发到 dashscope chat completions)
  server.post('/chat', async (request, reply) => {
    const body = chatSchema.parse(request.body)
    if (body.stream) {
      return reply
        .status(400)
        .send(error(400, '兼容接口暂不支持 stream,请使用 /api/chat/coze/stream'))
    }
    const model = body.model ?? 'qwen-plus'
    if (!(await ensurePointsBalance(request, reply, model))) return
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
    await chargePointsForCall(request, model, data, request.id)
    return reply.send(success(toLangChainChat(data)))
  })

  // POST /agent — 兼容旧 LangChain agent 接口(转发到 dashscope agent generation)
  server.post('/agent', async (request, reply) => {
    const body = agentSchema.parse(request.body)
    // 智能体应用无独立 model 字段时以 agent id 作为计费档位标识(未命中关键词即 1x)
    const billingModel = body.model ?? body.agent ?? 'dashscope-agent'
    if (!(await ensurePointsBalance(request, reply, billingModel))) return
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
    await chargePointsForCall(request, billingModel, toBillingUsage(data), request.id)
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
