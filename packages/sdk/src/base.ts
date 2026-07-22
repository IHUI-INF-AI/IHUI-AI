/**
 * SDK 基础客户端 — 鉴权、重试、超时、错误处理。
 */

/** SDK 配置选项。 */
export interface SdkConfig {
  /** API Key(必需,格式 ihui_xxx)。 */
  apiKey: string
  /** API Secret(可选,创建/轮换时返回)。 */
  secret?: string
  /** 基础 URL,默认 http://localhost:8802。 */
  baseUrl?: string
  /** 请求超时(毫秒),默认 30000。流式请求不超时。 */
  timeout?: number
  /** 最大重试次数,默认 2。网络错误和 5xx 自动重试,429 不重试。 */
  maxRetries?: number
  /** 自定义 fetch 实现(测试/拦截用)。 */
  fetch?: typeof fetch
}

/** SDK 错误,携带 HTTP 状态码 + 错误码 + 详情。 */
export class SdkError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'SdkError'
    this.status = status
    this.code = code
    this.details = details
  }
}

const DEFAULT_TIMEOUT = 30000
const DEFAULT_MAX_RETRIES = 2
const RETRY_DELAYS = [500, 1000]

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '')
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** SDK 基础客户端,封装鉴权、重试、超时、错误处理。 */
export class BaseClient {
  private readonly apiKey: string
  private readonly secret: string | undefined
  private readonly baseUrl: string
  private readonly timeout: number
  private readonly maxRetries: number
  private readonly fetchFn: typeof fetch

  constructor(config: SdkConfig) {
    if (!config.apiKey) {
      throw new SdkError(401, 'missing_api_key', 'apiKey is required')
    }
    this.apiKey = config.apiKey
    this.secret = config.secret
    this.baseUrl = normalizeBaseUrl(config.baseUrl ?? 'http://localhost:8802')
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES
    this.fetchFn = config.fetch ?? fetch
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    }
    if (this.secret) {
      headers['X-Api-Secret'] = this.secret
    }
    return headers
  }

  private buildUrl(path: string): string {
    const p = path.startsWith('/') ? path : `/${path}`
    return `${this.baseUrl}/v1${p}`
  }

  /**
   * 发起 JSON 请求并解析响应。
   * 网络错误和 5xx 自动重试(指数退避 500ms/1000ms),429 和 4xx 不重试。
   * 若 body 为 FormData,则不 JSON 序列化、不设置 Content-Type(由运行时自动添加 boundary)。
   */
  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData
    let lastError: SdkError | undefined

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) {
        const delay = RETRY_DELAYS[attempt - 1] ?? 1000
        await sleep(delay)
      }

      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), this.timeout)

        const headers = this.buildHeaders()
        if (isFormData) {
          delete headers['Content-Type']
        }

        const resp = await this.fetchFn(this.buildUrl(path), {
          method,
          headers,
          body: isFormData ? (body as FormData) : body !== undefined ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        })
        clearTimeout(timer)

        if (resp.ok) {
          const text = await resp.text()
          if (!text) return undefined as T
          return JSON.parse(text) as T
        }

        const errBody = await this.parseErrorBody(resp)
        lastError = new SdkError(
          resp.status,
          errBody.code ?? `http_${resp.status}`,
          errBody.message ?? resp.statusText,
          errBody.details,
        )

        if (resp.status === 429) break
        if (resp.status < 500) break
      } catch (e) {
        if (e instanceof SdkError) {
          lastError = e
          break
        }
        lastError = new SdkError(0, 'network_error', (e as Error).message ?? 'Network error')
      }
    }

    throw lastError ?? new SdkError(500, 'unknown_error', 'Unknown error')
  }

  /**
   * 发起流式请求,返回原始 ReadableStream。
   * 流式请求不超时、不重试(无法安全回放流)。
   */
  async requestStream(method: string, path: string, body?: unknown): Promise<ReadableStream<Uint8Array>> {
    const resp = await this.fetchFn(this.buildUrl(path), {
      method,
      headers: this.buildHeaders(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })

    if (!resp.ok) {
      const errBody = await this.parseErrorBody(resp)
      throw new SdkError(
        resp.status,
        errBody.code ?? `http_${resp.status}`,
        errBody.message ?? resp.statusText,
        errBody.details,
      )
    }

    if (!resp.body) {
      throw new SdkError(500, 'no_stream_body', 'Response body is null')
    }

    return resp.body as ReadableStream<Uint8Array>
  }

  private async parseErrorBody(resp: Response): Promise<{
    code?: string
    message?: string
    details?: unknown
  }> {
    try {
      const text = await resp.text()
      if (!text) return {}
      const json = JSON.parse(text) as Record<string, unknown>
      const err = json.error as Record<string, unknown> | undefined
      return {
        code: (json.code as string) ?? (err?.code as string),
        message: (json.message as string) ?? (err?.message as string),
        details: json.details ?? err?.details,
      }
    } catch {
      return {}
    }
  }
}
