import type { ApiResult, ApiResponse } from '@ihui/types'

export interface TokenProvider {
  getToken(): string | null
}

let tokenProvider: TokenProvider = { getToken: () => null }
let baseUrl: string = ''

export function setTokenProvider(provider: TokenProvider): void {
  tokenProvider = provider
}

export function setBaseUrl(url: string): void {
  baseUrl = url.replace(/\/$/, '')
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

export async function fetchApi<T>(url: string, options: RequestInit = {}): Promise<ApiResult<T>> {
  const token = tokenProvider.getToken()
  const normalizedUrl = normalizeUrl(url)

  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string> | undefined),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const maxRetries = 1
  let lastError = '网络异常'

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
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
        return {
          success: false,
          error: message,
          status: response.status,
          errorCode,
          retryAfter: retryAfter && Number.isFinite(retryAfter) ? retryAfter : undefined,
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
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return { success: false, error: '请求已取消' }
      }
      lastError = err instanceof Error ? err.message : '网络异常'
      if (attempt < maxRetries) continue
    }
  }

  return { success: false, error: lastError }
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
 * - `server`   → Toast 提示服务异常,可重试
 * - `network`  → Toast 提示网络问题
 * - `unknown`  → 兜底 Toast
 */
export type SSEErrorSeverity = 'auth' | 'forbidden' | 'ratelimit' | 'server' | 'network' | 'unknown'

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
