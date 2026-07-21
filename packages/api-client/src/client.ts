import type { ApiResult, ApiResponse } from '@ihui/types'
import { type CircuitBreaker, CircuitOpenError } from './circuit-breaker.js'

export interface TokenProvider {
  getToken(): string | null
}

/** fetchApi 扩展选项:在 RequestInit 基础上追加 `params`(自动拼 query string) */
export type FetchApiOptions = RequestInit & {
  params?: Record<string, string | number | boolean | undefined | null>
}

let tokenProvider: TokenProvider = { getToken: () => null }
let baseUrl: string = ''
let circuitBreaker: CircuitBreaker | null = null

export function setTokenProvider(provider: TokenProvider): void {
  tokenProvider = provider
}

export function setBaseUrl(url: string): void {
  baseUrl = url.replace(/\/$/, '')
}

/** 注入全局熔断器(null 表示禁用,所有请求直连) */
export function setCircuitBreaker(cb: CircuitBreaker | null): void {
  circuitBreaker = cb
}

/** 读取当前注入的熔断器实例(测试与诊断用) */
export function getCircuitBreaker(): CircuitBreaker | null {
  return circuitBreaker
}

/** 读取当前 token(供需要原生 fetch 的场景使用,如 SSE 流式) */
export function getToken(): string | null {
  return tokenProvider.getToken()
}

/** 规范化 URL(供需要原生 fetch 的场景使用) */
export function normalizeUrlPublic(url: string): string {
  return normalizeUrl(url)
}

function normalizeUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url
  const normalized = (() => {
    if (url.startsWith('/api/') || url.startsWith('/uploads/') || url.startsWith('/ws/')) return url
    if (url.startsWith('/cozeZhsApi')) {
      return url.replace(/^\/cozeZhsApi/, '/api')
    }
    if (url.startsWith('/')) return `/api${url}`
    return `/api/${url}`
  })()
  return baseUrl ? `${baseUrl}${normalized}` : normalized
}

/**
 * 内部:执行一次 fetch 并解析为 ApiResult。
 *
 * 失败语义(供 CircuitBreaker 计样本):
 *   - 5xx 响应:抛 HttpError(带 status / errorCode / retryAfter),由外层转 ApiResult
 *   - 网络异常:抛原始 Error
 *   - 4xx 响应:返回 ApiResult(success=false),不抛错(业务错误不算服务不可用)
 *   - 2xx 但 code !== 0:返回 ApiResult(success=false),不抛错
 *   - 2xx 且 code === 0:返回 ApiResult(success=true)
 *
 * AbortError:抛回给外层统一处理(无论是否有 breaker)。
 */
async function fetchOnce<T>(
  normalizedUrl: string,
  options: RequestInit,
  headers: Record<string, string>,
): Promise<ApiResult<T>> {
  const response = await fetch(normalizedUrl, { ...options, headers, signal: options.signal })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    let errorCode: string | undefined
    let message = text || `请求失败（${response.status}）`
    try {
      const parsed = JSON.parse(text)
      if (parsed && typeof parsed.message === 'string') message = parsed.message
      if (parsed && typeof parsed.errorCode === 'string') errorCode = parsed.errorCode
    } catch {
      // 非 JSON 响应,保留 text 作为 message
    }
    const retryAfterHeader = response.headers.get('retry-after')
    const retryAfter = retryAfterHeader ? Number(retryAfterHeader) : undefined
    const retryAfterValue = retryAfter && Number.isFinite(retryAfter) ? retryAfter : undefined

    // 5xx 视为服务不可用:有 breaker 时抛错让熔断器计失败样本;无 breaker 时也抛,由外层统一处理
    if (response.status >= 500) {
      const err = new Error(message) as Error & {
        status: number
        errorCode?: string
        retryAfter?: number
      }
      err.status = response.status
      if (errorCode) err.errorCode = errorCode
      if (retryAfterValue !== undefined) err.retryAfter = retryAfterValue
      throw err
    }

    // 4xx:业务错误,返回 ApiResult,不计 breaker 失败样本
    return {
      success: false,
      error: message,
      status: response.status,
      errorCode,
      retryAfter: retryAfterValue,
    }
  }

  const json = (await response.json()) as ApiResponse<T>

  if (json.code !== 0) {
    return {
      success: false,
      error: json.message || '请求失败',
      status: response.status,
      errorCode: json.errorCode,
    }
  }

  return { success: true, data: json.data }
}

/** ApiResult 失败分支类型(用于错误归一化) */
type ApiFailure = Extract<ApiResult<unknown>, { success: false }>

/** 把内部抛出的错误归一化为 ApiFailure(CircuitOpenError 由调用方处理) */
function normalizeErrorToResult(err: unknown): ApiFailure {
  if (err instanceof DOMException && err.name === 'AbortError') {
    return { success: false, error: '请求已取消' }
  }
  const errAny = err as Error & { status?: number; errorCode?: string; retryAfter?: number }
  if (typeof errAny.status === 'number') {
    return {
      success: false,
      error: errAny.message,
      status: errAny.status,
      errorCode: errAny.errorCode,
      retryAfter: errAny.retryAfter,
    }
  }
  return {
    success: false,
    error: err instanceof Error ? err.message : '网络异常',
  }
}

export async function fetchApi<T>(
  url: string,
  options: FetchApiOptions = {},
): Promise<ApiResult<T>> {
  const token = tokenProvider.getToken()
  const { params, ...restOptions } = options
  let normalizedUrl = normalizeUrl(url)
  if (params) {
    const qs = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        qs.append(key, String(value))
      }
    }
    const qsString = qs.toString()
    if (qsString) {
      normalizedUrl += (normalizedUrl.includes('?') ? '&' : '?') + qsString
    }
  }

  const isFormData = typeof FormData !== 'undefined' && restOptions.body instanceof FormData
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(restOptions.headers as Record<string, string> | undefined),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  // 无 breaker:保留原始重试策略(maxRetries=1)
  if (!circuitBreaker) {
    const maxRetries = 1
    let lastError = '网络异常'

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fetchOnce<T>(normalizedUrl, restOptions, headers)
      } catch (err) {
        // AbortError:用户主动取消,直接返回,不重试
        if (err instanceof DOMException && err.name === 'AbortError') {
          return { success: false, error: '请求已取消' }
        }
        const result = normalizeErrorToResult(err)
        // 5xx / 4xx(已带 status):直接返回,不重试
        if (result.status !== undefined) {
          return result as ApiResult<T>
        }
        // 网络异常:重试或返回 lastError
        lastError = result.error
        if (attempt < maxRetries) continue
      }
    }

    return { success: false, error: lastError }
  }

  // 有 breaker:每次 fetchApi 计 1 个 breaker 样本(不内部重试,避免重复计样本)
  try {
    return await circuitBreaker.execute(async () => {
      return await fetchOnce<T>(normalizedUrl, restOptions, headers)
    })
  } catch (err) {
    if (err instanceof CircuitOpenError) throw err
    return normalizeErrorToResult(err) as ApiResult<T>
  }
}

export async function fetchText(url: string, options: RequestInit = {}): Promise<string> {
  const token = tokenProvider.getToken()
  const normalizedUrl = normalizeUrl(url)
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const response = await fetch(normalizedUrl, { ...options, headers, signal: options.signal })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`${response.status}: ${text}`)
  }
  return response.text()
}

// ==================== SSE 流式对话 ====================

export interface StreamChatOptions {
  model: string
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
  signal?: AbortSignal
  onDelta: (delta: string) => void
  onError?: (error: string) => void
  onDone?: () => void
  onReasoning?: (delta: string) => void
  /** 后端自动压缩上下文(88% 阈值触发)时回调,前端可 toast 提示用户 */
  onCompaction?: (info: {
    tokensBefore: number
    tokensAfter: number
    removedCount: number
    usageRatio: number
  }) => void
  /** AI 主动提问回调:LLM 在流中输出 [[ASK_USER:JSON]] 标记时触发,前端弹窗让用户回答 */
  onQuestion?: (question: {
    questionId: string
    prompt: string
    options: Array<{ id: string; label: string }>
    allowCustom: boolean
    allowMultiple: boolean
  }) => void
  metadata?: { conversationId?: string; userId?: string; messageId?: string }
  temperature?: number
  topP?: number
  topK?: number
  maxTokens?: number
  stop?: string[]
  /** 当前绑定的本地工作区路径(从 useAiPanelStore.activeWorkspace.path 取)。
   * 透传到后端用于注入 CLAUDE.md/AGENTS.md 项目记忆作为 system prompt。
   * 无绑定时为 undefined,后端使用默认 system prompt。 */
  workspacePath?: string
  /** 模型上下文窗口大小(tokens),达 88% 阈值自动压缩(跨端统一)。
   * 由 use-chat.ts 调 getModelContextCapacity(model) 取得,后端不传则不压缩。 */
  contextLimit?: number
  /** SSE 端点路径(默认 /ai/chat/stream)。
   * 用户回答 AI 主动提问后续流走 /ai/chat/answer,需配合 extraBody 传 questionId + answer。 */
  path?: string
  /** 透传到请求 body 的额外字段(如 /chat/answer 的 questionId / answer)。 */
  extraBody?: Record<string, unknown>
}

export function parseStreamLine(line: string): string | null {
  if (!line || line.startsWith(':')) return null
  let data = line
  if (line.startsWith('data:')) {
    data = line.slice(5).replace(/^\s/, '')
  } else if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) {
    return null
  }
  if (data === '[DONE]') return null
  // Vercel AI SDK data-stream protocol: `TYPE:JSON`（type 0 = 文本 token，其他类型目前忽略）
  const proto = data.match(/^(\d+):(.*)$/s)
  if (proto?.[1] !== undefined) {
    if (proto[1] === '0') {
      try {
        const parsed = JSON.parse(proto[2]!)
        if (typeof parsed === 'string') return parsed
      } catch {
        /* fallthrough */
      }
    }
    return null
  }
  try {
    const json = JSON.parse(data)
    if (json?.type === 'error' && typeof json?.message === 'string') {
      throw attachErrorMeta(new Error(json.message), json)
    }
    if (json?.error === true && typeof json?.error_message === 'string') {
      throw attachErrorMeta(new Error(json.error_message), json)
    }
    if (json?.error && typeof json?.error === 'string') {
      // OpenAI 错误格式:{ "error": { "message": "...", "code": "..." } } / { "error": "rate limit", "code": 429 }
      const e = new Error(
        typeof json.error === 'string' ? json.error : (json.error.message ?? 'AI 服务异常'),
      )
      throw attachErrorMeta(e, json)
    }
    if (json?.type === 'reasoning') return null
    const choice = json?.choices?.[0]
    const delta =
      choice?.delta?.content ??
      choice?.message?.content ??
      json?.content ??
      json?.delta ??
      json?.text
    return typeof delta === 'string' ? delta : null
  } catch (e) {
    if (e instanceof SyntaxError) return data
    throw e
  }
}

function attachErrorMeta(err: Error, json: Record<string, unknown>): Error {
  err.name = 'SSEError'
  const code =
    typeof json.code === 'number'
      ? json.code
      : typeof json.statusCode === 'number'
        ? json.statusCode
        : typeof json.status === 'number'
          ? json.status
          : undefined
  if (code !== undefined) (err as Error & { code: number }).code = code
  if (typeof json.errorCode === 'string') {
    ;(err as Error & { errorCode: string }).errorCode = json.errorCode
  }
  if (typeof json.retryAfter === 'number') {
    ;(err as Error & { retryAfter: number }).retryAfter = json.retryAfter
  }
  return err
}

export function parseStreamLineReasoning(line: string): string | null {
  if (!line || line.startsWith(':')) return null
  let data = line
  if (line.startsWith('data:')) {
    data = line.slice(5).replace(/^\s/, '')
  } else if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) {
    return null
  }
  if (data === '[DONE]') return null
  try {
    const json = JSON.parse(data)
    if (json?.type === 'error' && typeof json?.message === 'string') {
      const e = new Error(json.message)
      e.name = 'SSEError'
      throw e
    }
    if (json?.error === true && typeof json?.error_message === 'string') {
      const e = new Error(json.error_message)
      e.name = 'SSEError'
      throw e
    }
    if (json?.type === 'reasoning' && typeof json?.content === 'string') return json.content
    const choice = json?.choices?.[0]
    const reasoning =
      choice?.delta?.reasoning_content ?? choice?.message?.reasoning_content ?? json?.reasoning
    return typeof reasoning === 'string' ? reasoning : null
  } catch (e) {
    if (e instanceof SyntaxError) return null
    throw e
  }
}

/**
 * 错误码元信息 — 从 Error 对象 / 错误 JSON / 状态码中提取的结构化字段。
 *
 * 跨端使用:`web` / `mobile-rn` / `desktop` / `extension` / `CLI` / `miniapp-taro`
 * 都通过 `getSSEErrorInfo` 统一提取,再用 `formatSSEError` 渲染为用户可见文本。
 */
export interface SSEErrorInfo {
  code?: number
  errorCode?: string
  retryAfter?: number
}

/**
 * 错误严重等级 — 用于决定不同 UI 交互:
 * - `auth`     → 跳登录弹窗
 * - `forbidden`→ Toast 提示权限不足
 * - `ratelimit`→ Toast 提示稍后重试(可能附带 retryAfter)
 * - `safety`   → Toast 提示内容被 AI 厂商安全策略拦截(非项目违规判定)
 * - `server`   → Toast 提示服务异常,可重试
 * - `network`  → Toast 提示网络问题
 * - `unknown`  → 兜底 Toast
 */
export type SSEErrorSeverity =
  'auth' | 'forbidden' | 'ratelimit' | 'safety' | 'server' | 'network' | 'unknown'

export interface FormattedSSEError {
  code?: number
  errorCode?: string
  retryAfter?: number
  severity: SSEErrorSeverity
  title: string
  message: string
  rawMessage: string
  requireReauth: boolean
}

function asString(v: unknown): string | undefined {
  if (typeof v === 'string' && v.length > 0) return v
  return undefined
}

function asNumber(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return undefined
}

/**
 * 从错误对象 / 字符串 / 任意异常中提取 SSE 错误元信息。
 *
 * 兼容多种数据源:
 * 1. `Error` 对象挂载的 `code` / `errorCode` / `retryAfter` 字段(由各端 SSE 解析器填充)
 * 2. 错误消息文本中的"请求失败(401)"格式回退
 * 3. 字符串中嵌入的 `code=XXX` / `errorCode=XXX` 模式
 */
export function getSSEErrorInfo(err: unknown): SSEErrorInfo | undefined {
  if (!err) return undefined
  const out: SSEErrorInfo = {}
  const sources: unknown[] = []
  if (err instanceof Error) {
    sources.push(err)
    if (err.message) sources.push(err.message)
    const anyErr = err as Error & Record<string, unknown>
    if (anyErr.code !== undefined) sources.push({ code: anyErr.code })
    if (anyErr.statusCode !== undefined) sources.push({ statusCode: anyErr.statusCode })
    if (anyErr.errorCode !== undefined) sources.push({ errorCode: anyErr.errorCode })
    if (anyErr.retryAfter !== undefined) sources.push({ retryAfter: anyErr.retryAfter })
  } else if (typeof err === 'string') {
    sources.push(err)
  } else {
    sources.push(err)
  }

  for (const src of sources) {
    if (typeof src === 'string') {
      const m = src.match(/[（(](\d{3})[)）]/)
      if (m && out.code === undefined) {
        const n = Number(m[1])
        if (Number.isFinite(n)) out.code = n
      }
      const codeMatch = src.match(/code=([0-9]{3})/)
      if (codeMatch && out.code === undefined) {
        const n = Number(codeMatch[1])
        if (Number.isFinite(n)) out.code = n
      }
      const errCodeMatch = src.match(/errorCode=([A-Z0-9_]+)/)
      if (errCodeMatch && out.errorCode === undefined) {
        out.errorCode = errCodeMatch[1]
      }
      continue
    }
    if (typeof src !== 'object' || src === null) continue
    const obj = src as Record<string, unknown>
    if (out.code === undefined) {
      const c = asNumber(obj.code) ?? asNumber(obj.statusCode) ?? asNumber(obj.status)
      if (c !== undefined) out.code = c
    }
    if (out.errorCode === undefined) {
      const ec = asString(obj.errorCode) ?? asString(obj.error_code)
      if (ec) out.errorCode = ec
    }
    if (out.retryAfter === undefined) {
      const r = asNumber(obj.retryAfter) ?? asNumber(obj.retry_after)
      if (r !== undefined) out.retryAfter = r
    }
  }

  if (out.code === undefined && out.errorCode === undefined && out.retryAfter === undefined) {
    return undefined
  }
  return out
}

/**
 * 把任意异常/错误消息规范化为用户可见的格式化错误。
 *
 * 用法:
 * ```ts
 * try {
 *   await streamChat(...)
 * } catch (err) {
 *   const f = formatSSEError(err)
 *   if (f.severity === 'auth') openLoginDialog()
 *   toast.error(f.title, { description: f.message })
 * }
 * ```
 */
export function formatSSEError(err: unknown, fallbackMessage = 'AI 服务异常'): FormattedSSEError {
  let rawMessage: string
  if (err instanceof Error) {
    rawMessage = err.message || fallbackMessage
  } else if (typeof err === 'string' && err.length > 0) {
    rawMessage = err
  } else if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message?: unknown }).message
    rawMessage = typeof m === 'string' && m.length > 0 ? m : fallbackMessage
  } else {
    rawMessage = fallbackMessage
  }

  const info = getSSEErrorInfo(err)
  const code = info?.code
  const errorCode = info?.errorCode
  const retryAfter = info?.retryAfter

  // 优先识别 LLM 厂商内容安全策略拦截关键词
  // 这些错误来自上游 LLM(Gemini/OpenAI/Anthropic),不是项目本身的违规判定
  // 识别后给出清晰提示,避免用户误以为是项目违规判定导致对话被自动结束
  const safetyHit = detectSafetyViolation(rawMessage, errorCode)
  if (safetyHit) {
    return {
      code,
      errorCode,
      retryAfter,
      severity: 'safety',
      title: '内容被 AI 厂商安全策略拦截',
      message: safetyHit,
      rawMessage,
      requireReauth: false,
    }
  }

  if (code === 401) {
    return {
      code,
      errorCode,
      retryAfter,
      severity: 'auth',
      title: '登录已过期',
      message: '登录已过期,请重新登录',
      rawMessage,
      requireReauth: true,
    }
  }
  if (code === 403) {
    return {
      code,
      errorCode,
      retryAfter,
      severity: 'forbidden',
      title: '访问被拒绝',
      message: '当前账户没有使用该 AI 模型的权限',
      rawMessage,
      requireReauth: false,
    }
  }
  if (code === 429) {
    const waitHint = retryAfter ? `${retryAfter} 秒后重试` : '请稍候再试'
    return {
      code,
      errorCode,
      retryAfter,
      severity: 'ratelimit',
      title: '请求过于频繁',
      message: `AI 服务请求频率超限,${waitHint}`,
      rawMessage,
      requireReauth: false,
    }
  }
  if (code !== undefined && code >= 500) {
    return {
      code,
      errorCode,
      retryAfter,
      severity: 'server',
      title: 'AI 服务异常',
      message: 'AI 服务暂时不可用,请稍后重试',
      rawMessage,
      requireReauth: false,
    }
  }
  if (code !== undefined && code >= 400) {
    return {
      code,
      errorCode,
      retryAfter,
      severity: 'server',
      title: '请求失败',
      message: rawMessage,
      rawMessage,
      requireReauth: false,
    }
  }
  if (err instanceof DOMException && err.name === 'AbortError') {
    return {
      code,
      errorCode,
      retryAfter,
      severity: 'network',
      title: '请求已取消',
      message: '请求已取消',
      rawMessage,
      requireReauth: false,
    }
  }
  const isNetwork = /network|fetch|timeout|abort|failed to fetch|err_network/i.test(rawMessage)
  return {
    code,
    errorCode,
    retryAfter,
    severity: isNetwork ? 'network' : 'unknown',
    title: isNetwork ? '网络异常' : 'AI 服务异常',
    message: isNetwork ? '网络连接失败,请检查网络后重试' : rawMessage,
    rawMessage,
    requireReauth: false,
  }
}

/**
 * 识别 LLM 厂商内容安全策略拦截关键词。
 *
 * 主流 LLM 厂商在内容被判定违规时会返回特定错误码/消息:
 * - OpenAI:    `content_policy_violation` / `content_policy` / 400 + "Your request was rejected as a result of our safety system"
 * - Anthropic: `output_length_stop` + "content filter" / 400 + "content that is unsafe"
 * - Gemini:    `SAFETY` / `RECITATION` / `BLOCKLIST` finishReason
 * - 通用:      "safety" / "policy" / "filtered" / "blocked" / "审查" / "违规"
 *
 * 命中返回清晰提示文案,未命中返回 null。
 * 该识别只针对上游 LLM 厂商的安全策略拦截,不是项目本身的违规判定。
 */
function detectSafetyViolation(message: string, errorCode?: string): string | null {
  const text = message.toLowerCase()
  const ec = (errorCode ?? '').toLowerCase()

  // Gemini finishReason
  if (/finishreason\s*=\s*safety/i.test(message)) {
    return '内容被 Gemini 安全策略拦截(SAFETY),请调整提问方式后重试'
  }
  if (/finishreason\s*=\s*recitation/i.test(message)) {
    return '内容被 Gemini 引用安全策略拦截(RECITATION),请减少大段引用后重试'
  }
  // OpenAI content_policy_violation
  if (ec === 'content_policy_violation' || text.includes('content_policy_violation')) {
    return '内容被 OpenAI 内容策略拦截,请调整提问方式后重试'
  }
  // Anthropic safety
  if (ec === 'safety_block' || (text.includes('"type":"error"') && text.includes('"safety"'))) {
    return '内容被 Anthropic 安全策略拦截,请调整提问方式后重试'
  }
  // 通用关键词兜底(需组合出现,避免误判普通错误)
  const safetyKeywords = [
    'safety',
    'content policy',
    'content filter',
    'safety system',
    'safety filter',
  ]
  const blockedKeywords = ['blocked', 'rejected', 'filtered']
  for (const sk of safetyKeywords) {
    if (text.includes(sk)) {
      for (const bk of blockedKeywords) {
        if (text.includes(bk)) {
          return '内容被 AI 厂商安全策略拦截,请调整提问方式后重试'
        }
      }
    }
  }
  return null
}

export async function streamChat(opts: StreamChatOptions): Promise<void> {
  const token = tokenProvider.getToken()
  const url = normalizeUrl(opts.path ?? '/ai/chat/stream')
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const body: Record<string, unknown> = { model: opts.model, messages: opts.messages }
  if (opts.metadata) body.metadata = opts.metadata
  if (opts.temperature !== undefined) body.temperature = opts.temperature
  if (opts.topP !== undefined) body.topP = opts.topP
  if (opts.topK !== undefined) body.topK = opts.topK
  if (opts.maxTokens !== undefined) body.maxTokens = opts.maxTokens
  if (opts.stop !== undefined) body.stop = opts.stop
  if (opts.workspacePath) body.workspacePath = opts.workspacePath
  if (opts.contextLimit !== undefined) body.contextLimit = opts.contextLimit
  if (opts.extraBody) Object.assign(body, opts.extraBody)

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: opts.signal,
    })
    if (!resp.ok || !resp.body) {
      const text = await resp.text().catch(() => '')
      let parsedBody: Record<string, unknown> | undefined
      try {
        if (text) parsedBody = JSON.parse(text) as Record<string, unknown>
      } catch {
        /* 非 JSON 响应忽略 */
      }
      const err = new Error(text || `请求失败（${resp.status}）`)
      ;(err as Error & { name: string }).name = 'SSEError'
      ;(err as Error & { code: number }).code = resp.status
      if (parsedBody) {
        const ec = parsedBody.errorCode
        if (typeof ec === 'string') {
          ;(err as Error & { errorCode: string }).errorCode = ec
        }
        const msg = parsedBody.message
        if (typeof msg === 'string' && msg) {
          err.message = `${msg}（${resp.status}）`
        }
      }
      const retryAfterHeader = resp.headers.get('retry-after')
      if (retryAfterHeader) {
        const n = Number(retryAfterHeader)
        if (Number.isFinite(n)) {
          ;(err as Error & { retryAfter: number }).retryAfter = n
        }
      }
      throw err
    }

    const reader = resp.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    const hasReasoning = typeof opts.onReasoning === 'function'
    const hasCompaction = typeof opts.onCompaction === 'function'
    const hasQuestion = typeof opts.onQuestion === 'function'

    const tryParseCompaction = (line: string): void => {
      if (!hasCompaction) return
      if (!line || line.startsWith(':')) return
      let data = line
      if (line.startsWith('data:')) {
        data = line.slice(5).replace(/^\s/, '')
      } else if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) {
        return
      }
      if (!data || data === '[DONE]') return
      try {
        const json = JSON.parse(data)
        if (json?.compaction?.triggered === true) {
          opts.onCompaction!({
            tokensBefore: Number(json.compaction.tokensBefore ?? 0),
            tokensAfter: Number(json.compaction.tokensAfter ?? 0),
            removedCount: Number(json.compaction.removedCount ?? 0),
            usageRatio: Number(json.compaction.usageRatio ?? 0),
          })
        }
      } catch {
        /* 非 JSON 或非 compaction 事件忽略 */
      }
    }

    const tryParseQuestion = (line: string): void => {
      if (!hasQuestion) return
      if (!line || line.startsWith(':')) return
      let data = line
      if (line.startsWith('data:')) {
        data = line.slice(5).replace(/^\s/, '')
      } else if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) {
        return
      }
      if (!data || data === '[DONE]') return
      try {
        const json = JSON.parse(data)
        if (json?.type === 'question' && json?.question?.questionId) {
          const q = json.question
          opts.onQuestion!({
            questionId: String(q.questionId),
            prompt: String(q.prompt ?? ''),
            options: Array.isArray(q.options)
              ? q.options
                  .filter((o: unknown) => o && typeof o === 'object' && 'id' in o && 'label' in o)
                  .map((o: { id: unknown; label: unknown }) => ({
                    id: String(o.id),
                    label: String(o.label),
                  }))
              : [],
            allowCustom: q.allowCustom !== false,
            allowMultiple: q.allowMultiple === true,
          })
        }
      } catch {
        /* 非 JSON 或非 question 事件忽略 */
      }
    }

    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let nl: number
      while ((nl = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, nl).replace(/\r$/, '')
        buffer = buffer.slice(nl + 1)
        tryParseCompaction(line)
        tryParseQuestion(line)
        const delta = parseStreamLine(line)
        if (delta) opts.onDelta(delta)
        if (hasReasoning) {
          const r = parseStreamLineReasoning(line)
          if (r) opts.onReasoning!(r)
        }
      }
    }
    if (buffer.trim()) {
      tryParseCompaction(buffer)
      tryParseQuestion(buffer)
      const delta = parseStreamLine(buffer)
      if (delta) opts.onDelta(delta)
      if (hasReasoning) {
        const r = parseStreamLineReasoning(buffer)
        if (r) opts.onReasoning!(r)
      }
    }
    opts.onDone?.()
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      opts.onDone?.()
      return
    }
    const message = err instanceof Error ? err.message : '网络异常'
    opts.onError?.(message)
  }
}

// ==================== SSE 流式对话 ====================

export interface StreamChatOptions {
  model: string
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
  signal?: AbortSignal
  onDelta: (delta: string) => void
  onError?: (error: string) => void
  onDone?: () => void
  onReasoning?: (delta: string) => void
  metadata?: { conversationId?: string; userId?: string; messageId?: string }
  temperature?: number
  topP?: number
  topK?: number
  maxTokens?: number
  stop?: string[]
}

export function parseStreamLine(line: string): string | null {
  if (!line || line.startsWith(':')) return null
  let data = line
  if (line.startsWith('data:')) {
    data = line.slice(5).replace(/^\s/, '')
  } else if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) {
    return null
  }
  if (data === '[DONE]') return null
  // Vercel AI SDK data-stream protocol: `TYPE:JSON`（type 0 = 文本 token，其他类型目前忽略）
  const proto = data.match(/^(\d+):(.*)$/s)
  if (proto?.[1] !== undefined) {
    if (proto[1] === '0') {
      try {
        const parsed = JSON.parse(proto[2]!)
        if (typeof parsed === 'string') return parsed
      } catch {
        /* fallthrough */
      }
    }
    return null
  }
  try {
    const json = JSON.parse(data)
    if (json?.type === 'error' && typeof json?.message === 'string') {
      const e = new Error(json.message)
      e.name = 'SSEError'
      throw e
    }
    if (json?.error === true && typeof json?.error_message === 'string') {
      const e = new Error(json.error_message)
      e.name = 'SSEError'
      throw e
    }
    if (json?.type === 'reasoning') return null
    const choice = json?.choices?.[0]
    const delta =
      choice?.delta?.content ??
      choice?.message?.content ??
      json?.content ??
      json?.delta ??
      json?.text
    return typeof delta === 'string' ? delta : null
  } catch (e) {
    if (e instanceof SyntaxError) return data
    throw e
  }
}

export function parseStreamLineReasoning(line: string): string | null {
  if (!line || line.startsWith(':')) return null
  let data = line
  if (line.startsWith('data:')) {
    data = line.slice(5).replace(/^\s/, '')
  } else if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) {
    return null
  }
  if (data === '[DONE]') return null
  try {
    const json = JSON.parse(data)
    if (json?.type === 'error' && typeof json?.message === 'string') {
      const e = new Error(json.message)
      e.name = 'SSEError'
      throw e
    }
    if (json?.error === true && typeof json?.error_message === 'string') {
      const e = new Error(json.error_message)
      e.name = 'SSEError'
      throw e
    }
    if (json?.type === 'reasoning' && typeof json?.content === 'string') return json.content
    const choice = json?.choices?.[0]
    const reasoning =
      choice?.delta?.reasoning_content ?? choice?.message?.reasoning_content ?? json?.reasoning
    return typeof reasoning === 'string' ? reasoning : null
  } catch (e) {
    if (e instanceof SyntaxError) return null
    throw e
  }
}

export async function streamChat(opts: StreamChatOptions): Promise<void> {
  const token = tokenProvider.getToken()
  const url = normalizeUrl('/ai/chat/stream')
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const body: Record<string, unknown> = { model: opts.model, messages: opts.messages }
  if (opts.metadata) body.metadata = opts.metadata
  if (opts.temperature !== undefined) body.temperature = opts.temperature
  if (opts.topP !== undefined) body.topP = opts.topP
  if (opts.topK !== undefined) body.topK = opts.topK
  if (opts.maxTokens !== undefined) body.maxTokens = opts.maxTokens
  if (opts.stop !== undefined) body.stop = opts.stop

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: opts.signal,
    })
    if (!resp.ok || !resp.body) {
      const text = await resp.text().catch(() => '')
      throw new Error(text || `请求失败（${resp.status}）`)
    }

    const reader = resp.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    const hasReasoning = typeof opts.onReasoning === 'function'

    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let nl: number
      while ((nl = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, nl).replace(/\r$/, '')
        buffer = buffer.slice(nl + 1)
        const delta = parseStreamLine(line)
        if (delta) opts.onDelta(delta)
        if (hasReasoning) {
          const r = parseStreamLineReasoning(line)
          if (r) opts.onReasoning!(r)
        }
      }
    }
    if (buffer.trim()) {
      const delta = parseStreamLine(buffer)
      if (delta) opts.onDelta(delta)
      if (hasReasoning) {
        const r = parseStreamLineReasoning(buffer)
        if (r) opts.onReasoning!(r)
      }
    }
    opts.onDone?.()
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      opts.onDone?.()
      return
    }
    const message = err instanceof Error ? err.message : '网络异常'
    opts.onError?.(message)
  }
}
