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
