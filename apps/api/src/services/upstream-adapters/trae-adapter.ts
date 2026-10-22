// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Trae CN(字节 AI IDE)上游适配器(2026-10-22 立)。
 *
 * 主路线:remote chat_sessions 两步会话(web 渠道,账号池友好)——
 *   1. POST {base}/chat_sessions           创建回合 → chat_session_id / message_id
 *   2. GET  {base}/chat_sessions/{id}/events?reply_to_message_id={mid}   SSE 拉流
 *   收尾 POST {base}/chat_sessions/{id}/stop 尽力而为,失败忽略(不阻塞主链路)
 *
 * Trae 是多段式协议 → 走 executeChat 整体执行入口(自管 fetch);
 * 单段式三件套(buildChatRequest/translateStreamChunk/translateNonStream)保留但直接抛错,
 * 转发层检测到 executeChat 存在就不会调它们。
 *
 * 401/403 自愈:创建/拉流任一请求命中鉴权失败 → 抛 TraeAuthFailureError,
 * 由转发层触发 refreshToken 后重试;适配器内部不循环重试。
 */
import { ProxyAgent, fetch as undiciFetch } from 'undici'
import type {
  AdapterAccountContext,
  AdapterCallOptions,
  ChatExecuteOptions,
  NormalizedChatRequest,
  RelayUpstreamAdapter,
  StreamState,
  TokenRefreshResult,
  TranslatedChunk,
  UpstreamChatResult,
  UpstreamHttpRequest,
} from '../relay-upstream-adapters.js'
import {
  buildExchangeTokenBody,
  deriveBizSessionId,
  extractErrorInfo,
  extractReasoningDelta,
  extractTextDelta,
  extractTokenPayload,
  extractUsage,
  flattenQuery,
  iterateSseEvents,
  normalizeEventName,
  TERMINAL_EVENT_NAMES,
  type OpenAiUsage,
} from './trae-protocol.js'

// =============================================================================
// 上游端点与 web 渠道指纹常量
// =============================================================================

/** remote 会话 API 基址(web 渠道,solo.trae.cn 前端同款) */
const TRAE_REMOTE_BASE = 'https://trae-api-cn.mchost.guru/api/remote/v1'
/** OAuth token 交换端点(无需 Authorization) */
const TRAE_EXCHANGE_TOKEN_URL = 'https://api.trae.cn/cloudide/api/v3/trae/oauth/ExchangeToken'
/** 模型列表端点(健康检查 + listModels 共用,轻量不耗配额) */
const TRAE_MODEL_LIST_URL = 'https://trae-api-cn.mchost.guru/api/ide/v1/model_list?type=chat'

const WEB_ORIGIN = 'https://solo.trae.cn'
const WEB_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36'

/** web 渠道请求头(全部必需;accept='sse' 时 events 请求用 Accept 替代 Content-Type) */
function buildWebHeaders(jwt: string, accept: 'json' | 'sse'): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Cloud-IDE-JWT ${jwt}`,
    'X-Trae-Client-Type': 'web',
    'X-Preferenced-Language': 'zh-CN',
    'x-user-region': 'CN',
    Origin: WEB_ORIGIN,
    Referer: `${WEB_ORIGIN}/`,
    'User-Agent': WEB_USER_AGENT,
  }
  if (accept === 'json') headers['Content-Type'] = 'application/json'
  else headers['Accept'] = 'text/event-stream'
  return headers
}

// =============================================================================
// 鉴权失败错误(转发层据此触发 refreshToken 重试)
// =============================================================================

/** Trae 上游 401/403 鉴权失败(跨 realm 判定用 name,不依赖 instanceof 唯一途径) */
export class TraeAuthFailureError extends Error {
  readonly statusCode: number
  constructor(statusCode: number, detail?: string) {
    super(`Trae 上游鉴权失败(HTTP ${statusCode})${detail ? `: ${detail.slice(0, 300)}` : ''}`)
    this.name = 'TraeAuthFailureError'
    this.statusCode = statusCode
  }
}

/** 是否为 Trae 鉴权失败错误(供转发层/测试判定) */
export function isTraeAuthFailure(e: unknown): boolean {
  if (e instanceof TraeAuthFailureError) return true
  return (
    typeof e === 'object' && e !== null && (e as { name?: unknown }).name === 'TraeAuthFailureError'
  )
}

// =============================================================================
// fetch 解析(测试缝 > 账号级代理 > 全局直连)
// =============================================================================

/** proxyUrl → ProxyAgent 进程内缓存(每账号代理一个连接池,避免重复建 agent) */
const proxyAgentCache = new Map<string, ProxyAgent>()

function makeProxiedFetch(proxyUrl: string): typeof fetch {
  let agent = proxyAgentCache.get(proxyUrl)
  if (!agent) {
    agent = new ProxyAgent(proxyUrl)
    proxyAgentCache.set(proxyUrl, agent)
  }
  const dispatcher = agent
  // 必须用 npm undici 自身的 fetch:Node 内置 fetch 与 npm undici 的 Dispatcher 不互通(见 utils/proxy-dispatcher.ts 同款教训)
  return ((input: string | URL, init?: RequestInit) =>
    undiciFetch(
      input as never,
      { ...(init ?? {}), dispatcher } as never,
    ) as unknown as Promise<Response>) as unknown as typeof fetch
}

/** 优先级:opts.fetchImpl(测试打桩)> opts.proxyUrl(账号级代理)> 全局直连 */
function resolveFetchImpl(opts: ChatExecuteOptions): typeof fetch {
  if (opts.fetchImpl) return opts.fetchImpl
  if (opts.proxyUrl) return makeProxiedFetch(opts.proxyUrl)
  return globalThis.fetch.bind(globalThis)
}

// =============================================================================
// 创建会话请求体
// =============================================================================

/**
 * 组装 chat_sessions 创建请求体。
 * - model="auto" → model_selection_strategy:"auto" 且 model_name 留空
 * - model 以 "-work" 结尾 → solo_work_remote 智能体 + mode:"work"
 * - biz_session_id 用账号+模型恒定派生值(上游按会话做风控/配额,严禁随机)
 */
function buildCreatePayload(
  accountId: string,
  req: NormalizedChatRequest,
): Record<string, unknown> {
  const model = req.model ?? ''
  const isWork = model.endsWith('-work')
  const isAuto = model === 'auto'
  const commonParams = {
    language: 'zh-cn',
    app_language: 'zh-CN',
    quality: 'stable',
    app_version: '1.0.0.1229',
    user_identity: 'Free',
    is_freshman: '0',
    scope: 'marscode-cn',
    tenant: 'marscode',
    region: 'cn',
    aiRegion: 'CN',
    is_privacy_mode: 0,
    privacy_mode: 'off',
    solo_chat_mode: 'code',
    biz_session_id: deriveBizSessionId(accountId, model),
  }
  return {
    mode: isWork ? 'work' : 'code',
    environment_id: 'default',
    env: 'remote',
    auto_create_project: false,
    origin: 'web',
    initial_message: {
      chat_session_id: '',
      content: [],
      query: flattenQuery(req.messages),
      model_name: isAuto ? '' : model,
      agent_type: isWork ? 'solo_work_remote' : 'solo_agent_remote',
      agent_id: isWork ? 'solo_work_remote' : 'solo_agent_remote',
      model_selection_strategy: isAuto ? 'auto' : 'manual',
      common_params: JSON.stringify(commonParams),
    },
  }
}

// =============================================================================
// 响应辅助
// =============================================================================

/** 非 2xx 统一处理:读 body 文本 → 401/403 抛鉴权错,其余抛带状态码与截断 body 的富分类错 */
async function failIfNotOk(res: Response, action: string): Promise<void> {
  if (res.ok) return
  const text = await res.text().catch(() => '')
  if (res.status === 401 || res.status === 403) {
    throw new TraeAuthFailureError(res.status, text)
  }
  throw new TraeUpstreamError(
    res.status,
    `Trae ${action} 失败(HTTP ${res.status})${text ? `: ${text.slice(0, 500)}` : ''}`,
  )
}

/** 从创建响应里宽松取 chat_session_id / message_id(兼容 data 包裹与顶层) */
function extractSessionIds(body: unknown): { chatSessionId: string; messageId: string } {
  const top = (body ?? {}) as Record<string, unknown>
  const data =
    top.data !== null && typeof top.data === 'object' ? (top.data as Record<string, unknown>) : top
  const chatSessionId =
    typeof data.chat_session_id === 'string'
      ? data.chat_session_id
      : typeof top.chat_session_id === 'string'
        ? top.chat_session_id
        : ''
  const messageId =
    typeof data.message_id === 'string'
      ? data.message_id
      : typeof top.message_id === 'string'
        ? top.message_id
        : ''
  if (!chatSessionId || !messageId) {
    throw new Error('Trae 创建会话响应缺少 chat_session_id/message_id')
  }
  return { chatSessionId, messageId }
}

// =============================================================================
// 事件流 → OpenAI chunk 翻译
// =============================================================================

interface ChunkMeta {
  id: string
  model: string
  created: number
}

/** 标准 chat.completion.chunk 公共头部字段 */
function chunkBase(meta: ChunkMeta): Record<string, unknown> {
  return {
    id: meta.id,
    object: 'chat.completion.chunk',
    created: meta.created,
    model: meta.model,
  }
}

/**
 * Trae SSE 事件 → OpenAI chunk 异步序列。
 *
 * - 文本/推理增量 → delta 帧
 * - token_usage 帧 → usage 终帧(choices:[] + usage)
 * - error 帧(event:error 或 code/error/detail 形状)→ 终止并抛错(带 code)
 * - [DONE]/done/response_done/stream_done → 终止
 * - 流提前断开没见 done → 兜底补 finish_reason stop 帧([DONE] 由转发层统一补发)
 */
async function* translateUpstreamEvents(
  body: ReadableStream<Uint8Array>,
  meta: ChunkMeta,
): AsyncGenerator<Record<string, unknown>> {
  for await (const ev of iterateSseEvents(body)) {
    const name = normalizeEventName(ev.event)
    const data = ev.data.trim()
    if (data === '[DONE]' || TERMINAL_EVENT_NAMES.has(name)) break

    let obj: Record<string, unknown> | null = null
    if (data !== '') {
      try {
        const parsed: unknown = JSON.parse(data)
        if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
          obj = parsed as Record<string, unknown>
        }
      } catch {
        obj = null // 非 JSON 帧:忽略,不中断流
      }
    }
    if (!obj) continue

    if (name === 'error') {
      const code = obj.code !== undefined && obj.code !== null ? String(obj.code) : 'unknown'
      throw new TraeUpstreamError(0, `Trae 上游错误帧(code=${code}): ${data.slice(0, 500)}`, code)
    }
    const err = extractErrorInfo(obj)
    if (err) {
      throw new TraeUpstreamError(
        0,
        `Trae 上游错误帧(code=${err.code}): ${err.message || '未知错误'}`,
        err.code,
      )
    }

    const usage = extractUsage(obj, name)
    if (usage) {
      yield { ...chunkBase(meta), choices: [], usage }
      continue
    }

    const reasoning = extractReasoningDelta(obj)
    if (reasoning !== null) {
      yield {
        ...chunkBase(meta),
        choices: [{ index: 0, delta: { reasoning_content: reasoning }, finish_reason: null }],
      }
      continue
    }
    const text = extractTextDelta(obj)
    if (text !== null) {
      yield {
        ...chunkBase(meta),
        choices: [{ index: 0, delta: { content: text }, finish_reason: null }],
      }
    }
    // 其余事件(request_wait_in_queue / model_config 无增量等)忽略,不中断流
  }

  // 兜底/收尾:无论正常 done 还是流提前断开,都补 finish_reason stop 帧
  yield {
    ...chunkBase(meta),
    choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
  }
}

/** 在翻译序列外包一层"迭代结束即尽力 stop"的清理,失败一律忽略 */
function withStopCleanup(
  gen: AsyncGenerator<Record<string, unknown>>,
  stop: () => Promise<void>,
): AsyncGenerator<Record<string, unknown>> {
  return (async function* () {
    try {
      yield* gen
    } finally {
      await stop().catch(() => {})
    }
  })()
}

// =============================================================================
// 适配器
// =============================================================================

const MULTI_PATH_MSG = 'trae 走 executeChat 多段式路径'

export const traeAdapter: RelayUpstreamAdapter = {
  providerCode: 'trae',

  buildChatRequest(_ctx: AdapterAccountContext, _req: NormalizedChatRequest): UpstreamHttpRequest {
    throw new Error(MULTI_PATH_MSG)
  },

  translateStreamChunk(
    _ctx: AdapterAccountContext,
    _rawFrame: string,
    _state: StreamState,
  ): TranslatedChunk | null {
    throw new Error(MULTI_PATH_MSG)
  },

  translateNonStream(_ctx: AdapterAccountContext, _responseBody: unknown): Record<string, unknown> {
    throw new Error(MULTI_PATH_MSG)
  },

  /**
   * 多段式执行入口:创建回合 → 拉事件流 → 翻译为 OpenAI chunk 序列。
   * 非流式(req.stream=false)内部仍走流式再本地聚合(上游无同步端点)。
   */
  async executeChat(
    ctx: AdapterAccountContext,
    req: NormalizedChatRequest,
    opts: ChatExecuteOptions,
  ): Promise<UpstreamChatResult> {
    const fetchImpl = resolveFetchImpl(opts)
    const jwt = ctx.credentials.token
    const meta: ChunkMeta = {
      id: '',
      model: req.model,
      created: Math.floor(Date.now() / 1000),
    }

    // 第 1 步:创建回合
    const createRes = await fetchImpl(`${TRAE_REMOTE_BASE}/chat_sessions`, {
      method: 'POST',
      headers: buildWebHeaders(jwt, 'json'),
      body: JSON.stringify(buildCreatePayload(ctx.row.uid, req)),
      signal: opts.signal,
    })
    await failIfNotOk(createRes, '创建会话')
    const createBody: unknown = await createRes.json().catch(() => null)
    const { chatSessionId, messageId } = extractSessionIds(createBody)
    meta.id = chatSessionId

    // 第 2 步:拉事件流
    const eventsUrl = `${TRAE_REMOTE_BASE}/chat_sessions/${encodeURIComponent(chatSessionId)}/events?reply_to_message_id=${encodeURIComponent(messageId)}`
    const eventsRes = await fetchImpl(eventsUrl, {
      method: 'GET',
      headers: buildWebHeaders(jwt, 'sse'),
      signal: opts.signal,
    })
    await failIfNotOk(eventsRes, '拉取事件流')
    const streamBody = eventsRes.body
    if (!streamBody) throw new Error('Trae 事件流响应无 body')

    // 收尾 stop:尽力而为,失败忽略
    const stopUrl = `${TRAE_REMOTE_BASE}/chat_sessions/${encodeURIComponent(chatSessionId)}/stop`
    const stop = async (): Promise<void> => {
      await fetchImpl(stopUrl, {
        method: 'POST',
        headers: buildWebHeaders(jwt, 'json'),
        body: '{}',
      }).then(async (r) => {
        await r.body?.cancel()
      })
    }

    const chunkStream = withStopCleanup(
      translateUpstreamEvents(streamBody as ReadableStream<Uint8Array>, meta),
      stop,
    )

    if (req.stream) return { stream: chunkStream }

    // 非流式:本地聚合完整 completion
    let content = ''
    let reasoning = ''
    let usage: OpenAiUsage | null = null
    let finishReason = 'stop'
    for await (const chunk of chunkStream) {
      const u = chunk.usage
      if (u !== null && typeof u === 'object') usage = u as OpenAiUsage
      const choices = chunk.choices
      if (Array.isArray(choices)) {
        for (const raw of choices) {
          const ch = raw as { delta?: Record<string, unknown>; finish_reason?: string | null }
          const deltaContent = ch.delta?.content
          if (typeof deltaContent === 'string') content += deltaContent
          const deltaReasoning = ch.delta?.reasoning_content
          if (typeof deltaReasoning === 'string') reasoning += deltaReasoning
          if (typeof ch.finish_reason === 'string' && ch.finish_reason !== '') {
            finishReason = ch.finish_reason
          }
        }
      }
    }
    const message: Record<string, unknown> = { role: 'assistant', content }
    if (reasoning !== '') message.reasoning_content = reasoning
    return {
      completion: {
        id: chatSessionId,
        object: 'chat.completion',
        created: meta.created,
        model: req.model,
        choices: [{ index: 0, message, finish_reason: finishReason }],
        usage: usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      },
    }
  },

  /**
   * Token 刷新:ExchangeToken 端点无 Authorization 头。
   * 无 refreshToken → null;HTTP 非 2xx 或响应无 Token → 抛错(调度器计数摘除)。
   * opts.proxyUrl 非空时走账号级代理(与 chat 同出口 IP,防 Trae 风控因 IP 漂移触发校验)。
   */
  async refreshToken(
    ctx: AdapterAccountContext,
    opts?: AdapterCallOptions,
  ): Promise<TokenRefreshResult | null> {
    const rt = ctx.credentials.refreshToken
    if (!rt) return null
    const doFetch = resolveFetchImpl(opts ?? {})
    const res = await doFetch(TRAE_EXCHANGE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildExchangeTokenBody(rt)),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new TraeUpstreamError(
        res.status,
        `Trae ExchangeToken 失败(HTTP ${res.status})${text ? `: ${text.slice(0, 300)}` : ''}`,
      )
    }
    const body: unknown = await res.json().catch(() => null)
    const payload = extractTokenPayload(body)
    if (!payload) throw new Error('Trae ExchangeToken 响应无 Token')
    return {
      token: payload.token,
      refreshToken: payload.refreshToken,
      // 上游未给/给不出可解析的过期时刻 → 保守兜底 24h(临期刷新 + 401 自愈双保险)
      expiresAt: payload.expiresAt ?? new Date(Date.now() + 24 * 3600_000),
    }
  },

  /** 轻量健康检查:model_list 端点 2xx 且响应含 model_configs[] */
  async checkHealth(
    ctx: AdapterAccountContext,
    opts?: AdapterCallOptions,
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await resolveFetchImpl(opts ?? {})(TRAE_MODEL_LIST_URL, {
        method: 'GET',
        headers: {
          Authorization: `Cloud-IDE-JWT ${ctx.credentials.token}`,
          Accept: 'application/json',
        },
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        return {
          ok: false,
          error: `model_list HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`,
        }
      }
      const configs = extractModelConfigs(await res.json().catch(() => null))
      if (!configs) return { ok: false, error: 'model_list 响应缺少 model_configs' }
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  },

  /** 模型列表:同健康检查端点,返回 model_configs[].name */
  async listModels(ctx: AdapterAccountContext, opts?: AdapterCallOptions): Promise<string[]> {
    const res = await resolveFetchImpl(opts ?? {})(TRAE_MODEL_LIST_URL, {
      method: 'GET',
      headers: {
        Authorization: `Cloud-IDE-JWT ${ctx.credentials.token}`,
        Accept: 'application/json',
      },
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new TraeUpstreamError(
        res.status,
        `Trae model_list 失败(HTTP ${res.status})${text ? `: ${text.slice(0, 300)}` : ''}`,
      )
    }
    const configs = extractModelConfigs(await res.json().catch(() => null)) ?? []
    return configs
      .map((c) => (typeof c?.name === 'string' ? c.name : null))
      .filter((n): n is string => n !== null && n !== '')
  },

  isAuthFailure(statusCode: number, bodyText: string): boolean {
    if (statusCode === 401 || statusCode === 403) return true
    const lower = bodyText.toLowerCase()
    return lower.includes('authentication_error') || lower.includes('unauthorized')
  },

  /** executeChat 抛出的 TraeAuthFailureError → 触发转发层刷新自愈 */
  isAuthError(err: unknown): boolean {
    return isTraeAuthFailure(err)
  },

  /** 富分类:与独立导出函数同源;network 归入 client(接口只接受 8 类) */
  classifyUpstreamFailure(statusCode: number, bodyText: string) {
    const kind = classifyUpstreamFailure(statusCode, bodyText)
    return { kind: kind === 'network' ? ('client' as const) : kind }
  },
}

/** 宽松取 model_configs(兼容顶层与 data 包裹) */
function extractModelConfigs(body: unknown): Array<Record<string, unknown>> | null {
  if (body === null || typeof body !== 'object') return null
  const top = body as Record<string, unknown>
  const candidates: unknown[] = [top.model_configs]
  if (top.data !== null && typeof top.data === 'object') {
    candidates.push((top.data as Record<string, unknown>).model_configs)
  }
  for (const c of candidates) {
    if (Array.isArray(c)) return c as Array<Record<string, unknown>>
  }
  return null
}

// =============================================================================
// 上游失败富分类(供转发层按语义冷却/摘除,不再一律归为 network)
// =============================================================================

/** 与 relay-account-forwarder.ts 的 FailureKind 保持一致 */
export type FailureKind =
  | 'auth'
  | 'credit'
  | 'session_dead'
  | 'rate'
  | 'not_found'
  | 'request'
  | 'server'
  | 'client'
  | 'network'

/** 消息摘要里的敏感值打码(token/cookie 等键值);正文只保留可读片段 */
function redactUpstreamSummary(text: string): string {
  return text.replace(
    /("?(?:access_token|refresh_token|token|cookie|authorization)"?\s*[:=]\s*"?)([^"\s,;}]+)/gi,
    '$1***',
  )
}

/**
 * Trae 上游非鉴权失败(带 HTTP 状态码与可选上游业务码)。
 * 无 HTTP 状态时 statusCode=0(典型:SSE error 帧);消息截断 500 字防泄漏/防日志膨胀。
 */
export class TraeUpstreamError extends Error {
  readonly statusCode: number
  readonly upstreamCode?: number | string

  constructor(statusCode: number, message: string, upstreamCode?: number | string) {
    super(redactUpstreamSummary(message).slice(0, 500))
    this.name = 'TraeUpstreamError'
    this.statusCode = statusCode
    this.upstreamCode = upstreamCode
  }
}

const CREDIT_HINTS = ['额度', '积分', 'quota', 'insufficient', 'balance'] as const
const SESSION_DEAD_HINTS = [
  '登录失效',
  '请重新登录',
  'login required',
  'session expired',
  'token expired',
  '未授权',
  '会话过期',
] as const
const REQUEST_HINTS = [
  '参数',
  '长度',
  'context length',
  'invalid',
  'unsupported',
  '审核',
  '敏感',
] as const

function hitsAny(lowerText: string, hints: readonly string[]): boolean {
  return hints.some((h) => lowerText.includes(h))
}

/**
 * 上游失败分类:先按文本判 credit/session_dead(避免被 400 等状态掩盖),再按状态码。
 * 0 状态且文本无命中 → network;其余未知 → client。
 */
export function classifyUpstreamFailure(status: number, bodyText: string): FailureKind {
  const lower = bodyText.toLowerCase()
  if (hitsAny(lower, CREDIT_HINTS)) return 'credit'
  if (hitsAny(lower, SESSION_DEAD_HINTS)) return 'session_dead'

  if (status === 401 || status === 403) return 'auth'
  if (status === 429) return 'rate'
  if (status === 404) return 'not_found'
  if (status === 402) return 'credit'
  if (status >= 500 && status <= 599) return 'server'
  if (status === 400 || status === 413 || status === 422) return 'request'
  if (hitsAny(lower, REQUEST_HINTS)) return 'request'
  if (status === 0) return 'network'
  return 'client'
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
