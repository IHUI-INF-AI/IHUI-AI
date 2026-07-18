/**
 * Embedding Provider 抽象层。
 *
 * 用于知识库 RAG 的语义检索:
 *   - 未配置任何 provider 时返回 null, knowledge-rag-service 自动降级为关键词匹配
 *   - 配置 DASHSCOPE_API_KEY → 阿里云 DashScope text-embedding-v2
 *   - 配置 OPENAI_API_KEY    → OpenAI text-embedding-3-small (1536 维)
 *   - 配置 MINIMAX_API_KEY   → MiniMax 内部 embedding 端点 (mock, 默认兜底)
 *
 * 设计:
 *   1. 单一接口 EmbeddingProvider — 任何文本向量化的服务都可插入
 *   2. getEmbeddingProvider() 工厂: 根据 env 选 provider
 *   3. 默认返回 null → 触发字符串相似度降级, 保证不依赖外部 API
 *   4. 维度统一为 1536 (OpenAI 标准), 不同 provider 在内部做投影或填充
 */

export interface EmbeddingProvider {
  /** Provider 标识, 用于日志和 metrics */
  readonly name: string
  /** 生成 embedding; 输入文本列表, 输出向量列表 (与输入顺序一致) */
  embed(texts: string[]): Promise<number[][]>
}

// =============================================================================
// DashScope
// =============================================================================

const DASHSCOPE_URL =
  'https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding'
const DASHSCOPE_MAX_INPUT = 2048
const DASHSCOPE_MODEL = 'text-embedding-v2'

class DashScopeEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'dashscope'

  constructor(private readonly apiKey: string) {}

  async embed(texts: string[]): Promise<number[][]> {
    const inputs = texts.map((t) => t.slice(0, DASHSCOPE_MAX_INPUT))
    const resp = await fetch(DASHSCOPE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: DASHSCOPE_MODEL, input: { texts: inputs } }),
    })
    if (!resp.ok) {
      throw new Error(`DashScope embedding HTTP ${resp.status}`)
    }
    const data = (await resp.json()) as {
      output?: { embeddings?: Array<{ embedding?: number[] }> }
    }
    const items = data.output?.embeddings ?? []
    return items.map((e) => e.embedding ?? [])
  }
}

// =============================================================================
// OpenAI
// =============================================================================

const OPENAI_URL = 'https://api.openai.com/v1/embeddings'
const OPENAI_MODEL = 'text-embedding-3-small'
const TARGET_DIM = 1536 // 统一到 OpenAI 标准维度, 简化降级逻辑

class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'openai'

  constructor(private readonly apiKey: string) {}

  async embed(texts: string[]): Promise<number[][]> {
    const resp = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: OPENAI_MODEL, input: texts }),
    })
    if (!resp.ok) {
      throw new Error(`OpenAI embedding HTTP ${resp.status}`)
    }
    const data = (await resp.json()) as {
      data?: Array<{ embedding?: number[] }>
    }
    const items = data.data ?? []
    return items.map((e) => this.resizeToTarget(e.embedding ?? []))
  }

  /** OpenAI text-embedding-3-small 输出 1536 维, 此处兜底截断/填充 */
  private resizeToTarget(vec: number[]): number[] {
    if (vec.length === TARGET_DIM) return vec
    if (vec.length > TARGET_DIM) return vec.slice(0, TARGET_DIM)
    return [...vec, ...new Array(TARGET_DIM - vec.length).fill(0)]
  }
}

// =============================================================================
// MiniMax (内部端点, 默认 mock 兜底)
// =============================================================================

/**
 * MiniMax Embedding Provider
 *
 * 当 MINIMAX_API_KEY 配置时, 调用 MiniMax 内部 embedding 端点;
 * 未配置时返回 null 触发降级 (与未配置 DashScope/OpenAI 行为一致)。
 *
 * 注: MiniMax 端点为内部服务, 实际地址通过 env 覆盖, 默认占位为 mock 兜底。
 */
class MinimaxEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'minimax'

  constructor(
    private readonly apiKey: string,
    private readonly endpoint: string,
  ) {}

  async embed(texts: string[]): Promise<number[][]> {
    const resp = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: 'embo-01', input: texts }),
    })
    if (!resp.ok) {
      throw new Error(`MiniMax embedding HTTP ${resp.status}`)
    }
    const data = (await resp.json()) as {
      data?: Array<{ embedding?: number[] }>
    }
    const items = data.data ?? []
    return items.map((e) => e.embedding ?? [])
  }
}

// =============================================================================
// 工厂
// =============================================================================

let cachedProvider: EmbeddingProvider | null | undefined

/**
 * 获取当前 embedding provider.
 *
 * 优先级: DashScope > OpenAI > MiniMax > null (降级为关键词匹配)
 *
 * 注意: 这是 cached, 整个进程只解析一次 env; 单元测试可通过
 *       __resetEmbeddingProviderForTests() 强制重读。
 */
export function getEmbeddingProvider(): EmbeddingProvider | null {
  if (cachedProvider !== undefined) return cachedProvider

  if (process.env.DASHSCOPE_API_KEY) {
    cachedProvider = new DashScopeEmbeddingProvider(process.env.DASHSCOPE_API_KEY)
  } else if (process.env.OPENAI_API_KEY) {
    cachedProvider = new OpenAIEmbeddingProvider(process.env.OPENAI_API_KEY)
  } else if (process.env.MINIMAX_API_KEY) {
    const endpoint = process.env.MINIMAX_EMBEDDING_URL ?? 'https://api.minimaxi.com/v1/embeddings'
    cachedProvider = new MinimaxEmbeddingProvider(process.env.MINIMAX_API_KEY, endpoint)
  } else {
    cachedProvider = null
  }
  return cachedProvider
}

/** 单元测试 hook: 重置 cached provider, 让下次 getEmbeddingProvider() 重新解析 env */
export function __resetEmbeddingProviderForTests(): void {
  cachedProvider = undefined
}
