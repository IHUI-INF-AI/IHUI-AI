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

// ==================== SSE 流式对话 ====================

export interface StreamChatOptions {
  model: string
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
  signal?: AbortSignal
  onDelta: (delta: string) => void
  onError?: (error: string) => void
  onDone?: () => void
}

function parseStreamLine(line: string): string | null {
  if (!line || line.startsWith(':')) return null
  let data = line
  if (line.startsWith('data:')) {
    data = line.slice(5).replace(/^\s/, '')
  } else if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) {
    return null
  }
  if (data === '[DONE]') return null
  const proto = data.match(/^(\d+):(.*)$/s)
  if (proto?.[1] === '0') {
    try {
      const parsed = JSON.parse(proto[2]!)
      if (typeof parsed === 'string') return parsed
    } catch {
      /* fallthrough */
    }
  }
  try {
    const json = JSON.parse(data)
    if (json?.type === 'error' && typeof json?.message === 'string') {
      throw new Error(json.message)
    }
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

export async function streamChat(opts: StreamChatOptions): Promise<void> {
  const token = tokenProvider.getToken()
  const url = normalizeUrl('/llm/complete/stream')
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model: opts.model, messages: opts.messages, stream: true }),
      signal: opts.signal,
    })
    if (!resp.ok || !resp.body) {
      const text = await resp.text().catch(() => '')
      throw new Error(text || `请求失败（${resp.status}）`)
    }

    const reader = resp.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

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
      }
    }
    if (buffer.trim()) {
      const delta = parseStreamLine(buffer)
      if (delta) opts.onDelta(delta)
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
