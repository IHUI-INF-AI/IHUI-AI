/**
 * Hybrid Search — BM25-lite + 向量检索 + 时间衰减 + access boost + MMR 重排。
 *
 * 灵感来源:cli-memory crate 的 hybrid_search.rs。
 * 简化策略(做减法):
 *   - BM25-lite:不分词用空格切 + 中文 2-gram fallback,k1=1.5, b=0.75
 *   - 向量检索:可选(注入 EmbeddingProvider),无则纯 FTS
 *   - 时间衰减:evergreen 来源不衰减,其余 exp(-lambda * ageDays),半衰期默认 30 天
 *   - access boost:1 + log(1 + accessCount) * factor,对数增长
 *   - MMR(Jaccard):lambda * relevance - (1-lambda) * maxSim,O(n²) 可接受
 *   - 零新依赖:全部纯 TS,只用 node:crypto(已在 chunker.ts 引入)
 */
import type { EmbeddingProvider } from './embedding.js'

export type MemorySource = 'global' | 'workspace' | 'session'

export interface MemoryChunk {
  id: string
  text: string
  source: MemorySource
  /** unix ms */
  createdAt: number
  accessCount: number
  /** unix ms */
  lastAccessed: number
  embedding?: number[]
  ancestors?: string[]
}

export interface HybridSearchOptions {
  query: string
  chunks: MemoryChunk[]
  provider?: EmbeddingProvider
  maxResults?: number
  textWeight?: number
  vectorWeight?: number
  halfLifeDays?: number
  evergreenSources?: MemorySource[]
  mmrLambda?: number
  accessBoostFactor?: number
}

export interface SearchResult {
  chunk: MemoryChunk
  /** 归一化到 [0, 1],用于排序展示 */
  score: number
  /** 原始 relevance,未 clamp,MMR 用 */
  relevance: number
  ftsScore?: number
  vectorScore?: number
  decayFactor: number
  accessBoost: number
  matchedBy: 'fts' | 'vector' | 'both'
}

const DEFAULT_MAX_RESULTS = 10
const DEFAULT_TEXT_WEIGHT = 0.7
const DEFAULT_VECTOR_WEIGHT = 0.3
const DEFAULT_HALF_LIFE_DAYS = 30
const DEFAULT_MMR_LAMBDA = 0.7
const DEFAULT_ACCESS_BOOST_FACTOR = 0.05
const DEFAULT_EVERGREEN: MemorySource[] = ['global', 'workspace']

const BM25_K1 = 1.5
const BM25_B = 0.75
const MS_PER_DAY = 1000 * 60 * 60 * 24

// ============ Tokenizer ============

/**
 * FTS 分词:ascii 用 [^a-z0-9_]+ 切,中文连续段做 2-gram fallback。
 */
export function tokenizeFts(text: string): string[] {
  const lower = text.toLowerCase()
  const ascii = lower.split(/[^a-z0-9_]+/).filter(Boolean)
  const chinese: string[] = []
  const matches = lower.match(/[\u4e00-\u9fff]+/g)
  if (matches) {
    for (const run of matches) {
      if (run.length === 1) {
        chinese.push(run)
      } else {
        for (let i = 0; i < run.length - 1; i++) {
          chinese.push(run.slice(i, i + 2))
        }
      }
    }
  }
  return [...ascii, ...chinese]
}

/**
 * MMR 分词:仅 ascii,与 spec 一致(spec 原文 `text.toLowerCase().split(/[^a-z0-9_]+/)`)。
 */
export function tokenizeMmr(text: string): Set<string> {
  return new Set(text.toLowerCase().split(/[^a-z0-9_]+/).filter(Boolean))
}

// ============ BM25-lite ============

/**
 * 单 chunk BM25 分数(给定整个语料)。
 * IDF = log((N - df + 0.5) / (df + 0.5) + 1)
 * TF = freq * (k1 + 1) / (freq + k1 * (1 - b + b * chunkLen / avgChunkLen))
 */
export function bm25Score(query: string, chunk: string, allChunks: string[]): number {
  const queryTokens = tokenizeFts(query)
  if (queryTokens.length === 0 || allChunks.length === 0) return 0

  const N = allChunks.length
  const allTokens = allChunks.map(tokenizeFts)
  const totalLen = allTokens.reduce((s, t) => s + t.length, 0)
  const avgLen = totalLen / N
  if (avgLen === 0) return 0

  const chunkTokens = tokenizeFts(chunk)
  const chunkLen = chunkTokens.length
  if (chunkLen === 0) return 0

  const tf = new Map<string, number>()
  for (const tok of chunkTokens) {
    tf.set(tok, (tf.get(tok) ?? 0) + 1)
  }

  let score = 0
  for (const qTok of new Set(queryTokens)) {
    let df = 0
    for (const toks of allTokens) {
      if (toks.includes(qTok)) df++
    }
    const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1)
    const freq = tf.get(qTok) ?? 0
    if (freq === 0) continue
    const tfNorm = (freq * (BM25_K1 + 1)) / (freq + BM25_K1 * (1 - BM25_B + BM25_B * (chunkLen / avgLen)))
    score += idf * tfNorm
  }

  return score
}

// ============ 工具函数 ============

/** min-max 归一到 [0, 1]。全部相同且非零则返回全 1;全为 0 则返回全 0。 */
export function normalize(scores: number[]): number[] {
  if (scores.length === 0) return []
  let min = Infinity
  let max = -Infinity
  for (const s of scores) {
    if (s < min) min = s
    if (s > max) max = s
  }
  if (max === min) return scores.map(() => (max === 0 ? 0 : 1))
  const range = max - min
  return scores.map((s) => (s - min) / range)
}

/** 余弦相似度,[-1, 1]。 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    const av = a[i]!
    const bv = b[i]!
    dot += av * bv
    normA += av * av
    normB += bv * bv
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

/** Jaccard 相似度,两个空集记为 0。 */
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0
  let inter = 0
  for (const x of a) if (b.has(x)) inter++
  const union = a.size + b.size - inter
  return union === 0 ? 0 : inter / union
}

// ============ 衰减 / Boost ============

/** 时间衰减因子:evergreen → 1,否则 exp(-lambda * ageDays)。 */
export function computeDecay(
  createdAt: number,
  now: number,
  source: MemorySource,
  halfLifeDays: number,
  evergreenSources: MemorySource[],
): number {
  if (evergreenSources.includes(source)) return 1
  const ageDays = (now - createdAt) / MS_PER_DAY
  const lambda = Math.log(2) / halfLifeDays
  return Math.exp(-lambda * ageDays)
}

/** access boost:1 + log(1 + accessCount) * factor。 */
export function computeAccessBoost(accessCount: number, factor: number): number {
  return 1 + Math.log(1 + accessCount) * factor
}

// ============ MMR 重排 ============

/** MMR 候选(导出供测试构造)。 */
export interface MmrCandidate {
  chunk: MemoryChunk
  relevance: number
  score: number
  ftsScore: number
  vectorScore: number | undefined
  decayFactor: number
  accessBoost: number
  matchedBy: 'fts' | 'vector' | 'both'
  tokens: Set<string>
}

/**
 * MMR 重排:mmr(d) = lambda * relevance(d) - (1-lambda) * maxSim(d, selected)。
 * 候选 < maxResults 时仍按 MMR 顺序返回(可能全部入选)。
 */
export function mmrRerank(
  candidates: MmrCandidate[],
  lambda: number,
  maxResults: number,
): MmrCandidate[] {
  if (candidates.length === 0) return []
  const remaining = [...candidates]
  const selected: MmrCandidate[] = []

  while (remaining.length > 0 && selected.length < maxResults) {
    let bestIdx = 0
    let bestScore = -Infinity
    for (let i = 0; i < remaining.length; i++) {
      const r = remaining[i]!
      let maxSim = 0
      for (const s of selected) {
        const sim = jaccard(r.tokens, s.tokens)
        if (sim > maxSim) maxSim = sim
      }
      const mmr = lambda * r.relevance - (1 - lambda) * maxSim
      if (mmr > bestScore) {
        bestScore = mmr
        bestIdx = i
      }
    }
    selected.push(remaining[bestIdx]!)
    remaining.splice(bestIdx, 1)
  }

  return selected
}

// ============ 主搜索逻辑 ============

function hybridSearchCore(
  opts: HybridSearchOptions,
  queryEmbedding: number[] | undefined,
  chunkEmbeddings: (number[] | undefined)[] | undefined,
): SearchResult[] {
  const {
    query,
    chunks,
    maxResults = DEFAULT_MAX_RESULTS,
    textWeight = DEFAULT_TEXT_WEIGHT,
    vectorWeight = DEFAULT_VECTOR_WEIGHT,
    halfLifeDays = DEFAULT_HALF_LIFE_DAYS,
    evergreenSources = DEFAULT_EVERGREEN,
    mmrLambda = DEFAULT_MMR_LAMBDA,
    accessBoostFactor = DEFAULT_ACCESS_BOOST_FACTOR,
  } = opts

  if (chunks.length === 0) return []

  // 1. BM25 分数 + 归一化
  const chunkTexts = chunks.map((c) => c.text)
  const rawFts = chunkTexts.map((t) => bm25Score(query, t, chunkTexts))
  const ftsScores = normalize(rawFts)

  // 2. 向量分数(可选)
  const hasVector = !!queryEmbedding && !!chunkEmbeddings
  let vectorScores: number[] = []
  if (hasVector && queryEmbedding && chunkEmbeddings) {
    vectorScores = chunkEmbeddings.map((emb) => {
      if (!emb) return 0
      const cos = cosineSimilarity(queryEmbedding, emb)
      return (1 + cos) / 2
    })
  }

  // 3. 构建候选
  const now = Date.now()
  const candidates: MmrCandidate[] = []

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!
    const fts = ftsScores[i]!
    const vec = hasVector ? vectorScores[i]! : 0
    const ftsMatched = fts > 0
    const vecMatched = hasVector && vec > 0

    if (!ftsMatched && !vecMatched) continue

    // 合并:max(textWeight*fts + vectorWeight*vec, fts_only=fts)
    const weighted = textWeight * fts + vectorWeight * vec
    const combined = Math.max(weighted, fts)

    const decayFactor = computeDecay(chunk.createdAt, now, chunk.source, halfLifeDays, evergreenSources)
    const accessBoost = computeAccessBoost(chunk.accessCount, accessBoostFactor)
    const relevance = combined * decayFactor * accessBoost
    const score = Math.max(0, Math.min(1, relevance))

    const matchedBy: 'fts' | 'vector' | 'both' =
      ftsMatched && vecMatched ? 'both' : ftsMatched ? 'fts' : 'vector'

    candidates.push({
      chunk,
      relevance,
      score,
      ftsScore: fts,
      vectorScore: hasVector ? vec : undefined,
      decayFactor,
      accessBoost,
      matchedBy,
      tokens: tokenizeMmr(chunk.text),
    })
  }

  // 4. MMR 重排 + 截断
  const reranked = mmrRerank(candidates, mmrLambda, maxResults)

  // 5. 输出
  return reranked.map((c) => ({
    chunk: c.chunk,
    score: c.score,
    relevance: c.relevance,
    ftsScore: c.ftsScore,
    vectorScore: c.vectorScore,
    decayFactor: c.decayFactor,
    accessBoost: c.accessBoost,
    matchedBy: c.matchedBy,
  }))
}

/**
 * 同步版本:仅支持纯 FTS(无 provider 或忽略 provider)。
 * 若所有 chunk 已有 embedding 但 query embedding 无从获取,仍走 FTS。
 */
export function hybridSearchSync(opts: HybridSearchOptions): SearchResult[] {
  return hybridSearchCore(opts, undefined, undefined)
}

/**
 * 异步版本:若提供 provider,会调 embedBatch 获取 query + 缺失 chunk 的 embedding。
 * 无 provider 则等价于 hybridSearchSync。
 */
export async function hybridSearch(opts: HybridSearchOptions): Promise<SearchResult[]> {
  const { provider, query, chunks } = opts
  if (!provider || chunks.length === 0) {
    return hybridSearchCore(opts, undefined, undefined)
  }

  // 计算 query embedding
  const queryEmb = (await provider.embedBatch([query]))[0]

  // 收集缺失 embedding 的 chunk
  const missingIdx: number[] = []
  const missingTexts: string[] = []
  const chunkEmbs: (number[] | undefined)[] = chunks.map((c, i) => {
    if (c.embedding) return c.embedding
    missingIdx.push(i)
    missingTexts.push(c.text)
    return undefined
  })
  if (missingTexts.length > 0) {
    const computed = await provider.embedBatch(missingTexts)
    for (let i = 0; i < computed.length; i++) {
      chunkEmbs[missingIdx[i]!] = computed[i]
    }
  }

  return hybridSearchCore(opts, queryEmb, chunkEmbs)
}
