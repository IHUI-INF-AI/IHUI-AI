// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​‌​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 渠道直连转发器(2026-09-12 立)。
 *
 * 职责:
 * 1. forwardToChannel(...):调 selectChannelKey 选 key → 直连上游 OpenAI 兼容端点
 *    → 候选间逐请求 failover(失败记熔断后换 key 重试,最多 MAX_FAILOVER_ATTEMPTS 次)
 * 2. pipeChannelStream(response, {...}):流式响应管道转发(verbatim / legacy text 两种模式)
 *    并统计 responseText / usage / cache tokens / TTFT,供计费层使用
 *
 * 与 ai-service 链路的关系:本模块任何失败(无渠道/全候选失败/异常)由调用方回退
 * ai-service 既有链路,不在此处兜底。
 */

import {
  selectChannelKey,
  recordChannelResult,
  trackConnectionStart,
  trackConnectionEnd,
  type SelectedChannelKey,
} from './relay-channel-router.js'

/** 单请求内候选 key 逐次 failover 的最大尝试次数(候选失败换 key 重试)。 */
const MAX_FAILOVER_ATTEMPTS = 3

/** 拼接上游 chat/completions 端点(兼容 baseUrl 带/不带 /v1 后缀两种写法)。 */
function buildUpstreamUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, '')
  return trimmed.endsWith('/v1')
    ? `${trimmed}/chat/completions`
    : `${trimmed}/v1/chat/completions`
}

/** 从 usage 对象解析 cache_read / cache_creation tokens(OpenAI/Anthropic 双风格)。 */
function parseCacheTokens(usage: unknown): {
  cacheReadTokens: number
  cacheCreationTokens: number
} {
  if (!usage || typeof usage !== 'object') return { cacheReadTokens: 0, cacheCreationTokens: 0 }
  const u = usage as Record<string, unknown>
  const details = u.prompt_tokens_details as Record<string, unknown> | undefined
  const openaiCached =
    typeof details?.cached_tokens === 'number' ? Math.max(0, Math.floor(details.cached_tokens)) : 0
  const anthropicRead =
    typeof u.cache_read_input_tokens === 'number'
      ? Math.max(0, Math.floor(u.cache_read_input_tokens))
      : 0
  const anthropicCreation =
    typeof u.cache_creation_input_tokens === 'number'
      ? Math.max(0, Math.floor(u.cache_creation_input_tokens))
      : 0
  return {
    cacheReadTokens: Math.max(openaiCached, anthropicRead),
    cacheCreationTokens: anthropicCreation,
  }
}

export interface ForwardToChannelOptions {
  model: string
  /** OpenAI 协议 messages 数组(上游原样透传) */
  messages: unknown[]
  temperature?: number
  maxTokens?: number
  stream: boolean
  responseFormat?: unknown
  seed?: number
  userId?: string
  /** session-affinity 亲和性 key(userId / api_key_id) */
  affinityKey?: string
  /** 参数覆盖系统处理后的最终 body(传入时忽略其余 body 字段) */
  bodyOverride?: Record<string, unknown>
  signal?: AbortSignal
}

export type ForwardToChannelResult =
  | { ok: true; response: Response; channel: SelectedChannelKey }
  | { ok: false }
  | null

/**
 * 渠道直连转发(非流式与流式统一入口)。
 *
 * - 返回 null:该模型无任何可用渠道配置(调用方回退 ai-service)
 * - 返回 {ok:false}:有渠道但全部候选失败(调用方回退 ai-service)
 * - 返回 {ok:true,response,channel}:拿到上游 Response,由调用方消费
 *   (非流式直接 resp.json();流式走 pipeChannelStream)
 */
export async function forwardToChannel(
  opts: ForwardToChannelOptions,
): Promise<ForwardToChannelResult> {
  for (let attempt = 0; attempt < MAX_FAILOVER_ATTEMPTS; attempt++) {
    const channel = await selectChannelKey(opts.model, opts.userId, opts.affinityKey)
    if (!channel) {
      // 首次无渠道 → 该模型未接 relay;重试中出现则视为候选耗尽
      return attempt === 0 ? null : { ok: false }
    }

    const body =
      opts.bodyOverride ??
      ({
        model: opts.model,
        messages: opts.messages,
        stream: opts.stream,
        ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
        ...(opts.maxTokens !== undefined ? { max_tokens: opts.maxTokens } : {}),
        ...(opts.responseFormat !== undefined ? { response_format: opts.responseFormat } : {}),
        ...(opts.seed !== undefined ? { seed: opts.seed } : {}),
      } satisfies Record<string, unknown>)

    const startedAt = Date.now()
    trackConnectionStart(channel.keyPoolId)
    try {
      const resp = await fetch(buildUpstreamUrl(channel.baseUrl), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: opts.stream ? 'text/event-stream' : 'application/json',
          Authorization: `Bearer ${channel.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: opts.signal,
      })

      if (resp.ok) {
        await recordChannelResult(channel.keyPoolId, true, Date.now() - startedAt)
        return { ok: true, response: resp, channel }
      }

      // 4xx(除 429)多为请求本身问题(参数/鉴权),换 key 无意义 → 直接终止
      await recordChannelResult(channel.keyPoolId, false, Date.now() - startedAt)
      if (resp.status >= 400 && resp.status < 500 && resp.status !== 429) {
        // 消费掉 body 防止连接泄漏
        await resp.arrayBuffer().catch(() => undefined)
        return { ok: false }
      }
      await resp.arrayBuffer().catch(() => undefined)
      // 429 / 5xx → 换下一个候选(熔断器会记录失败,最终 open)
    } catch {
      await recordChannelResult(channel.keyPoolId, false, Date.now() - startedAt).catch(
        () => undefined,
      )
      // 网络异常 → 换下一个候选
    } finally {
      trackConnectionEnd(channel.keyPoolId)
    }
  }
  return { ok: false }
}

export interface PipeChannelStreamOptions {
  /** verbatim 模式:整帧 SSE(含 data: 前缀与结尾空行)原样转发 */
  writeLine?: (frame: string) => void
  /** legacy text 模式:仅提取增量文本回调(调用方自行组装 chunk) */
  emitText?: (text: string) => void
  signal?: AbortSignal
}

export interface PipeChannelStreamStats {
  responseText: string
  promptTokens: number
  completionTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
  /** 首 token 延迟(ms);无任何内容 token 时为 null */
  ttftMs: number | null
  httpStatus: number
}

/**
 * 流式响应管道转发 + 用量统计。
 *
 * 逐帧读取上游 SSE:
 * - writeLine 存在 → 整帧原样转发(verbatim)
 * - emitText 存在 → 解析 choices[0].delta.content 增量回调(legacy text)
 * - 解析 usage 帧(OpenAI stream_options.include_usage / Anthropic usage)统计 tokens
 * - 统计 TTFT(首个 delta.content 到达时间 - 流开始时间)
 */
export async function pipeChannelStream(
  response: Response,
  opts: PipeChannelStreamOptions,
): Promise<PipeChannelStreamStats> {
  const stats: PipeChannelStreamStats = {
    responseText: '',
    promptTokens: 0,
    completionTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    ttftMs: null,
    httpStatus: response.status,
  }
  if (!response.body) return stats

  const startedAt = Date.now()
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const handleUsage = (usage: unknown): void => {
    if (!usage || typeof usage !== 'object') return
    const u = usage as Record<string, unknown>
    const num = (v: unknown): number => (typeof v === 'number' && v >= 0 ? Math.floor(v) : 0)
    stats.promptTokens = num(u.prompt_tokens) || num(u.input_tokens)
    stats.completionTokens = num(u.completion_tokens) || num(u.output_tokens)
    const cache = parseCacheTokens(u)
    stats.cacheReadTokens = cache.cacheReadTokens
    stats.cacheCreationTokens = cache.cacheCreationTokens
  }

  const handleFrame = (frame: string): void => {
    const lines = frame.split('\n')
    const dataLines = lines.filter((l) => l.startsWith('data:'))
    for (const raw of dataLines) {
      const data = raw.slice(5).trim()
      if (!data || data === '[DONE]') continue
      try {
        const json = JSON.parse(data) as Record<string, unknown>
        if (json.usage) handleUsage(json.usage)
        if (opts.emitText) {
          const choices = json.choices as Array<Record<string, unknown>> | undefined
          const delta = choices?.[0]?.delta as Record<string, unknown> | undefined
          const text = delta?.content
          if (typeof text === 'string' && text.length > 0) {
            if (stats.ttftMs === null) stats.ttftMs = Date.now() - startedAt
            stats.responseText += text
            opts.emitText(text)
          }
          // 非 delta 格式(fallback:message.content)
          if (text === undefined) {
            const message = choices?.[0]?.message as Record<string, unknown> | undefined
            const mc = message?.content
            if (typeof mc === 'string' && mc.length > 0) {
              if (stats.ttftMs === null) stats.ttftMs = Date.now() - startedAt
              stats.responseText += mc
              opts.emitText(mc)
            }
          }
        }
      } catch {
        /* 非 JSON data 行(注释/心跳)忽略 */
      }
    }
    if (opts.writeLine) opts.writeLine(frame.endsWith('\n\n') ? frame : `${frame}\n\n`)
  }

  try {
    for (;;) {
      if (opts.signal?.aborted) break
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      // SSE 帧以空行分隔
      let idx: number
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, idx)
        buffer = buffer.slice(idx + 2)
        if (frame.trim().length > 0) handleFrame(frame)
      }
    }
    // 残余缓冲(无结尾空行的最后一帧)
    if (buffer.trim().length > 0) handleFrame(buffer)
  } catch {
    // 上游中断/客户端 abort:已转发部分照常结算
  } finally {
    reader.releaseLock()
  }
  return stats
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​‌​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
