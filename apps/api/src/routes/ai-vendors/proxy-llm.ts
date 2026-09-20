// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * LLM 代理子路由:Dashscope(10 端点)+ Doubao(9 端点)+ Gemini(8 端点)+ aiVendorV2Routes(新签名样板)。
 */
import { z } from 'zod'
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { success, error } from '../../utils/response.js'
import { buildSchema } from '../../utils/swagger.js'
import { callVendor as newCallVendor } from '../../services/vendor-caller-service.js'
import {
  requireAuth,
  callVendor,
  recordUsage,
  createTask,
  chatBody,
  imageBody,
  ttsBody,
  asrBody,
  promptModelBody,
  textModelBody,
  multimodalBody,
} from './_shared.js'
import { spendPoints } from '../../services/points-service.js'
import { findUserPoints } from '../../db/gamification-queries.js'

const dashscopeImageEditBody = z.object({
  prompt: z.string().optional(),
  imageUrl: z.string().optional(),
})

const dashscopeAgentBody = z.object({
  agentId: z.string().optional(),
  messages: z.array(z.unknown()).max(100).optional(),
})

// Agnes 文生图:官方推荐 size 档位(1K/2K/3K/4K) + ratio 宽高比(1:1/16:9/9:16 等) + n 出图数量
const agnesImageBody = z.object({
  prompt: z.string().optional(),
  model: z.string().optional(),
  size: z.string().optional(),
  ratio: z.string().optional(),
  n: z.number().int().min(1).max(10).optional(),
})

// 极速 API 生图:OpenAI images 协议(gpt-image-2 系列,返回 b64_json 内联,2026-09-20 实测)
const x5m5xImageBody = z.object({
  prompt: z.string().optional(),
  model: z.string().optional(),
  size: z.string().optional(),
  n: z.number().optional(),
})

const doubaoImageEditBody = z.object({
  prompt: z.string().optional(),
  image: z.string().optional(),
  model: z.string().optional(),
  size: z.string().optional(),
  strength: z.number().optional(),
})

/** 根据 model_id 推断积分消耗倍数(5 档梯度:0x 免费 / 1x 经济 / 3x 标准 / 10x 高级 / 30x 旗舰) */
export function inferPointsMultiplier(modelId: string): number {
  const mid = (modelId || '').toLowerCase()
  // 智汇AI 官方中转模型(ihui/ 前缀):付费模型,按档位映射积分倍数
  const IHUI_POINTS_MAP: Record<string, number> = {
    // 倍率 = 极速扣费比例 × 3(统一利润系数),2026-08-31 按官方套餐扣费比例重配
    'ihui/auto-model': 3, // 极速扣费 1:1
    'ihui/minimax-m2.7': 6, // 极速扣费 1:2
    'ihui/minimax-m2.7-highspeed': 15, // 极速扣费 1:5
    'ihui/minimax-m3': 15, // 极速扣费 1:5
    'ihui/deepseek-v4-flash-0731': 15, // 极速扣费 1:5
    'ihui/glm-5.1': 18, // 极速扣费 1:6
    'ihui/glm-5.2': 18, // 极速扣费 1:6
    'ihui/glm-5.3-flash': 18, // 极速扣费 1:6
    'ihui/kimi-k2.6': 18, // 极速扣费 1:6
    'ihui/deepseek-v4-pro': 18, // 极速扣费 1:6
    'ihui/deepseek-v4-pro-0813': 18, // 极速扣费 1:6
    'ihui/grok-4.5': 18, // 极速扣费 1:6(未列套餐,按次旗舰估)
    'ihui/glm-5.3': 30, // 极速扣费 1:10
    'ihui/gpt-5.6': 30, // 极速扣费 1:10
    'ihui/grok-4.6': 30, // 极速扣费 1:10
    'ihui/qwen3.7-max': 30, // 极速扣费 1:10
    'ihui/kimi-k2.7-code': 30, // 极速扣费 1:10
  }
  if (IHUI_POINTS_MAP[mid] !== undefined) return IHUI_POINTS_MAP[mid]
  // 优先 mini/nano/haiku(避免 gpt-4o-mini 被标准层 gpt-4o 遮蔽,o1-mini 被 o1 遮蔽)
  if (['mini', 'nano', 'haiku'].some((k) => mid.includes(k))) return 1
  // 旗舰(30x)
  if (['opus', 'thinking', 'o1-preview', 'o1', 'o3', 'gpt-5'].some((k) => mid.includes(k)))
    return 30
  // 高级(10x)
  if (
    [
      'gpt-4-turbo',
      'gpt-4.5',
      'claude-3-opus',
      'gemini-pro',
      'o1-mini',
      'o3-mini',
      'qwen-max-longcontext',
    ].some((k) => mid.includes(k))
  )
    return 10
  // 标准(3x)
  if (['sonnet', 'gpt-4o', 'gpt-4.1', 'deepseek', 'glm-4', 'qwen-max'].some((k) => mid.includes(k)))
    return 3
  // 经济(1x)
  if (['mini', 'flash', 'lite', 'nano', 'haiku'].some((k) => mid.includes(k))) return 1
  // 免费(0x)
  if (
    ['ollama', 'llama', 'llm7', 'pollinations', 'aihorde', 'opencode_zen'].some((k) =>
      mid.includes(k),
    )
  )
    return 0
  // 默认经济(1x)
  return 1
}

/** LLM token 用量(兼容 OpenAI usage 与 Gemini usageMetadata) */
interface TokenUsage {
  promptTokens: number
  completionTokens: number
}

/** 从 LLM 响应中安全提取 token 用量(unknown + 类型守卫,禁用 any) */
function extractTokenUsage(data: unknown): TokenUsage {
  if (typeof data !== 'object' || data === null) return { promptTokens: 0, completionTokens: 0 }
  const obj = data as Record<string, unknown>
  // OpenAI 兼容格式:usage.prompt_tokens / usage.completion_tokens
  const usage = obj.usage
  if (typeof usage === 'object' && usage !== null) {
    const u = usage as Record<string, unknown>
    return {
      promptTokens: typeof u.prompt_tokens === 'number' ? u.prompt_tokens : 0,
      completionTokens: typeof u.completion_tokens === 'number' ? u.completion_tokens : 0,
    }
  }
  // Gemini 格式:usageMetadata.promptTokenCount / candidatesTokenCount
  const meta = obj.usageMetadata
  if (typeof meta === 'object' && meta !== null) {
    const m = meta as Record<string, unknown>
    return {
      promptTokens: typeof m.promptTokenCount === 'number' ? m.promptTokenCount : 0,
      completionTokens: typeof m.candidatesTokenCount === 'number' ? m.candidatesTokenCount : 0,
    }
  }
  return { promptTokens: 0, completionTokens: 0 }
}

/**
 * 调用前余额检查:零成本模型(multiplier=0)豁免;余额<=0 返回 402 引导充值。
 * 返回 false 表示已响应,调用方需 return。
 */
async function ensurePointsBalance(
  request: FastifyRequest,
  reply: FastifyReply,
  modelId: string,
): Promise<boolean> {
  if (inferPointsMultiplier(modelId) === 0) return true // 零成本模型不校验余额
  const userId = request.userId
  if (!userId) return true // 未登录交由 requireAuth 处理
  const points = await findUserPoints(userId)
  const balance = points?.points ?? 0
  if (balance <= 0) {
    reply.status(402).send({
      code: 402,
      message: '积分不足,请充值或使用免费模型',
      data: { balance, free_models: ['ollama/*', 'llm7/*'] },
    })
    return false
  }
  return true
}

/**
 * 调用后按实际 token 数扣分:零成本豁免;无 token 信息跳过;扣分失败不阻塞响应。
 * 公式:扣分 = ceil((prompt+completion) / 1000 × multiplier × 1 积分基准),向上取整。
 */
async function chargePointsForCall(
  request: FastifyRequest,
  modelId: string,
  data: unknown,
  referenceId: string,
): Promise<void> {
  const multiplier = inferPointsMultiplier(modelId)
  if (multiplier === 0) return // 零成本模型不扣分
  const userId = request.userId
  if (!userId) return
  const { promptTokens, completionTokens } = extractTokenUsage(data)
  const totalTokens = promptTokens + completionTokens
  if (totalTokens <= 0) return // 无 token 用量信息,跳过避免误扣
  const amount = Math.ceil((totalTokens / 1000) * multiplier)
  if (amount <= 0) return
  try {
    await spendPoints(
      userId,
      amount,
      'ai_call',
      `LLM 调用扣分(model=${modelId}, tokens=${totalTokens}, multiplier=${multiplier})`,
      referenceId,
    )
  } catch {
    // 扣分失败不阻塞响应(已通过 pre-call 余额检查;并发竞态由 spendPoints 事务兜底)
  }
}

export const llmVendorRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.headers.upgrade === 'websocket') return
    if (!(await requireAuth(request, reply))) return
  })

  // 1. Dashscope(阿里通义)— 10 端点
  server.post(
    '/dashscope/chat',
    {
      schema: buildSchema({
        summary: '通义千问对话补全',
        description: '代理调用 Dashscope 兼容模式 chat/completions 接口',
        tags: ['AI', 'Dashscope'],
        body: chatBody,
      }),
    },
    async (request, reply) => {
      const body = chatBody.parse(request.body)
      if (!(await ensurePointsBalance(request, reply, body.model ?? ''))) return
      const data = await callVendor(
        'dashscope',
        'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
        reply,
        { method: 'POST', body: JSON.stringify(body) },
      )
      if (data === null) return
      recordUsage(request.userId!, 'dashscope')
      await chargePointsForCall(request, body.model ?? '', data, request.id)
      return reply.send(success(data))
    },
  )

  server.post(
    '/dashscope/image',
    {
      schema: buildSchema({
        summary: '通义万相文生图',
        description: '代理调用 Dashscope text2image/image-synthesis 异步文生图接口',
        tags: ['AI', 'Dashscope'],
        body: imageBody,
      }),
    },
    async (request, reply) => {
      const body = imageBody.parse(request.body)
      const data = await callVendor(
        'dashscope',
        'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis',
        reply,
        { method: 'POST', body: JSON.stringify(body) },
      )
      if (data === null) return
      const task = createTask(request.userId!, 'dashscope', 'image', data)
      recordUsage(request.userId!, 'dashscope')
      return reply.send(success({ taskId: task.taskId, status: task.status, raw: data }))
    },
  )

  server.post(
    '/agnes/chat',
    {
      schema: buildSchema({
        summary: 'Agnes AI 对话补全',
        description:
          '代理调用 Agnes /v1/chat/completions(OpenAI 协议),支持模型: ' +
          'agnes-2.5-flash(默认,快)/ agnes-2.5-pro(旗舰)/ agnes-2.0-flash / agnes-3.0-flash',
        tags: ['AI', 'Agnes'],
        body: chatBody,
      }),
    },
    async (request, reply) => {
      const body = chatBody.parse(request.body)
      if (!(await ensurePointsBalance(request, reply, body.model ?? ''))) return
      const data = await callVendor(
        'agnes',
        'https://apihub.agnes-ai.com/v1/chat/completions',
        reply,
        { method: 'POST', body: JSON.stringify(body) },
      )
      if (data === null) return
      recordUsage(request.userId!, 'agnes')
      await chargePointsForCall(request, body.model ?? '', data, request.id)
      return reply.send(success(data))
    },
  )

  server.post(
    '/agnes/image',
    {
      schema: buildSchema({
        summary: 'Agnes AI 文生图',
        description:
          '代理调用 Agnes /v1/images/generations 同步文生图接口(OpenAI images 协议),' +
          '支持模型: agnes-image-2.5-flash(最新,默认,2026-09-20 实测)/ agnes-image-2.1-flash / agnes-image-2.0-flash;' +
          'size 推荐 1K/2K/3K/4K 档位,配合 ratio(1:1/16:9/9:16/4:3/3:4/3:2/2:3/21:9)',
        tags: ['AI', 'Agnes'],
        body: agnesImageBody,
      }),
    },
    async (request, reply) => {
      const body = agnesImageBody.parse(request.body)
      // Agnes 同步出图约 40-50s,timeout 90s 防误断(与 ai-service 侧一致)
      const data = await callVendor(
        'agnes',
        'https://apihub.agnes-ai.com/v1/images/generations',
        reply,
        { method: 'POST', body: JSON.stringify(body) },
        90_000,
      )
      if (data === null) return
      // 部分上游失败时仍返回 200 + body.error,需检查
      const errObj = (data as { error?: { message?: string } | string }).error
      if (errObj) {
        const msg = typeof errObj === 'string' ? errObj : errObj.message || JSON.stringify(errObj)
        return reply.status(502).send(error(502, `Agnes 生图失败: ${msg.slice(0, 300)}`))
      }
      // 同步接口:任务创建后直接落终态 succeeded,前端复用 /tasks/:taskId 轮询模式
      const task = createTask(request.userId!, 'agnes', 'image', data)
      task.status = 'succeeded'
      recordUsage(request.userId!, 'agnes')
      return reply.send(success({ taskId: task.taskId, status: task.status, raw: data }))
    },
  )

  server.get(
    '/agnes/models',
    {
      schema: buildSchema({
        summary: 'Agnes AI 模型列表',
        description:
          '代理调用 Agnes /v1/models 接口动态获取官方全量模型(2026-09-20 实测 12 个:agnes-2.5 系列/agnes-image 系列/agnes-video 系列)',
        tags: ['AI', 'Agnes'],
      }),
    },
    async (_request, reply) => {
      const data = await callVendor('agnes', 'https://apihub.agnes-ai.com/v1/models', reply, {
        method: 'GET',
      })
      if (data === null) return
      return reply.send(success(data))
    },
  )

  // 极速 API(x5m5x 中转站)— 2 端点
  server.post(
    '/x5m5x/chat',
    {
      schema: buildSchema({
        summary: '极速 API 对话补全',
        description:
          '代理调用 x5m5x /v1/chat/completions(OpenAI 协议,按量 key),支持模型: ' +
          'deepseek-v4-flash-0731 / glm-5.3 / gpt-5.6 / gpt-5.5 / qwen3.8-flash / qwen3.8-max / ' +
          'grok-4.6 / claude-opus-5 / gemini-3.6 / kimi 等 41 个(2026-09-20 实测)',
        tags: ['AI', '极速API'],
        body: chatBody,
      }),
    },
    async (request, reply) => {
      const body = chatBody.parse(request.body)
      if (!(await ensurePointsBalance(request, reply, body.model ?? ''))) return
      const data = await callVendor('x5m5x', 'https://api.x5m5x.com/v1/chat/completions', reply, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      if (data === null) return
      recordUsage(request.userId!, 'x5m5x')
      await chargePointsForCall(request, body.model ?? '', data, request.id)
      return reply.send(success(data))
    },
  )

  server.get(
    '/x5m5x/models',
    {
      schema: buildSchema({
        summary: '极速 API 模型列表(按量 key)',
        description:
          '代理调用 x5m5x /v1/models 接口动态获取官方全量模型(2026-09-20 实测 41 个 LLM)',
        tags: ['AI', '极速API'],
      }),
    },
    async (_request, reply) => {
      const data = await callVendor('x5m5x', 'https://api.x5m5x.com/v1/models', reply, {
        method: 'GET',
      })
      if (data === null) return
      return reply.send(success(data))
    },
  )

  server.post(
    '/x5m5x/image',
    {
      schema: buildSchema({
        summary: '极速 API 文生图',
        description:
          '代理调用 x5m5x /v1/images/generations(OpenAI images 协议,生图 key),' +
          '支持模型: gpt-image-2(默认,2026-09-20 实测出图)/ gpt-image-2.5-flare / gpt-image-2.5-sunburst / gpt-image-2.5;' +
          '返回 b64_json 内联数据(非 URL),前端需转 data URI 展示',
        tags: ['AI', '极速API'],
        body: x5m5xImageBody,
      }),
    },
    async (request, reply) => {
      const body = x5m5xImageBody.parse(request.body)
      const payload = {
        prompt: body.prompt ?? '',
        model: body.model ?? 'gpt-image-2',
        size: body.size ?? '1024x1024',
        ...(body.n ? { n: body.n } : {}),
      }
      // 生图同步出图,timeout 120s 防误断(b64 内联数据传输较慢)
      const data = await callVendor(
        'x5m5xImage',
        'https://api.x5m5x.com/v1/images/generations',
        reply,
        { method: 'POST', body: JSON.stringify(payload) },
        120_000,
      )
      if (data === null) return
      // 部分上游失败时仍返回 200 + body.error,需检查
      const errObj = (data as { error?: { message?: string } | string }).error
      if (errObj) {
        const msg = typeof errObj === 'string' ? errObj : errObj.message || JSON.stringify(errObj)
        return reply.status(502).send(error(502, `极速 API 生图失败: ${msg.slice(0, 300)}`))
      }
      // 同步接口:任务创建后直接落终态 succeeded,前端复用 /tasks/:taskId 轮询模式
      const task = createTask(request.userId!, 'x5m5xImage', 'image', data)
      task.status = 'succeeded'
      recordUsage(request.userId!, 'x5m5xImage')
      return reply.send(success({ taskId: task.taskId, status: task.status, raw: data }))
    },
  )

  server.get(
    '/x5m5x-image/models',
    {
      schema: buildSchema({
        summary: '极速 API 模型列表(生图 key)',
        description:
          '代理调用 x5m5x /v1/models 接口(生图 key 鉴权)动态获取官方全量生图模型(gpt-image-2 系列)',
        tags: ['AI', '极速API'],
      }),
    },
    async (_request, reply) => {
      const data = await callVendor('x5m5xImage', 'https://api.x5m5x.com/v1/models', reply, {
        method: 'GET',
      })
      if (data === null) return
      return reply.send(success(data))
    },
  )

  // 极速 API 订阅 key — Auto-Model 专属端点
  server.post(
    '/x5m5x-subscribe/chat',
    {
      schema: buildSchema({
        summary: '极速 API 订阅 key 对话补全',
        description:
          '代理调用 x5m5x /v1/chat/completions(OpenAI 协议,订阅 key),专供 11 个 Auto-Model: ' +
          'glm-5.3 / deepseek-v4-flash-0731 / gpt-5.6 / grok-4.6 / glm-5.3-flash / MiniMax-M2.7 / ' +
          'qwen3.8-flash / qwen3.8-max / gpt-6-astra / deepseek-v4.1-flash / glm-5.3-flashx',
        tags: ['AI', '极速API'],
        body: chatBody,
      }),
    },
    async (request, reply) => {
      const body = chatBody.parse(request.body)
      if (!(await ensurePointsBalance(request, reply, body.model ?? ''))) return
      const data = await callVendor(
        'x5m5xSubscribe',
        'https://api.x5m5x.com/v1/chat/completions',
        reply,
        { method: 'POST', body: JSON.stringify(body) },
      )
      if (data === null) return
      recordUsage(request.userId!, 'x5m5xSubscribe')
      await chargePointsForCall(request, body.model ?? '', data, request.id)
      return reply.send(success(data))
    },
  )

  server.get(
    '/x5m5x-subscribe/models',
    {
      schema: buildSchema({
        summary: '极速 API 模型列表(订阅 key)',
        description:
          '代理调用 x5m5x /v1/models 接口(订阅 key 鉴权)动态获取官方全量模型(含 11 个 Auto-Model)',
        tags: ['AI', '极速API'],
      }),
    },
    async (_request, reply) => {
      const data = await callVendor('x5m5xSubscribe', 'https://api.x5m5x.com/v1/models', reply, {
        method: 'GET',
      })
      if (data === null) return
      return reply.send(success(data))
    },
  )

  server.post(
    '/dashscope/image-edit',
    {
      schema: buildSchema({
        summary: '通义万相图片编辑',
        description: '代理调用 Dashscope multimodal-generation/generation 接口进行图片编辑',
        tags: ['AI', 'Dashscope'],
        body: dashscopeImageEditBody,
      }),
    },
    async (request, reply) => {
      const body = dashscopeImageEditBody.parse(request.body)
      const data = await callVendor(
        'dashscope',
        'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
        reply,
        { method: 'POST', body: JSON.stringify(body) },
      )
      if (data === null) return
      recordUsage(request.userId!, 'dashscope')
      return reply.send(success(data))
    },
  )

  server.post(
    '/dashscope/tts',
    {
      schema: buildSchema({
        summary: '通义千问语音合成',
        description: '代理调用 Dashscope text-to-audio 接口进行文本转语音',
        tags: ['AI', 'Dashscope'],
        body: ttsBody,
      }),
    },
    async (request, reply) => {
      const body = ttsBody.parse(request.body)
      const data = await callVendor(
        'dashscope',
        'https://dashscope.aliyuncs.com/api/v1/services/audio/tts/text-to-audio',
        reply,
        { method: 'POST', body: JSON.stringify(body) },
      )
      if (data === null) return
      recordUsage(request.userId!, 'dashscope')
      return reply.send(success(data))
    },
  )

  server.post(
    '/dashscope/asr',
    {
      schema: buildSchema({
        summary: '通义千问语音识别',
        description: '代理调用 Dashscope audio/asr/transcription 接口进行语音转写',
        tags: ['AI', 'Dashscope'],
        body: asrBody,
      }),
    },
    async (request, reply) => {
      const body = asrBody.parse(request.body)
      const data = await callVendor(
        'dashscope',
        'https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription',
        reply,
        { method: 'POST', body: JSON.stringify(body) },
      )
      if (data === null) return
      recordUsage(request.userId!, 'dashscope')
      return reply.send(success(data))
    },
  )

  server.get(
    '/dashscope/models',
    {
      schema: buildSchema({
        summary: '通义千问模型列表',
        description: '代理调用 Dashscope 兼容模式 /models 接口获取可用模型列表',
        tags: ['AI', 'Dashscope'],
      }),
    },
    async (_request, reply) => {
      const data = await callVendor(
        'dashscope',
        'https://dashscope.aliyuncs.com/compatible-mode/v1/models',
        reply,
        { method: 'GET' },
      )
      if (data === null) return
      return reply.send(success(data))
    },
  )

  server.post(
    '/dashscope/video',
    {
      schema: buildSchema({
        summary: '通义万相视频生成',
        description: '代理调用 Dashscope video-synthesis 异步视频生成接口',
        tags: ['AI', 'Dashscope'],
        body: promptModelBody,
      }),
    },
    async (request, reply) => {
      const body = promptModelBody.parse(request.body)
      const data = await callVendor(
        'dashscope',
        'https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis',
        reply,
        { method: 'POST', body: JSON.stringify(body) },
      )
      if (data === null) return
      const task = createTask(request.userId!, 'dashscope', 'video', data)
      recordUsage(request.userId!, 'dashscope')
      return reply.send(success({ taskId: task.taskId, status: task.status, raw: data }))
    },
  )

  server.post(
    '/dashscope/embedding',
    {
      schema: buildSchema({
        summary: '通义千问文本向量化',
        description: '代理调用 Dashscope 兼容模式 /embeddings 接口生成文本向量',
        tags: ['AI', 'Dashscope'],
        body: textModelBody,
      }),
    },
    async (request, reply) => {
      const body = textModelBody.parse(request.body)
      const data = await callVendor(
        'dashscope',
        'https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings',
        reply,
        { method: 'POST', body: JSON.stringify(body) },
      )
      if (data === null) return
      recordUsage(request.userId!, 'dashscope')
      return reply.send(success(data))
    },
  )

  server.post(
    '/dashscope/multimodal',
    {
      schema: buildSchema({
        summary: '通义千问多模态生成',
        description: '代理调用 Dashscope multimodal-generation/generation 接口进行多模态生成',
        tags: ['AI', 'Dashscope'],
        body: multimodalBody,
      }),
    },
    async (request, reply) => {
      const body = multimodalBody.parse(request.body)
      const data = await callVendor(
        'dashscope',
        'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
        reply,
        { method: 'POST', body: JSON.stringify(body) },
      )
      if (data === null) return
      recordUsage(request.userId!, 'dashscope')
      return reply.send(success(data))
    },
  )

  server.post(
    '/dashscope/agent',
    {
      schema: buildSchema({
        summary: '通义千问智能体调用',
        description: '代理调用 Dashscope agents/generation 接口进行智能体调用',
        tags: ['AI', 'Dashscope'],
        body: dashscopeAgentBody,
      }),
    },
    async (request, reply) => {
      const body = dashscopeAgentBody.parse(request.body)
      const data = await callVendor(
        'dashscope',
        'https://dashscope.aliyuncs.com/api/v1/services/aigc/agents/generation',
        reply,
        { method: 'POST', body: JSON.stringify(body) },
      )
      if (data === null) return
      recordUsage(request.userId!, 'dashscope')
      return reply.send(success(data))
    },
  )

  // 2. Doubao(豆包/字节)— 9 端点
  server.post(
    '/doubao/chat',
    {
      schema: buildSchema({
        summary: '豆包对话补全',
        description: '代理调用 Doubao(火山方舟)chat/completions 接口',
        tags: ['AI', 'Doubao'],
        body: chatBody,
      }),
    },
    async (request, reply) => {
      const body = chatBody.parse(request.body)
      if (!(await ensurePointsBalance(request, reply, body.model ?? ''))) return
      const data = await callVendor(
        'doubao',
        'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
        reply,
        { method: 'POST', body: JSON.stringify(body) },
      )
      if (data === null) return
      recordUsage(request.userId!, 'doubao')
      await chargePointsForCall(request, body.model ?? '', data, request.id)
      return reply.send(success(data))
    },
  )

  server.post(
    '/doubao/image',
    {
      schema: buildSchema({
        summary: '豆包文生图',
        description: '代理调用 Doubao images/generations 接口进行文生图',
        tags: ['AI', 'Doubao'],
        body: imageBody,
      }),
    },
    async (request, reply) => {
      const body = imageBody.parse(request.body)
      const data = await callVendor(
        'doubao',
        'https://ark.cn-beijing.volces.com/api/v3/images/generations',
        reply,
        { method: 'POST', body: JSON.stringify(body) },
      )
      if (data === null) return
      recordUsage(request.userId!, 'doubao')
      return reply.send(success(data))
    },
  )

  server.post(
    '/doubao/image-edit',
    {
      schema: buildSchema({
        summary: '豆包图片编辑',
        description: '代理调用 Doubao images/generations 接口进行图片编辑(prompt+image 必填)',
        tags: ['AI', 'Doubao'],
        body: doubaoImageEditBody,
      }),
    },
    async (request, reply) => {
      const body = doubaoImageEditBody.parse(request.body)
      if (!body.prompt || !body.image) {
        return reply.status(400).send(error(400, 'prompt 和 image 为必填'))
      }
      const payload = {
        model: body.model ?? 'doubao-seededit-3-0-i2i',
        prompt: body.prompt,
        image: body.image,
        ...(body.size ? { size: body.size } : {}),
        ...(body.strength !== undefined ? { strength: body.strength } : {}),
      }
      const data = await callVendor(
        'doubao',
        'https://ark.cn-beijing.volces.com/api/v3/images/generations',
        reply,
        { method: 'POST', body: JSON.stringify(payload) },
      )
      if (data === null) return
      recordUsage(request.userId!, 'doubao')
      return reply.send(success(data))
    },
  )

  server.post(
    '/doubao/tts',
    {
      schema: buildSchema({
        summary: '豆包语音合成',
        description: '代理调用 Doubao openspeech text-to-speech 接口',
        tags: ['AI', 'Doubao'],
        body: ttsBody,
      }),
    },
    async (request, reply) => {
      const body = ttsBody.parse(request.body)
      const data = await callVendor(
        'doubao',
        'https://openspeech.bytedance.com/api/v1/tts',
        reply,
        {
          method: 'POST',
          body: JSON.stringify(body),
        },
      )
      if (data === null) return
      recordUsage(request.userId!, 'doubao')
      return reply.send(success(data))
    },
  )

  server.post(
    '/doubao/asr',
    {
      schema: buildSchema({
        summary: '豆包语音识别',
        description: '代理调用 Doubao openspeech asr 接口进行语音转写',
        tags: ['AI', 'Doubao'],
        body: asrBody,
      }),
    },
    async (request, reply) => {
      const body = asrBody.parse(request.body)
      const data = await callVendor(
        'doubao',
        'https://openspeech.bytedance.com/api/v1/asr',
        reply,
        {
          method: 'POST',
          body: JSON.stringify(body),
        },
      )
      if (data === null) return
      recordUsage(request.userId!, 'doubao')
      return reply.send(success(data))
    },
  )

  server.get(
    '/doubao/models',
    {
      schema: buildSchema({
        summary: '豆包模型列表',
        description: '代理调用 Doubao(火山方舟)/models 接口获取可用模型列表',
        tags: ['AI', 'Doubao'],
      }),
    },
    async (_request, reply) => {
      const data = await callVendor(
        'doubao',
        'https://ark.cn-beijing.volces.com/api/v3/models',
        reply,
        { method: 'GET' },
      )
      if (data === null) return
      return reply.send(success(data))
    },
  )

  server.post(
    '/doubao/video',
    {
      schema: buildSchema({
        summary: '豆包视频生成',
        description: '代理调用 Doubao contents/generations/tasks 异步视频生成接口',
        tags: ['AI', 'Doubao'],
        body: promptModelBody,
      }),
    },
    async (request, reply) => {
      const body = promptModelBody.parse(request.body)
      const data = await callVendor(
        'doubao',
        'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks',
        reply,
        { method: 'POST', body: JSON.stringify(body) },
      )
      if (data === null) return
      const task = createTask(request.userId!, 'doubao', 'video', data)
      recordUsage(request.userId!, 'doubao')
      return reply.send(success({ taskId: task.taskId, status: task.status, raw: data }))
    },
  )

  server.post(
    '/doubao/embedding',
    {
      schema: buildSchema({
        summary: '豆包文本向量化',
        description: '代理调用 Doubao(火山方舟)/embeddings 接口生成文本向量',
        tags: ['AI', 'Doubao'],
        body: textModelBody,
      }),
    },
    async (request, reply) => {
      const body = textModelBody.parse(request.body)
      const data = await callVendor(
        'doubao',
        'https://ark.cn-beijing.volces.com/api/v3/embeddings',
        reply,
        { method: 'POST', body: JSON.stringify(body) },
      )
      if (data === null) return
      recordUsage(request.userId!, 'doubao')
      return reply.send(success(data))
    },
  )

  server.post(
    '/doubao/multimodal',
    {
      schema: buildSchema({
        summary: '豆包多模态对话',
        description: '代理调用 Doubao(火山方舟)chat/completions 接口进行多模态对话',
        tags: ['AI', 'Doubao'],
        body: multimodalBody,
      }),
    },
    async (request, reply) => {
      const body = multimodalBody.parse(request.body)
      const data = await callVendor(
        'doubao',
        'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
        reply,
        { method: 'POST', body: JSON.stringify(body) },
      )
      if (data === null) return
      recordUsage(request.userId!, 'doubao')
      return reply.send(success(data))
    },
  )

  // 3. Gemini(Google)— 8 端点
  server.post(
    '/gemini/chat',
    {
      schema: buildSchema({
        summary: 'Gemini 对话生成',
        description: '代理调用 Gemini generateContent 接口进行对话生成(默认 gemini-2.0-flash)',
        tags: ['AI', 'Gemini'],
        body: multimodalBody,
      }),
    },
    async (request, reply) => {
      const body = multimodalBody.parse(request.body)
      const model = body.model ?? 'gemini-2.0-flash'
      if (!(await ensurePointsBalance(request, reply, model))) return
      const data = await callVendor(
        'gemini',
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        reply,
        { method: 'POST', body: JSON.stringify(body) },
      )
      if (data === null) return
      recordUsage(request.userId!, 'gemini')
      await chargePointsForCall(request, model, data, request.id)
      return reply.send(success(data))
    },
  )

  server.post(
    '/gemini/image',
    {
      schema: buildSchema({
        summary: 'Gemini 图像生成',
        description: '代理调用 Gemini imagen-3.0 predict 接口进行文生图',
        tags: ['AI', 'Gemini'],
        body: imageBody,
      }),
    },
    async (request, reply) => {
      const body = imageBody.parse(request.body)
      const model = body.model ?? 'imagen-3.0-generate-002'
      const data = await callVendor(
        'gemini',
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:predict`,
        reply,
        {
          method: 'POST',
          body: JSON.stringify({
            instances: [{ prompt: body.prompt }],
            parameters: { sampleCount: 1 },
          }),
        },
      )
      if (data === null) return
      recordUsage(request.userId!, 'gemini')
      return reply.send(success(data))
    },
  )

  server.post(
    '/gemini/tts',
    {
      schema: buildSchema({
        summary: 'Gemini 语音合成',
        description: '代理调用 Google Text-to-Speech text:synthesize 接口',
        tags: ['AI', 'Gemini'],
        body: ttsBody,
      }),
    },
    async (request, reply) => {
      const body = ttsBody.parse(request.body)
      const data = await callVendor(
        'gemini',
        'https://texttospeech.googleapis.com/v1/text:synthesize',
        reply,
        {
          method: 'POST',
          body: JSON.stringify({
            input: { text: body.text },
            voice: { languageCode: 'zh-CN', name: body.voice },
            audioConfig: { audioEncoding: 'MP3' },
          }),
        },
      )
      if (data === null) return
      recordUsage(request.userId!, 'gemini')
      return reply.send(success(data))
    },
  )

  server.post(
    '/gemini/asr',
    {
      schema: buildSchema({
        summary: 'Gemini 语音识别',
        description: '代理调用 Google Cloud Speech-to-Text speech:recognize 接口',
        tags: ['AI', 'Gemini'],
        body: asrBody,
      }),
    },
    async (request, reply) => {
      const body = asrBody.parse(request.body)
      const data = await callVendor(
        'gemini',
        'https://speech.googleapis.com/v1/speech:recognize',
        reply,
        { method: 'POST', body: JSON.stringify(body) },
      )
      if (data === null) return
      recordUsage(request.userId!, 'gemini')
      return reply.send(success(data))
    },
  )

  server.get(
    '/gemini/models',
    {
      schema: buildSchema({
        summary: 'Gemini 模型列表',
        description: '代理调用 Gemini /v1beta/models 接口获取可用模型列表',
        tags: ['AI', 'Gemini'],
      }),
    },
    async (_request, reply) => {
      const data = await callVendor(
        'gemini',
        'https://generativelanguage.googleapis.com/v1beta/models',
        reply,
        { method: 'GET' },
      )
      if (data === null) return
      return reply.send(success(data))
    },
  )

  server.post(
    '/gemini/video',
    {
      schema: buildSchema({
        summary: 'Gemini 视频生成',
        description: '代理调用 Gemini veo-3.0 predictLongRunning 异步视频生成接口',
        tags: ['AI', 'Gemini'],
        body: promptModelBody,
      }),
    },
    async (request, reply) => {
      const body = promptModelBody.parse(request.body)
      const model = body.model ?? 'veo-3.0-generate-preview'
      const data = await callVendor(
        'gemini',
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:predictLongRunning`,
        reply,
        {
          method: 'POST',
          body: JSON.stringify({
            instances: [{ prompt: body.prompt }],
            parameters: { sampleCount: 1 },
          }),
        },
      )
      if (data === null) return
      const task = createTask(request.userId!, 'gemini', 'video', data)
      recordUsage(request.userId!, 'gemini')
      return reply.send(success({ taskId: task.taskId, status: task.status, raw: data }))
    },
  )

  server.post(
    '/gemini/embedding',
    {
      schema: buildSchema({
        summary: 'Gemini 文本向量化',
        description: '代理调用 Gemini embedContent 接口生成文本向量(默认 text-embedding-004)',
        tags: ['AI', 'Gemini'],
        body: textModelBody,
      }),
    },
    async (request, reply) => {
      const body = textModelBody.parse(request.body)
      const model = body.model ?? 'text-embedding-004'
      const data = await callVendor(
        'gemini',
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:embedContent`,
        reply,
        { method: 'POST', body: JSON.stringify({ content: { parts: [{ text: body.text }] } }) },
      )
      if (data === null) return
      recordUsage(request.userId!, 'gemini')
      return reply.send(success(data))
    },
  )

  server.post(
    '/gemini/multimodal',
    {
      schema: buildSchema({
        summary: 'Gemini 多模态生成',
        description: '代理调用 Gemini generateContent 接口进行多模态生成(默认 gemini-2.0-flash)',
        tags: ['AI', 'Gemini'],
        body: multimodalBody,
      }),
    },
    async (request, reply) => {
      const body = multimodalBody.parse(request.body)
      const model = body.model ?? 'gemini-2.0-flash'
      if (!(await ensurePointsBalance(request, reply, model))) return
      const data = await callVendor(
        'gemini',
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        reply,
        { method: 'POST', body: JSON.stringify(body) },
      )
      if (data === null) return
      recordUsage(request.userId!, 'gemini')
      await chargePointsForCall(request, model, data, request.id)
      return reply.send(success(data))
    },
  )
}

// R4 重构样板:新签名 callVendor(vendor, ctx, reply) 业务路由
// 当前已迁移:DASHSCOPE(10 端点)、DOUBAO(8 端点)、GEMINI(8 端点)
export const llmVendorV2Routes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.headers.upgrade === 'websocket') return
    if (!(await requireAuth(request, reply))) return
  })

  server.post(
    '/v2/dashscope/chat',
    {
      schema: buildSchema({
        summary: '[V2] 通义千问对话补全',
        description: 'V2 新签名样板:代理调用 Dashscope 兼容模式 chat/completions',
        tags: ['AI', 'V2'],
        body: chatBody,
      }),
    },
    async (request, reply) => {
      const body = chatBody.parse(request.body)
      if (!(await ensurePointsBalance(request, reply, body.model ?? ''))) return
      const data = await newCallVendor(
        'dashscope',
        { method: 'POST', endpoint: '/compatible-mode/v1/chat/completions', body },
        reply,
      )
      if (data === null) return
      recordUsage(request.userId!, 'dashscope')
      await chargePointsForCall(request, body.model ?? '', data, request.id)
      return reply.send(success(data))
    },
  )

  server.post(
    '/v2/dashscope/image',
    {
      schema: buildSchema({
        summary: '[V2] 通义万相文生图',
        description: 'V2 新签名样板:代理调用 Dashscope text2image/image-synthesis 异步文生图',
        tags: ['AI', 'V2'],
        body: imageBody,
      }),
    },
    async (request, reply) => {
      const body = imageBody.parse(request.body)
      const data = await newCallVendor(
        'dashscope',
        { method: 'POST', endpoint: '/api/v1/services/aigc/text2image/image-synthesis', body },
        reply,
      )
      if (data === null) return
      const task = createTask(request.userId!, 'dashscope', 'image', data)
      recordUsage(request.userId!, 'dashscope')
      return reply.send(success({ taskId: task.taskId, status: task.status, raw: data }))
    },
  )

  server.post(
    '/v2/dashscope/tts',
    {
      schema: buildSchema({
        summary: '[V2] 通义千问语音合成',
        description: 'V2 新签名样板:代理调用 Dashscope text-to-audio 接口',
        tags: ['AI', 'V2'],
        body: ttsBody,
      }),
    },
    async (request, reply) => {
      const body = ttsBody.parse(request.body)
      const data = await newCallVendor(
        'dashscope',
        { method: 'POST', endpoint: '/api/v1/services/audio/tts/text-to-audio', body },
        reply,
      )
      if (data === null) return
      recordUsage(request.userId!, 'dashscope')
      return reply.send(success(data))
    },
  )

  server.post(
    '/v2/dashscope/asr',
    {
      schema: buildSchema({
        summary: '[V2] 通义千问语音识别',
        description: 'V2 新签名样板:代理调用 Dashscope audio/asr/transcription 接口',
        tags: ['AI', 'V2'],
        body: asrBody,
      }),
    },
    async (request, reply) => {
      const body = asrBody.parse(request.body)
      const data = await newCallVendor(
        'dashscope',
        { method: 'POST', endpoint: '/api/v1/services/audio/asr/transcription', body },
        reply,
      )
      if (data === null) return
      recordUsage(request.userId!, 'dashscope')
      return reply.send(success(data))
    },
  )

  server.post(
    '/v2/doubao/chat',
    {
      schema: buildSchema({
        summary: '[V2] 豆包对话补全',
        description: 'V2 新签名样板:代理调用 Doubao(火山方舟)chat/completions',
        tags: ['AI', 'V2'],
        body: chatBody,
      }),
    },
    async (request, reply) => {
      const body = chatBody.parse(request.body)
      if (!(await ensurePointsBalance(request, reply, body.model ?? ''))) return
      const data = await newCallVendor(
        'doubao',
        { method: 'POST', endpoint: '/api/v3/chat/completions', body },
        reply,
      )
      if (data === null) return
      recordUsage(request.userId!, 'doubao')
      await chargePointsForCall(request, body.model ?? '', data, request.id)
      return reply.send(success(data))
    },
  )

  server.post(
    '/v2/gemini/chat',
    {
      schema: buildSchema({
        summary: '[V2] Gemini 对话生成',
        description: 'V2 新签名样板:代理调用 Gemini generateContent(默认 gemini-2.0-flash)',
        tags: ['AI', 'V2'],
        body: multimodalBody,
      }),
    },
    async (request, reply) => {
      const body = multimodalBody.parse(request.body)
      const model = body.model ?? 'gemini-2.0-flash'
      if (!(await ensurePointsBalance(request, reply, model))) return
      const data = await newCallVendor(
        'gemini',
        {
          method: 'POST',
          endpoint: `/v1beta/models/${encodeURIComponent(model)}:generateContent`,
          body,
          configOverride: { headerName: 'x-goog-api-key' },
        },
        reply,
      )
      if (data === null) return
      recordUsage(request.userId!, 'gemini')
      await chargePointsForCall(request, model, data, request.id)
      return reply.send(success(data))
    },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
