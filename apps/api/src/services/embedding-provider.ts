// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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

import { fetchWithinDeadline, isDeadlineAbort } from '../utils/fetch-deadline.js'

export interface EmbeddingProvider {
  /** Provider 标识, 用于日志和 metrics */
  readonly name: string
  /**
   * 生成 embedding; 输入文本列表, 输出向量列表 (与输入顺序一致)。
   * 上游批量应答缺项/乱序、无法按 index/id 对齐时**整批抛错** (G-1080904),
   * 绝不返回错位或截断的向量列表。
   *
   * 实现内部必须按上游上限分片 (见 EMBEDDING_MAX_BATCH_ITEMS / token 预算, F-416),
   * 逐批请求; 调用方可传 maxAttempts 启用单批有限重试; 最终失败抛错,
   * 不得返回空列表冒充成功。
   */
  embed(texts: string[], options?: EmbeddingRunOptions): Promise<number[][]>
}

// =============================================================================
// 批量分片 + 重试 (F-416)
// =============================================================================

/**
 * 上游单次批量 embedding 的条数上限。
 *
 * DashScope text-embedding-v2 单批最多 25 条; 超过后上游返回非 2xx, 旧实现把
 * 整批文本一次提交 ⇒ 整批失败, 所有切片以 embedding=NULL 落库 (检索静默退化为
 * 关键词匹配)。分片调用是修复的落点, 25 是上游硬上限而非调优值。
 */
export const EMBEDDING_MAX_BATCH_ITEMS = 25

/**
 * 单批 token 预算。OpenAI 单请求总 token 上限约 8191, 留余量取 8000;
 * 条数达标但文本过长时仍会超限, 故条数与 token 两个维度同时切分。
 */
export const EMBEDDING_MAX_BATCH_TOKENS = 8_000

/** 重试退避基数: 第 n 次重试等待 base * 2^(n-1) 毫秒。 */
export const EMBEDDING_BATCH_RETRY_BASE_DELAY_MS = 200

/**
 * 估算文本的 token 数(无 tokenizer 依赖的保守上界)。
 *
 * CJK 字符按 1 字符 1 token 计, 其余按 4 字符 1 token 计 —— 宁可高估,
 * 让分片偏小, 也不让单批超出上游 token 上限。
 */
export function estimateEmbeddingTokens(text: string): number {
  let cjkUnits = 0
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0
    if (code >= 0x2e80) cjkUnits += ch.length
  }
  const otherUnits = Math.max(0, text.length - cjkUnits)
  return cjkUnits + Math.ceil(otherUnits / 4)
}

export interface EmbeddingBatchPlanOptions {
  /** 单批条数上限, 默认 EMBEDDING_MAX_BATCH_ITEMS */
  maxItems?: number
  /** 单批 token 预算, 默认 EMBEDDING_MAX_BATCH_TOKENS */
  maxTokens?: number
}

/**
 * 按条数 + token 预算把输入切成批。
 *
 * 单条文本自身超过 token 预算时仍独占一批 (文本不可再切); 其余情况每批都
 * 同时满足 maxItems 与 maxTokens。输出顺序与输入一致, 拼接后与输入逐项相等
 * (条数守恒, 不丢项不重复)。
 */
export function planEmbeddingBatches(
  texts: readonly string[],
  options: EmbeddingBatchPlanOptions = {},
): string[][] {
  const maxItems = Math.max(1, Math.floor(options.maxItems ?? EMBEDDING_MAX_BATCH_ITEMS))
  const maxTokens = Math.max(1, Math.floor(options.maxTokens ?? EMBEDDING_MAX_BATCH_TOKENS))
  const batches: string[][] = []
  let current: string[] = []
  let currentTokens = 0
  for (const text of texts) {
    const tokens = Math.min(estimateEmbeddingTokens(text), maxTokens)
    if (current.length > 0 && (current.length >= maxItems || currentTokens + tokens > maxTokens)) {
      batches.push(current)
      current = []
      currentTokens = 0
    }
    current.push(text)
    currentTokens += tokens
  }
  if (current.length > 0) batches.push(current)
  return batches
}

export interface EmbeddingRunOptions extends EmbeddingBatchPlanOptions {
  /** 单批最多尝试次数 (含首次), 默认 1(不重试); 需要重试的调用方显式传入 */
  maxAttempts?: number
  /** 可注入的 sleep, 便于测试; 默认真实定时器 */
  sleep?: (ms: number) => Promise<void>
}

/**
 * 按批调用上游, 逐批返回结果并按输入顺序拼接。
 *
 * 失败语义 (F-416):
 *   - maxAttempts > 1 时单批失败按指数退避重试, 最多 maxAttempts 次;
 *   - 应答条数 ≠ 该批请求条数视为该批失败 (不按下标补齐);
 *   - 重试用尽仍失败 ⇒ **抛错**, 绝不返回空数组/缺项数组冒充成功。
 */
export async function embedInBatches(
  texts: readonly string[],
  embedBatch: (batch: string[]) => Promise<number[][]>,
  options: EmbeddingRunOptions = {},
): Promise<number[][]> {
  if (texts.length === 0) return []
  const maxAttempts = Math.max(1, Math.floor(options.maxAttempts ?? 1))
  const sleep =
    options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
  const batches = planEmbeddingBatches(texts, options)
  const all: number[][] = []
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex]!
    let lastError: unknown
    let embeddings: number[][] | undefined
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await embedBatch(batch)
        if (!Array.isArray(result) || result.length !== batch.length) {
          throw new Error(
            `embedding 应答 ${Array.isArray(result) ? result.length : 0} 条 ≠ 请求 ${batch.length} 条`,
          )
        }
        embeddings = result
        break
      } catch (err) {
        lastError = err
        if (attempt < maxAttempts) {
          await sleep(EMBEDDING_BATCH_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1))
        }
      }
    }
    if (!embeddings) {
      const reason = lastError instanceof Error ? lastError.message : String(lastError)
      throw new Error(
        `embedding 第 ${batchIndex + 1}/${batches.length} 批(${batch.length} 条)` +
          `共尝试 ${maxAttempts} 次后仍失败: ${reason}(F-416: 显式失败, 不返回空向量冒充成功)`,
      )
    }
    all.push(...embeddings)
  }
  return all
}

// =============================================================================
// 批量应答对齐 (G-1080904)
// =============================================================================

/**
 * 上游批量 embedding 应答的单条形态。
 * 各家对齐键不同: OpenAI 回 `index`, DashScope 回 `text_index`, 部分网关回 `id`,
 * 也存在三者皆无的形态 —— 键的有无决定对齐走哪一档 (见 alignEmbeddingBatch)。
 */
interface UpstreamEmbeddingItem {
  embedding?: number[]
  index?: number
  text_index?: number
  id?: number | string
}

/** 取条目对齐键: 只认整数值 (index / text_index / 整数形态的 id), 非整数形态视为"没有键" */
function readAlignKey(item: UpstreamEmbeddingItem): number | undefined {
  for (const raw of [item.text_index, item.index, item.id]) {
    if (typeof raw === 'number' && Number.isInteger(raw)) return raw
    if (typeof raw === 'string' && /^\d+$/.test(raw)) return Number(raw)
  }
  return undefined
}

/**
 * 把上游批量 embedding 应答按 index/text_index/id 对齐回请求顺序。
 *
 * 背景 (G-1080904): 上游批量应答的顺序/内容不保证与请求一致 (与上游
 * offPeakTaskService「批量应答顺序不保证与请求一致, 必须按 id find」同口径)。
 * 旧实现直接 `items.map(...)` 按下标返回 ⇒ 上游缺项/乱序时, 错位的向量会被
 * 消费端 `embeddings[i]` 静默写进索引, 表现为"检索偶尔指错文件"这类难查错。
 *
 * 对齐口径 (三档, 绝不按下标兜底):
 *   1. 应答条数 ≠ 请求条数 ⇒ 整批作废, 显式抛错 (不 shift 最旧、不截断、不按下标补齐);
 *   2. 条目全带整数对齐键 ⇒ 必须恰好构成 0..n-1 的一一对应 (越界/重复即"等长但缺项",
 *      同样整批抛错), 通过后按键重排返回; 部分条目有键、部分没有 ⇒ 键面自相矛盾, 整批抛错;
 *   3. 条目一个对齐键都拿不到 ⇒ 显式走第 1 档"长度不等即整批失败",
 *      长度相等才按应答原序返回 —— 拿不到键时的唯一档位, 不是按下标兜底。
 */
function alignEmbeddingBatch(
  providerName: string,
  items: UpstreamEmbeddingItem[],
  expectedCount: number,
): UpstreamEmbeddingItem[] {
  if (items.length !== expectedCount) {
    throw new Error(
      `[${providerName}] embedding 应答 ${items.length} 条 ≠ 请求 ${expectedCount} 条:` +
        '整批作废 (缺项/超项一律显式失败, 不按下标兜底)',
    )
  }

  const aligned = new Array<UpstreamEmbeddingItem>(items.length)
  let keyedCount = 0
  for (const item of items) {
    const pos = readAlignKey(item)
    if (pos === undefined) continue
    keyedCount++
    if (pos < 0 || pos >= items.length || aligned[pos] !== undefined) {
      throw new Error(
        `[${providerName}] embedding 应答对齐键 ${pos} 越界或重复:` +
          `不构成 0..${items.length - 1} 的一一对应 (等长但缺项/重复), 整批作废`,
      )
    }
    aligned[pos] = item
  }

  if (keyedCount === items.length) return aligned // 档2: 键面完整且成置换, 已按键重排
  if (keyedCount === 0) return items // 档3: 无任何可对齐键, 长度已验, 按应答原序
  throw new Error(
    `[${providerName}] embedding 应答对齐键部分缺失 (${keyedCount}/${items.length} 条带键):` +
      '整批作废 (无法按 index/id 对齐)',
  )
}

// =============================================================================
// 出站出口 (F-144)
// =============================================================================

/**
 * embedding 出站请求的统一时限 (F-144)。
 *
 * 三处 provider 原先各自裸 `fetch`:上游不回包时 Promise 永不 settle,
 * 每轮聊天的 RAG 检索与每条 chunk 入库都被单个慢请求无限拖住 (占着 socket/内存),
 * 而 `getEmbedding` 侧的 catch 对「迟迟不返回」无效。时限集中在此一处, 不散落到各 provider。
 *
 * 不复用 `aiServiceFetch`:它前缀 `config.AI_SERVICE_URL` 并注入系统 token/traceparent,
 * 语义是「调本仓 ai-service」, 与 DashScope/OpenAI/MiniMax 这些外部端点不适配。
 */
export const EMBEDDING_REQUEST_TIMEOUT_MS = 15_000

/**
 * 三处 provider 的唯一出站出口:带 deadline 的 fetch + 把中断转换成明确错误。
 *
 * deadline 覆盖「发出请求 → 响应体消费结束」整段 (不是只到响应头), 因此上游
 * 「发了 headers 再停滞」也不会挂住调用方; 到点一律抛错, 绝不静默返回空向量冒充成功。
 */
async function fetchEmbedding(
  providerName: string,
  url: string,
  init: RequestInit,
): Promise<Response> {
  try {
    return await fetchWithinDeadline(url, init, {
      timeoutMs: EMBEDDING_REQUEST_TIMEOUT_MS,
      label: `${providerName} embedding 出站请求`,
    })
  } catch (err) {
    // 本文件不传外部 signal, 故 AbortError 只可能来自上面这条 deadline。
    if (isDeadlineAbort(err) || (err instanceof Error && err.name === 'AbortError')) {
      throw new Error(
        `[${providerName}] embedding 请求未在 ${EMBEDDING_REQUEST_TIMEOUT_MS}ms 内完成, 已中断:` +
          '上游挂起不再无限拖住 RAG 检索/入库',
      )
    }
    throw err
  }
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

  async embed(texts: string[], options?: EmbeddingRunOptions): Promise<number[][]> {
    return embedInBatches(texts, (batch) => this.embedBatch(batch), options)
  }

  private async embedBatch(texts: string[]): Promise<number[][]> {
    const inputs = texts.map((t) => t.slice(0, DASHSCOPE_MAX_INPUT))
    const resp = await fetchEmbedding(this.name, DASHSCOPE_URL, {
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
      output?: { embeddings?: UpstreamEmbeddingItem[] }
    }
    const items = data.output?.embeddings ?? []
    // G-1080904: 按 text_index 对齐; 缺项/乱序整批作废, 不按下标兜底
    return alignEmbeddingBatch(this.name, items, inputs.length).map((e) => e.embedding ?? [])
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

  async embed(texts: string[], options?: EmbeddingRunOptions): Promise<number[][]> {
    return embedInBatches(texts, (batch) => this.embedBatch(batch), options)
  }

  private async embedBatch(texts: string[]): Promise<number[][]> {
    const resp = await fetchEmbedding(this.name, OPENAI_URL, {
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
      data?: UpstreamEmbeddingItem[]
    }
    const items = data.data ?? []
    // G-1080904: 按 index 对齐; 缺项/乱序整批作废, 不按下标兜底
    return alignEmbeddingBatch(this.name, items, texts.length).map((e) =>
      this.resizeToTarget(e.embedding ?? []),
    )
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

  async embed(texts: string[], options?: EmbeddingRunOptions): Promise<number[][]> {
    return embedInBatches(texts, (batch) => this.embedBatch(batch), options)
  }

  private async embedBatch(texts: string[]): Promise<number[][]> {
    const resp = await fetchEmbedding(this.name, this.endpoint, {
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
      data?: UpstreamEmbeddingItem[]
    }
    const items = data.data ?? []
    // G-1080904: 条目带 index/id 就按键对齐; 一个键都没有时走"长度不等即整批作废"档
    return alignEmbeddingBatch(this.name, items, texts.length).map((e) => e.embedding ?? [])
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
