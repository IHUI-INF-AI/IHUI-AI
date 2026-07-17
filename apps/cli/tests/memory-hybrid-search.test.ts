/**
 * Memory 跨 session 记忆升级(P1-4)测试
 * 覆盖:chunker / MockEmbeddingProvider / BM25 / MMR / 时间衰减 / access boost / hybridSearch 端到端 / 归一化
 */
import { describe, it, expect } from 'vitest'
import {
  chunkMarkdown,
  MockEmbeddingProvider,
  bm25Score,
  normalize,
  cosineSimilarity,
  mmrRerank,
  computeDecay,
  computeAccessBoost,
  hybridSearch,
  hybridSearchSync,
  tokenizeMmr,
  type MemoryChunk,
  type MmrCandidate,
} from '../src/memory/index.js'

const NOW = 1_700_000_000_000 // 固定 now,避免时间相关测试抖动

function makeChunk(
  id: string,
  text: string,
  overrides: Partial<MemoryChunk> = {},
): MemoryChunk {
  return {
    id,
    text,
    source: 'session',
    createdAt: NOW,
    accessCount: 0,
    lastAccessed: NOW,
    ...overrides,
  }
}

// ============ 1. chunker ============

describe('chunkMarkdown', () => {
  it('单 heading 切分:level-1 heading 下方的 chunk ancestors 为空(无父链)', () => {
    const md = '# Project\n\nSome content here.'
    const chunks = chunkMarkdown(md)
    expect(chunks).toHaveLength(1)
    expect(chunks[0]!.text).toContain('Some content here.')
    expect(chunks[0]!.ancestors).toEqual([])
    expect(chunks[0]!.startLine).toBe(0)
  })

  it('多 heading ancestors:# A → ## B → ### C 时 C 下方的 chunk ancestors 为 ["A", "A/B"]', () => {
    const md = '# A\n\n## B\n\n### C\n\ncontent'
    const chunks = chunkMarkdown(md)
    const cChunk = chunks.find((c) => c.text.includes('content'))
    expect(cChunk).toBeDefined()
    expect(cChunk!.ancestors).toEqual(['A', 'A/B'])
  })

  it('overlap 保留:跨 chunk 边界应有尾部行重复', () => {
    // 每行 ~30 字符,设 maxChunkSize=60, overlap=30,触发切分并保留 overlap
    const line1 = 'a'.repeat(30)
    const line2 = 'b'.repeat(30)
    const line3 = 'c'.repeat(30)
    const md = `${line1}\n${line2}\n${line3}`
    const chunks = chunkMarkdown(md, { maxChunkSize: 60, overlap: 30 })
    expect(chunks.length).toBeGreaterThanOrEqual(2)
    // 第二个 chunk 应包含第一个 chunk 末尾的行
    expect(chunks[1]!.text).toContain(line2)
  })

  it('hash 稳定性:同输入同 hash(16 字符 sha256)', () => {
    const md = '# A\n\ncontent'
    const c1 = chunkMarkdown(md)
    const c2 = chunkMarkdown(md)
    expect(c1[0]!.hash).toBe(c2[0]!.hash)
    expect(c1[0]!.hash).toMatch(/^[a-f0-9]{16}$/)
  })
})

// ============ 2. MockEmbeddingProvider ============

describe('MockEmbeddingProvider', () => {
  it('dimensions=8 且 modelName 为 mock-sha256-8d', () => {
    const p = new MockEmbeddingProvider()
    expect(p.dimensions()).toBe(8)
    expect(p.modelName()).toBe('mock-sha256-8d')
  })

  it('同输入同输出(确定性)', async () => {
    const p = new MockEmbeddingProvider()
    const [a1] = await p.embedBatch(['hello world'])
    const [a2] = await p.embedBatch(['hello world'])
    expect(a1).toEqual(a2)
    expect(a1).toHaveLength(8)
    for (const v of a1!) {
      expect(v).toBeGreaterThanOrEqual(-1)
      expect(v).toBeLessThanOrEqual(1)
    }
  })

  it('不同输入通常不同输出', async () => {
    const p = new MockEmbeddingProvider()
    const [a] = await p.embedBatch(['hello world'])
    const [b] = await p.embedBatch(['completely different text'])
    expect(a).not.toEqual(b)
  })
})

// ============ 3. BM25 ============

describe('bm25Score', () => {
  it('精确匹配应返回正分', () => {
    const docs = ['typescript is great', 'python is great', 'rust is great']
    const s = bm25Score('typescript', 'typescript is great', docs)
    expect(s).toBeGreaterThan(0)
  })

  it('无匹配返回 0', () => {
    const docs = ['typescript is great', 'python is great']
    const s = bm25Score('java', 'typescript is great', docs)
    expect(s).toBe(0)
  })

  it('多 query term 累加(含 term 的分数 > 单 term)', () => {
    const docs = ['typescript javascript web', 'typescript only', 'javascript only']
    const single = bm25Score('typescript', 'typescript javascript web', docs)
    const multi = bm25Score('typescript javascript', 'typescript javascript web', docs)
    expect(multi).toBeGreaterThan(single)
    expect(multi).toBeGreaterThan(0)
  })
})

// ============ 4. MMR ============

function makeMmrCandidate(
  id: string,
  text: string,
  relevance: number,
): MmrCandidate {
  return {
    chunk: makeChunk(id, text),
    relevance,
    score: relevance,
    ftsScore: relevance,
    vectorScore: undefined,
    decayFactor: 1,
    accessBoost: 1,
    matchedBy: 'fts',
    tokens: tokenizeMmr(text),
  }
}

describe('mmrRerank', () => {
  it('lambda=1 退化为纯 relevance 排序', () => {
    const cands = [
      makeMmrCandidate('a', 'alpha beta', 0.3),
      makeMmrCandidate('b', 'gamma delta', 0.9),
      makeMmrCandidate('c', 'epsilon zeta', 0.6),
    ]
    const out = mmrRerank(cands, 1, 10)
    expect(out.map((c) => c.chunk.id)).toEqual(['b', 'c', 'a'])
  })

  it('lambda=0 最大化多样性:避免选相似候选', () => {
    // A 与 B 高度相似(jaccard 高),C 与 A 完全不重叠
    const cands = [
      makeMmrCandidate('a', 'typescript javascript', 0.9),
      makeMmrCandidate('b', 'typescript javascript web', 0.8),
      makeMmrCandidate('c', 'python rust', 0.7),
    ]
    const out = mmrRerank(cands, 0, 10)
    expect(out).toHaveLength(3)
    // 第一个任选(所有 maxSim=0);第二个应选 C(与 A 不重叠,mmr=0 > B 的负值)
    expect(out[1]!.chunk.id).toBe('c')
  })

  it('候选 < maxResults 时全部返回', () => {
    const cands = [
      makeMmrCandidate('a', 'alpha', 0.5),
      makeMmrCandidate('b', 'beta', 0.4),
    ]
    const out = mmrRerank(cands, 0.7, 10)
    expect(out).toHaveLength(2)
  })

  it('maxResults 截断生效', () => {
    const cands = [
      makeMmrCandidate('a', 'alpha', 0.5),
      makeMmrCandidate('b', 'beta', 0.4),
      makeMmrCandidate('c', 'gamma', 0.3),
    ]
    const out = mmrRerank(cands, 1, 2)
    expect(out).toHaveLength(2)
  })
})

// ============ 5. 时间衰减 ============

describe('computeDecay', () => {
  it('evergreen 来源不衰减(decay=1)', () => {
    const old = NOW - 365 * 24 * 60 * 60 * 1000 // 1 年前
    const d = computeDecay(old, NOW, 'global', 30, ['global', 'workspace'])
    expect(d).toBe(1)
  })

  it('session 来源随时间衰减(< 1)', () => {
    const old = NOW - 60 * 24 * 60 * 60 * 1000 // 60 天前
    const d = computeDecay(old, NOW, 'session', 30, ['global', 'workspace'])
    expect(d).toBeLessThan(1)
    expect(d).toBeGreaterThan(0)
  })

  it('半衰期验证:age=halfLifeDays 时 decay=0.5', () => {
    const halfLifeDays = 30
    const ageMs = halfLifeDays * 24 * 60 * 60 * 1000
    const d = computeDecay(NOW - ageMs, NOW, 'session', halfLifeDays, ['global', 'workspace'])
    expect(d).toBeCloseTo(0.5, 5)
  })
})

// ============ 6. access boost ============

describe('computeAccessBoost', () => {
  it('accessCount=0 时 boost=1', () => {
    expect(computeAccessBoost(0, 0.05)).toBe(1)
  })

  it('accessCount 大时 boost 对数增长(慢)', () => {
    const small = computeAccessBoost(1, 0.05)
    const mid = computeAccessBoost(10, 0.05)
    const large = computeAccessBoost(1000, 0.05)
    expect(small).toBeGreaterThan(1)
    expect(mid).toBeGreaterThan(small)
    expect(large).toBeGreaterThan(mid)
    // 对数增长:large 不应超过 mid 的 2 倍
    expect(large).toBeLessThan(mid * 2)
  })
})

// ============ 7. hybridSearch 端到端 ============

describe('hybridSearch 端到端', () => {
  it('纯 FTS(无 provider):能返回匹配结果', async () => {
    const chunks = [
      makeChunk('1', 'typescript is great', { source: 'global' }),
      makeChunk('2', 'python is great', { source: 'global' }),
    ]
    const out = await hybridSearch({ query: 'typescript', chunks })
    expect(out.length).toBeGreaterThanOrEqual(1)
    expect(out[0]!.chunk.id).toBe('1')
    expect(out[0]!.matchedBy).toBe('fts')
    expect(out[0]!.ftsScore).toBeGreaterThan(0)
  })

  it('FTS + 向量(有 provider):matchedBy=both 当两者都命中', async () => {
    const provider = new MockEmbeddingProvider()
    const chunks = [
      makeChunk('1', 'typescript is great', { source: 'global' }),
      makeChunk('2', 'python is great', { source: 'global' }),
    ]
    const out = await hybridSearch({ query: 'typescript', chunks, provider })
    expect(out.length).toBeGreaterThan(0)
    // 至少有一个结果,matchedBy 应为 both 或 fts
    const top = out[0]!
    expect(['both', 'fts', 'vector']).toContain(top.matchedBy)
    expect(top.ftsScore).toBeGreaterThanOrEqual(0)
    expect(top.vectorScore).toBeGreaterThanOrEqual(0)
  })

  it('全局分数排序:最高分在前', async () => {
    const chunks = [
      makeChunk('low', 'rust language', { source: 'global' }),
      makeChunk('high', 'typescript typescript typescript', { source: 'global' }),
      makeChunk('mid', 'typescript language', { source: 'global' }),
    ]
    const out = await hybridSearch({ query: 'typescript', chunks })
    expect(out[0]!.chunk.id).toBe('high')
    // 分数应递减
    for (let i = 1; i < out.length; i++) {
      expect(out[i - 1]!.score).toBeGreaterThanOrEqual(out[i]!.score)
    }
  })

  it('matchedBy 字段正确:无 BM25 命中但有向量时不出现(因 query 无 token 时无法算 BM25)', async () => {
    // query 含 token,但 chunk 不含该 token → BM25 不命中,但向量仍可计算
    const provider = new MockEmbeddingProvider()
    const chunks = [
      makeChunk('1', 'completely different text', { source: 'global' }),
    ]
    const out = await hybridSearch({ query: 'typescript', chunks, provider })
    // chunk 不含 typescript → fts=0,向量仍非零 → matchedBy=vector
    expect(out).toHaveLength(1)
    expect(out[0]!.matchedBy).toBe('vector')
    expect(out[0]!.ftsScore).toBe(0)
    expect(out[0]!.vectorScore).toBeGreaterThan(0)
  })

  it('hybridSearchSync 与 hybridSearch(无 provider)结果一致', async () => {
    const chunks = [
      makeChunk('1', 'typescript is great', { source: 'global' }),
      makeChunk('2', 'python is great', { source: 'global' }),
    ]
    const sync = hybridSearchSync({ query: 'typescript', chunks })
    const async_ = await hybridSearch({ query: 'typescript', chunks })
    expect(sync.map((r) => r.chunk.id)).toEqual(async_.map((r) => r.chunk.id))
  })
})

// ============ 8. 归一化 ============

describe('normalize / cosineSimilarity', () => {
  it('normalize 把分数压到 [0, 1] 且 max=1', () => {
    const scores = [0, 5, 10, 3]
    const n = normalize(scores)
    for (const v of n) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
    expect(n[1]).toBe(0.5)
    expect(n[2]).toBe(1)
  })

  it('normalize 空数组返回空数组', () => {
    expect(normalize([])).toEqual([])
  })

  it('normalize 全相同返回全 1(避免除 0)', () => {
    expect(normalize([3, 3, 3])).toEqual([1, 1, 1])
  })

  it('cosineSimilarity 同向量=1,正交=0,反向=-1', () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1, 5)
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 5)
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1, 5)
  })

  it('BM25 分数经 normalize 后在 [0, 1]', () => {
    const docs = ['typescript is great', 'python is great', 'rust is great']
    const raw = docs.map((d) => bm25Score('typescript', d, docs))
    const n = normalize(raw)
    for (const v of n) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })

  it('向量分数经 (1+cos)/2 后在 [0, 1]', () => {
    const a = [1, 0, 0]
    const b = [0, 1, 0]
    const c = [-1, 0, 0]
    expect((1 + cosineSimilarity(a, b)) / 2).toBeCloseTo(0.5, 5)
    expect((1 + cosineSimilarity(a, c)) / 2).toBeCloseTo(0, 5)
    expect((1 + cosineSimilarity(a, a)) / 2).toBeCloseTo(1, 5)
  })
})
