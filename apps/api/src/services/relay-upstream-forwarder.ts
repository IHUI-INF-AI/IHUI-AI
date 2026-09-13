// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top

/**
 * 渠道直连转发器(2026-09-12 立,公开 /v1 链路接通渠道路由)。
 *
 * 背景:v1-public.ts 原固定打 ai-service /api/llm/complete,渠道路由器
 * (relay-channel-router)的 selectChannelKey/熔断/负载均衡对公开链路是死代码。
 * 本服务补上「真中转」最后一环:按模型选渠道候选(有序),直连上游
 * OpenAI 兼容端点(baseUrl + /chat/completions),失败自动切换下一候选(failover)。
 *
 * 设计:
 * - 候选来源:selectChannelCandidates(model, userId, affinityKey, 3),组优先级 → 组内策略 → 权重降序
 * - 每次尝试成功/失败都调 recordChannelResult 更新熔断状态(Redis 共享)
 * - 返回 null = 无渠道配置 → 调用方回退 ai-service 既有链路(向后兼容,零渠道站点不受影响)
 * - 返回 ok:false = 有渠道但全部失败 → 调用方仍回退 ai-service(双通道韧性)
 * - 流式:仅在「首字节到达前」failover;一旦开始读流不再切换(OpenAI/OneAPI 同款语义)
 * - 模型名:传给上游的是 DB 原始 model_id(去 LiteLLM 前缀),与 ai_model_config_models 一致
 */
import type { SelectedChannelKey } from './relay-channel-router.js'
import { selectChannelCandidates, recordChannelResult } from './relay-channel-router.js'

// =============================================================================
// 类型
// =============================================================================

export interface UpstreamForwardRequest {
  /** 模型名(允许带 LiteLLM 前缀,内部去前缀后选渠道与直呼上游) */
  model: string
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  temperature?: number
  maxTokens?: number
  stream: boolean
  /** response_format 原样透传(上游是否支持由其自身决定) */
  responseFormat?: unknown
  seed?: number
  userId?: string
  /** session-affinity 亲和性 key(建议传 apiKeyId) */
  affinityKey?: string
  /**
   * 完整请求体覆盖(2026-09-12:参数覆盖系统 applyParamOps 产出的最终 body)。
   * 提供时以此为基(model/stream/messages 强制回填,防上游劫持协议字段)。
   */
  bodyOverride?: Record<string, unknown>
  signal?: AbortSignal
}

interface ForwardSuccess {
  ok: true
  /** 上游 Response(非流式:待 .json();流式:body 为 SSE 可读流) */
  response: Response
  channel: SelectedChannelKey
  /** 本渠道单次尝试的建立耗时(含上游响应头返回) */
  latencyMs: number
}

interface ForwardFailure {
  ok: false
  /** 全部候选均失败的原因摘要 */
  reason: string
  /** 最后一次上游 HTTP 状态(网络错误时为 undefined) */
  lastHttpStatus?: number
}

/**
 * 转发结果:
 * - { ok:true } 直连成功
 * - { ok:false } 有渠道但全部失败
 * - null 无可用渠道(未配置渠道组/key,或全部被熔断/配额剔除)→ 调用方回退 ai-service
 */
export type ForwardResult = ForwardSuccess | ForwardFailure | null

// =============================================================================
// 内部工具
// =============================================================================

/** 去 LiteLLM 自定义前缀(stepfun/agnes 等),得到 DB 原始 model_id(即上游真实模型名)。 */
function stripLiteLLMModelPrefix(model: string): string {
  const slashIdx = model.indexOf('/')
  if (slashIdx > 0) {
    const prefix = model.slice(0, slashIdx)
    if (prefix === 'stepfun' || prefix === 'agnes') return model.slice(slashIdx + 1)
  }
  return model
}

/**
 * baseUrl → OpenAI 兼容 chat/completions 端点。
 * 约定:ai_model_config.baseUrl 存到版本段(如 https://api.openai.com/v1),
 * 已以 /v{n} 结尾直接拼 /chat/completions,否则补 /v1(主流厂商默认)。
 */
function upstreamChatCompletionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, '')
  if (/\/v\d+$/.test(trimmed)) return `${trimmed}/chat/completions`
  return `${trimmed}/v1/chat/completions`
}

const MAX_CANDIDATES = 3 // 逐请求 failover 最多尝试的渠道数

// =============================================================================
// 转发主入口
// =============================================================================

/**
 * 按渠道路由直连上游 OpenAI 兼容端点,失败自动切换下一候选。
 * 见文件头设计说明。永不抛错(所有异常折叠为 ForwardFailure / null)。
 */
export async function forwardToChannel(req: UpstreamForwardRequest): Promise<ForwardResult> {
  const rawModel = stripLiteLLMModelPrefix(req.model)
  let candidates: SelectedChannelKey[]
  try {
    candidates = await selectChannelCandidates(
      rawModel,
      req.userId,
      req.affinityKey,
      MAX_CANDIDATES,
    )
  } catch {
    return null // 渠道查询异常 → 回退 ai-service
  }
  if (candidates.length === 0) return null

  let body: Record<string, unknown> = {
    model: rawModel,
    messages: req.messages,
    stream: req.stream,
  }
  if (req.temperature !== undefined) body.temperature = req.temperature
  if (req.maxTokens !== undefined) body.max_tokens = req.maxTokens
  if (req.responseFormat !== undefined) body.response_format = req.responseFormat
  if (req.seed !== undefined) body.seed = req.seed
  if (req.bodyOverride) {
    body = { ...req.bodyOverride, model: rawModel, stream: req.stream }
  }

  let lastError = 'no channel candidate succeeded'
  let lastHttpStatus: number | undefined

  for (const channel of candidates) {
    const startedAt = Date.now()
    try {
      const resp = await fetch(upstreamChatCompletionsUrl(channel.baseUrl), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${channel.apiKey}`,
          Accept: req.stream ? 'text/event-stream' : 'application/json',
        },
        body: JSON.stringify(body),
        signal: req.signal,
      })
      const latencyMs = Date.now() - startedAt

      if (!resp.ok || !resp.body) {
        lastHttpStatus = resp.status
        lastError = `upstream ${resp.status}`
        await recordChannelResult(channel.keyPoolId, false, latencyMs).catch(() => {})
        continue // failover:下一候选
      }

      await recordChannelResult(channel.keyPoolId, true, latencyMs).catch(() => {})
      return { ok: true, response: resp, channel, latencyMs }
    } catch (e) {
      // 网络错误/DNS/超时 → 记熔断失败,尝试下一候选
      lastError = (e as Error)?.message || 'upstream network error'
      await recordChannelResult(channel.keyPoolId, false, Date.now() - startedAt).catch(() => {})
      if ((e as Error)?.name === 'AbortError') break // 客户端已断开,不再尝试
      continue
    }
  }

  return { ok: false, reason: lastError, lastHttpStatus }
}

// =============================================================================
// 流式管道:上游 OpenAI SSE → 客户端直通 + 用量聚合
// =============================================================================

export interface PipedStreamStats {
  /** 聚合的 assistant 文本(delta.content 拼接,计费/缓存估算用) */
  responseText: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
  ttftMs: number | null
  httpStatus: number
}

export interface PipeStreamOptions {
  /** verbatim 模式(chat flavor):原样转发上游 SSE 行(调用方补 \n\n 帧) */
  writeLine?: (line: string) => void
  /** textMode(legacy /v1/completions):不转发原始行,改为每个 delta.content 触发一次 */
  emitText?: (text: string) => void
  signal?: AbortSignal
}

/** 从 SSE data 行解析 JSON(忽略 [DONE] 与非 data 行)。 */
function parseSseData(line: string): Record<string, unknown> | null {
  const trimmed = line.trim()
  if (!trimmed.startsWith('data:')) return null
  const payload = trimmed.slice(5).trim()
  if (!payload || payload === '[DONE]') return null
  try {
    const json = JSON.parse(payload)
    return json && typeof json === 'object' ? (json as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function readNum(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0
}

/**
 * 上游 OpenAI SSE 管道(双模式):
 * - verbatim(writeLine):逐行转发上游原始 data 行到客户端(OpenAI chunk 格式天然兼容,不改写)
 * - textMode(emitText):解析每个 delta.content 并回调(legacy /v1/completions 流式,由调用方自行组 text chunk)
 * 两种模式都聚合内容 + 末尾 usage chunk(prompt_tokens_details.cached_tokens / Anthropic cache 字段),
 * 返回聚合统计供调用方 recordCall 计费。
 */
export async function pipeChannelStream(
  upstream: Response,
  opts: PipeStreamOptions,
): Promise<PipedStreamStats> {
  const textMode = typeof opts.emitText === 'function'
  const stats: PipedStreamStats = {
    responseText: '',
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    ttftMs: null,
    httpStatus: upstream.status,
  }
  const startedAt = Date.now()
  const reader = upstream.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const abort = () => void reader.cancel().catch(() => {})
  opts.signal?.addEventListener('abort', abort, { once: true })

  const handleLine = (line: string) => {
    if (!textMode) opts.writeLine?.(`${line}\n\n`)
    const json = parseSseData(line)
    if (!json) return
    if (stats.ttftMs === null) stats.ttftMs = Date.now() - startedAt
    const choices = json['choices'] as Array<Record<string, unknown>> | undefined
    const delta = choices?.[0]?.['delta'] as Record<string, unknown> | undefined
    const content = delta?.['content']
    if (typeof content === 'string' && content.length > 0) {
      stats.responseText += content
      if (textMode) opts.emitText!(content)
    }
    const usage = json['usage'] as Record<string, unknown> | undefined
    if (usage) {
      stats.promptTokens = readNum(usage['prompt_tokens'])
      stats.completionTokens = readNum(usage['completion_tokens'])
      stats.totalTokens = readNum(usage['total_tokens'])
      const details = usage['prompt_tokens_details'] as Record<string, unknown> | undefined
      stats.cacheReadTokens = readNum(details?.['cached_tokens'])
      stats.cacheReadTokens = Math.max(
        stats.cacheReadTokens,
        readNum(usage['cache_read_input_tokens']),
      )
      stats.cacheCreationTokens = readNum(usage['cache_creation_input_tokens'])
    }
  }

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let nl: number
      while ((nl = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, nl).replace(/\r$/, '')
        buffer = buffer.slice(nl + 1)
        handleLine(line)
      }
    }
    if (buffer.trim()) handleLine(buffer.trim())
  } finally {
    opts.signal?.removeEventListener('abort', abort)
    reader.releaseLock()
  }
  // usage 缺失(上游未开 stream_options.include_usage)→ 按字符估算兜底(1 token ≈ 4 字符)
  if (stats.totalTokens === 0) {
    stats.completionTokens = Math.ceil(stats.responseText.length / 4)
    stats.totalTokens = stats.completionTokens
  }
  return stats
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
