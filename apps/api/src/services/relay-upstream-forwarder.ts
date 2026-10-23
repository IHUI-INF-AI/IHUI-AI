// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
export type { SelectedChannelKey }
import { selectChannelCandidates, recordChannelResult } from './relay-channel-router.js'
// 账号池回落(2026-10-22):无渠道候选时尝试第三方 AI IDE 账号池(trae/workbuddy/codearts)
import { forwardToAccountPool } from './relay-account-forwarder.js'
// 格②(2026-09-26)：耗时样本唯一出口——单调钟测量 × 墙钟交叉校验
import { startStopwatch } from '../utils/elapsed-ms.js'
// 插件系统(2026-09-17,补强 59):upstream_header_inject 解释器接线(带 30s 缓存,失败降级不注入)
import { getEnabledPlugins, applyUpstreamHeaderPlugins } from './relay-plugins-service.js'

// =============================================================================
// 类型
// =============================================================================

export interface UpstreamForwardRequest {
  /** 模型名(允许带 LiteLLM 前缀,内部去前缀后选渠道与直呼上游) */
  model: string
  /** chat 端点必填;images 端点忽略(body 由 bodyOverride 提供)。
   *  2026-10-22 放宽:支持 function-calling 回环(role tool/assistant.tool_calls/多模态 content 数组) */
  messages?: Array<{ role: string; content?: unknown; [key: string]: unknown }>
  /** 上游端点(2026-09-13):chat=POST /chat/completions(默认);images=POST /images/generations */
  endpoint?: 'chat' | 'images'
  temperature?: number
  maxTokens?: number
  stream: boolean
  /** response_format 原样透传(上游是否支持由其自身决定) */
  responseFormat?: unknown
  seed?: number
  /** OpenAI tools 函数调用透传(渠道直连与账号池上游均 OpenAI 兼容;2026-10-22 补) */
  tools?: unknown[]
  /** tool_choice 透传(原样,平台归一由适配器负责) */
  toolChoice?: unknown
  /** reasoning_effort 透传(渠道路径原样,账号池由适配器映射到平台专有字段) */
  reasoningEffort?: string | number
  /** 采样面(top_p / 惩罚项),渠道路径原样透传;账号池由适配器按平台规则透传 */
  topP?: number
  presencePenalty?: number
  frequencyPenalty?: number
  /** 并行工具调用开关 */
  parallelToolCalls?: boolean
  /** 终端用户标识(仅透传) */
  user?: string
  /** 服务等级(仅透传) */
  serviceTier?: string
  topK?: number
  repetitionPenalty?: number
  logitBias?: Record<string, number>
  /** 候选数:账号池单请求只支持 1,>1 时回退到 ai-service 链路 */
  n?: number
  /** logprobs:账号池上游静默忽略,请求时回退到 ai-service 链路 */
  logprobs?: boolean
  topLogprobs?: number
  /** stop 序列(OpenAI string | string[];账号池由适配器本地截断) */
  stop?: string | string[]
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
  /** 格②：该耗时是否通过 单调×墙钟 交叉校验(false = 仅保留观测,未喂熔断) */
  latencyTrusted: boolean
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
 * baseUrl → OpenAI 兼容端点(chat/completions 或 images/generations)。
 * 约定:ai_model_config.baseUrl 存到版本段(如 https://api.openai.com/v1),
 * 已以 /v{n} 结尾直接拼,否则补 /v1(主流厂商默认)。
 */
function upstreamEndpointUrl(baseUrl: string, endpoint: 'chat' | 'images'): string {
  const trimmed = baseUrl.replace(/\/+$/, '')
  const base = /\/v\d+$/.test(trimmed) ? trimmed : `${trimmed}/v1`
  return endpoint === 'images' ? `${base}/images/generations` : `${base}/chat/completions`
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
  const endpoint = req.endpoint ?? 'chat'
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
  if (candidates.length === 0) {
    // 渠道未配置该模型 → 回落到第三方 AI IDE 账号池;仍无结果则照旧回退 ai-service(向后兼容)
    const poolResult = await forwardToAccountPool(req, rawModel).catch(() => null)
    if (poolResult) return poolResult
    return null
  }

  let body: Record<string, unknown>
  if (endpoint === 'images') {
    // OpenAI images/generations:无 stream/messages;body 由调用方 bodyOverride 提供(prompt/n/size...)
    body = { model: rawModel, ...(req.bodyOverride ?? {}) }
    delete body.stream
    delete body.messages
  } else {
    body = {
      model: rawModel,
      messages: req.messages ?? [],
      stream: req.stream,
    }
    if (req.temperature !== undefined) body.temperature = req.temperature
    if (req.maxTokens !== undefined) body.max_tokens = req.maxTokens
    if (req.responseFormat !== undefined) body.response_format = req.responseFormat
    if (req.seed !== undefined) body.seed = req.seed
    if (req.tools !== undefined) body.tools = req.tools
    if (req.toolChoice !== undefined) body.tool_choice = req.toolChoice
    if (req.reasoningEffort !== undefined) body.reasoning_effort = req.reasoningEffort
    if (req.topP !== undefined) body.top_p = req.topP
    if (req.presencePenalty !== undefined) body.presence_penalty = req.presencePenalty
    if (req.frequencyPenalty !== undefined) body.frequency_penalty = req.frequencyPenalty
    if (req.parallelToolCalls !== undefined) body.parallel_tool_calls = req.parallelToolCalls
    if (req.user !== undefined) body.user = req.user
    if (req.serviceTier !== undefined) body.service_tier = req.serviceTier
    if (req.topK !== undefined) body.top_k = req.topK
    if (req.repetitionPenalty !== undefined) body.repetition_penalty = req.repetitionPenalty
    if (req.logitBias !== undefined) body.logit_bias = req.logitBias
    if (req.n !== undefined) body.n = req.n
    if (req.logprobs !== undefined) body.logprobs = req.logprobs
    if (req.topLogprobs !== undefined) body.top_logprobs = req.topLogprobs
    if (req.stop !== undefined) body.stop = req.stop
    if (req.bodyOverride) {
      body = { ...req.bodyOverride, model: rawModel, stream: req.stream }
    }
  }

  let lastError = 'no channel candidate succeeded'
  let lastHttpStatus: number | undefined

  // 插件系统(2026-09-17,补强 59):启用插件一次性读取(30s 缓存),
  // upstream_header_inject 在每个候选的请求头合并;读取失败降级为空集(不阻断转发)。
  const plugins = await getEnabledPlugins().catch(() => [])

  for (const channel of candidates) {
    const started = startStopwatch()
    try {
      const resp = await fetch(upstreamEndpointUrl(channel.baseUrl, endpoint), {
        method: 'POST',
        headers: applyUpstreamHeaderPlugins(plugins, {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${channel.apiKey}`,
          Accept: req.stream ? 'text/event-stream' : 'application/json',
        }),
        body: JSON.stringify(body),
        signal: req.signal,
      })
      // 格②：到达即停表并交叉校验;不可信样本 elapsedMs=null,不喂熔断(计数在 elapsed-ms 与 router 两侧留痕)
      const sample = started.stop()
      const breakerLatency: number | null = sample.trustworthy ? sample.elapsedMs : null
      const latencyMs = sample.perfMs

      if (!resp.ok || !resp.body) {
        lastHttpStatus = resp.status
        lastError = `upstream ${resp.status}`
        await recordChannelResult(channel.keyPoolId, false, breakerLatency).catch(() => {})
        continue // failover:下一候选
      }

      await recordChannelResult(channel.keyPoolId, true, breakerLatency).catch(() => {})
      return {
        ok: true,
        response: resp,
        channel,
        latencyMs,
        latencyTrusted: sample.trustworthy,
      }
    } catch (e) {
      // 网络错误/DNS/超时 → 记熔断失败,尝试下一候选
      lastError = (e as Error)?.message || 'upstream network error'
      const errSample = started.stop()
      const errBreakerLatency: number | null = errSample.trustworthy ? errSample.elapsedMs : null
      await recordChannelResult(channel.keyPoolId, false, errBreakerLatency).catch(() => {})
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
  /**
   * 上游是否已经自己发过带 `finish_reason` 的帧（2026-10-23 加）。
   * 调用方据此决定收尾要不要补结束帧：**补了就重复**——客户端会收到两个 finish
   * （部分实现按最后一个覆盖、部分直接当协议错），且 usage 帧会被夹在两个 finish
   * 之间，偏离 OpenAI 的 finish → usage → [DONE] 顺序。
   */
  sawFinish: boolean
  /**
   * 最近一帧的 `id`（2026-10-23 加）。
   * verbatim 转发的帧带的是上游 id，而收尾的 usage/stop 帧由本服务生成——
   * 不统一就会在同一条流里出现两个 id，按 id 聚合/串联追踪的实现会把它当成两条流。
   * 调用方造收尾帧时应优先用它，缺失再回落到自己生成的 id。
   */
  lastFrameId: string | null
  /**
   * 上游以「积分」计费且**不返回 token** 时的真实扣减量（2026-10-23 加，qoder 首用）。
   * 这类上游（Qoder）usage 的 token 字段恒 0，唯一真实计量是 credits；
   * 桥把它放在终止帧的 `x_qoder_credits` / `usage.credits` 里。
   * null = 本流未提供（或该上游本来就按 token 计费，值在 prompt/completion 上）。
   */
  upstreamCredits: number | null
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

/** 读小数（credits 是小数，不能过 readNum 的取整） */
function readFloat(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null
}

/**
 * 严格判定 SSE 终止帧：payload 恰好为 `[DONE]`（正文里出现该字样不得误判）。
 * 与 relay-account-forwarder 的同名判据同构（那边是消费上游流时的内部私有函数）。
 */
function isSseDoneFrame(line: string): boolean {
  const idx = line.indexOf(':')
  if (idx < 0) return false
  return line.slice(idx + 1).trim() === '[DONE]'
}

/**
 * 上游 OpenAI SSE 管道(双模式):
 * - verbatim(writeLine):逐行转发上游原始 data 行到客户端(OpenAI chunk 格式天然兼容,不改写)
 * - textMode(emitText):解析每个 delta.content 并回调(legacy /v1/completions 流式,由调用方自行组 text chunk)
 * 两种模式都聚合内容 + 末尾 usage chunk(prompt_tokens_details.cached_tokens / Anthropic cache 字段),
 * 返回聚合统计供调用方 recordCall 计费。
 *
 * 终止帧职责(2026-10-23 修):
 * 上游自带的 `data: [DONE]` **一律不转发**。流结束标记由调用方（统一收尾出口）发且只发一次。
 * 原实现 verbatim 转发上游 `[DONE]`，收尾又补一个 ⇒ 客户端收到**双终止帧**：
 * 严格实现（遇 [DONE] 即 dispose 流、或视二次 DONE 为协议错误）会提前截断或报错，
 * 宽松实现则白跑一轮解析。这不只影响账号池桥——任何自带 [DONE] 的 OpenAI 兼容上游都中招。
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
    sawFinish: false,
    lastFrameId: null,
    upstreamCredits: null,
  }
  const startedAt = Date.now()
  const reader = upstream.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const abort = () => void reader.cancel().catch(() => {})
  opts.signal?.addEventListener('abort', abort, { once: true })

  const handleLine = (line: string) => {
    // 终止帧不转发（见函数头注释：结束标记只由调用方发一次）
    if (isSseDoneFrame(line)) return
    if (!textMode) opts.writeLine?.(`${line}\n\n`)
    const json = parseSseData(line)
    if (!json) return
    if (stats.ttftMs === null) stats.ttftMs = Date.now() - startedAt
    // 记住上游帧 id，供调用方造收尾帧时复用它（同一条流只应有一个 id）
    if (typeof json['id'] === 'string' && json['id']) stats.lastFrameId = json['id']
    const choices = json['choices'] as Array<Record<string, unknown>> | undefined
    // 上游已给结束帧**且该帧确实被转发**⇒ 记下来，调用方收尾不再补（否则出现两个 finish）。
    // textMode 不转发原始行（由调用方按 text chunk 重发），故那里不算——收尾仍须补结束帧。
    if (
      !textMode &&
      Array.isArray(choices) &&
      choices.some((c) => c?.['finish_reason'] !== null && c?.['finish_reason'] !== undefined)
    ) {
      stats.sawFinish = true
    }
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
      // 积分计费上游（qoder）：token 恒 0，credits 才是真实扣减量
      const usageCredits = readFloat(usage['credits'])
      if (usageCredits !== null) stats.upstreamCredits = usageCredits
    }
    // 桥上把 credits 同时放在帧顶层（x_qoder_credits），usage 缺失时也能取到
    const frameCredits = readFloat(json['x_qoder_credits'])
    if (frameCredits !== null) stats.upstreamCredits = frameCredits
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
