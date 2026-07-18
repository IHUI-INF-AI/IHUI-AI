/**
 * Embedding Provider — 向量嵌入接口 + Mock 实现 + OpenAI 兼容 API 实现。
 *
 * 灵感来源:参考行业 Agent 框架的 memory embedding 抽象。
 * 简化策略(做减法):
 *   - 默认 MockEmbeddingProvider 用 sha256 → 8 维 float(测试零外部依赖)
 *   - ApiEmbeddingProvider 实现 OpenAI /embeddings 协议,用户运行时注入实例
 *   - 不实际调用网络(由调用方实例化时触发)
 */
import * as crypto from 'node:crypto'

export interface EmbeddingProvider {
  embedBatch(texts: string[]): Promise<number[][]>
  modelName(): string
  dimensions(): number
}

const MOCK_DIMENSIONS = 8

/**
 * Mock 实现:用 sha256 hash → 8 维 float 数组。
 * 把 text 切 8 段,每段 sha256 hash 的前 4 字节(uint32)归一化到 [-1, 1]。
 * 同输入同输出(确定性),不同输入通常不同输出。
 */
export class MockEmbeddingProvider implements EmbeddingProvider {
  dimensions(): number {
    return MOCK_DIMENSIONS
  }

  modelName(): string {
    return 'mock-sha256-8d'
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.embedOne(t))
  }

  private embedOne(text: string): number[] {
    const result: number[] = new Array(MOCK_DIMENSIONS).fill(0)
    const segLen = Math.max(1, Math.ceil(text.length / MOCK_DIMENSIONS))
    for (let i = 0; i < MOCK_DIMENSIONS; i++) {
      const seg = text.slice(i * segLen, (i + 1) * segLen)
      const hash = crypto.createHash('sha256').update(seg).digest('hex')
      const intVal = Number.parseInt(hash.slice(0, 8), 16)
      result[i] = (intVal / 0xffffffff) * 2 - 1
    }
    return result
  }
}

export interface ApiEmbeddingProviderOptions {
  apiBase: string
  apiKey: string
  model?: string
  dimensions?: number
  batchSize?: number
  maxRetries?: number
}

class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * OpenAI 兼容 API 实现。
 * POST {apiBase}/embeddings,body { model, input, dimensions }。
 * 鉴权:Authorization: Bearer {apiKey}。
 * 429 / 5xx 指数退避重试(1s/2s/4s);4xx 立即抛。
 */
export class ApiEmbeddingProvider implements EmbeddingProvider {
  private readonly apiBase: string
  private readonly apiKey: string
  private readonly model: string
  private readonly dims: number
  private readonly batchSize: number
  private readonly maxRetries: number

  constructor(opts: ApiEmbeddingProviderOptions) {
    this.apiBase = opts.apiBase
    this.apiKey = opts.apiKey
    this.model = opts.model ?? 'text-embedding-3-small'
    this.dims = opts.dimensions ?? 1536
    this.batchSize = opts.batchSize ?? 32
    this.maxRetries = opts.maxRetries ?? 3
  }

  dimensions(): number {
    return this.dims
  }

  modelName(): string {
    return this.model
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const out: number[][] = []
    for (let i = 0; i < texts.length; i += this.batchSize) {
      const batch = texts.slice(i, i + this.batchSize)
      const embs = await this.embedBatchWithRetry(batch)
      out.push(...embs)
    }
    return out
  }

  private async embedBatchWithRetry(batch: string[]): Promise<number[][]> {
    let lastError: Error | null = null
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await this.callApi(batch)
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        if (err instanceof ApiError) {
          const s = err.status
          // 4xx (除 429)立即抛
          if (s >= 400 && s < 500 && s !== 429) throw err
        }
        // 429 / 5xx / 网络错误 → 指数退避
        const delay = Math.pow(2, attempt) * 1000
        await new Promise((r) => setTimeout(r, delay))
      }
    }
    throw lastError ?? new Error('embedBatch failed after retries')
  }

  private async callApi(batch: string[]): Promise<number[][]> {
    const url = `${this.apiBase.replace(/\/$/, '')}/embeddings`
    const body = JSON.stringify({
      model: this.model,
      input: batch,
      dimensions: this.dims,
    })
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body,
    })
    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      throw new ApiError(`embedding API ${resp.status}: ${text}`, resp.status)
    }
    const json = (await resp.json()) as { data: Array<{ embedding: number[] }> }
    return json.data.map((d) => d.embedding)
  }
}
