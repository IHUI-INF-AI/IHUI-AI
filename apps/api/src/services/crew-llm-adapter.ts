/**
 * Crew LLM 适配器
 *
 * 通过 ai-service 的 /api/llm/complete 端点调用 LLM,复用项目已有的 LiteLLM 网关。
 * ai-service 内部优先级:ai_model_config 表(ownerUuid/providerCode 匹配) > .env 环境变量 > stub 降级。
 *
 * .env 已配置的 provider(有真实 API key):
 * - STEPFUN_API_KEY + STEPFUN_API_BASE(OpenAI 兼容)→ 模型前缀 stepfun/*
 * - AGNES_API_KEY + AGNES_API_BASE(OpenAI 兼容)→ 模型前缀 agnes/*
 * 默认模型:LITELLM_MODEL(项目默认 stepfun/step-3.7-flash)
 */
import { config } from '../config/index.js'
import { logger } from './clawdbot/logger.js'

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  /** tool role 时必填:工具调用的 ID */
  tool_call_id?: string
  /** assistant role 且发起工具调用时:工具调用列表 */
  tool_calls?: ToolCall[]
  /** assistant role 且为 tool 调用时:工具名称(可选,用于日志) */
  name?: string
}

/** OpenAI function calling tool 定义 */
export interface LlmToolDef {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, unknown>
      required?: string[]
    }
  }
}

/** LLM 返回的工具调用 */
export interface ToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export interface LlmCallOptions {
  /** 指定模型名(含 provider 前缀,如 stepfun/step-3.7-flash);留空用 LITELLM_MODEL 默认 */
  modelId?: string
  messages: LlmMessage[]
  temperature?: number
  maxTokens?: number
  /** function calling:工具定义列表 */
  tools?: LlmToolDef[]
  /** 工具选择策略: auto(默认)/none/required */
  toolChoice?: 'auto' | 'none' | 'required'
}

export interface LlmCallResult {
  content: string
  modelUsed: string
  usage: { promptTokens: number; completionTokens: number; totalTokens: number }
  stub: boolean
  /** LLM 返回的工具调用(若有) */
  toolCalls?: ToolCall[]
}

/** 默认模型(与 .env LITELLM_MODEL 一致) */
const DEFAULT_MODEL = process.env.LITELLM_MODEL || 'stepfun/step-3.7-flash'

/**
 * 调用 ai-service 的 /api/llm/complete 端点。
 *
 * 响应格式(与 ai-service app/routers/llm.py 一致):
 * - 成功: { content, model, usage, stub }
 * - 失败: { content: "", model, usage: {}, stub: false, error: true, error_message: "..." }
 */
export async function callRealLlm(opts: LlmCallOptions): Promise<LlmCallResult> {
  const model = opts.modelId || DEFAULT_MODEL
  const url = `${config.AI_SERVICE_URL}/api/llm/complete`

  const body: Record<string, unknown> = {
    messages: opts.messages.map((m) => {
      // 透传 function calling 相关字段
      const msg: Record<string, unknown> = { role: m.role, content: m.content }
      if (m.tool_call_id) msg.tool_call_id = m.tool_call_id
      if (m.tool_calls) msg.tool_calls = m.tool_calls
      if (m.name) msg.name = m.name
      return msg
    }),
    model,
  }
  // 透传可选参数(LiteLLM 兼容)
  if (opts.temperature !== undefined) body.temperature = opts.temperature
  if (opts.maxTokens !== undefined) body.max_tokens = opts.maxTokens
  if (opts.tools && opts.tools.length > 0) body.tools = opts.tools
  if (opts.toolChoice) body.tool_choice = opts.toolChoice

  const start = Date.now()
  logger.info(
    { model, msgs: opts.messages.length, tools: opts.tools?.length ?? 0, url },
    '[CrewLLM] 调用 ai-service',
  )

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '')
    throw new Error(`ai-service /api/llm/complete HTTP ${resp.status}: ${errText.slice(0, 300)}`)
  }

  const data = (await resp.json()) as {
    content?: string
    model?: string
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
    stub?: boolean
    error?: boolean
    error_message?: string
    tool_calls?: ToolCall[]
  }

  // ai-service 返回 error 字段时表示 LLM 调用失败
  if (data.error) {
    throw new Error(data.error_message || `ai-service LLM 调用失败(model=${model})`)
  }

  const u = data.usage ?? {}
  const result: LlmCallResult = {
    content: data.content ?? '',
    modelUsed: data.model ?? model,
    usage: {
      promptTokens: u.prompt_tokens ?? 0,
      completionTokens: u.completion_tokens ?? 0,
      totalTokens: u.total_tokens ?? 0,
    },
    stub: data.stub ?? false,
    toolCalls: data.tool_calls && data.tool_calls.length > 0 ? data.tool_calls : undefined,
  }

  logger.info(
    {
      model: result.modelUsed,
      elapsed: Date.now() - start,
      tokens: result.usage.totalTokens,
      stub: result.stub,
      toolCalls: result.toolCalls?.length ?? 0,
    },
    '[CrewLLM] 调用完成',
  )

  return result
}
