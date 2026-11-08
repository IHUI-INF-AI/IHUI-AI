// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-139 / F-140 回归夹具。
 *
 * F-139:大文本入库必须「doc 与 chunk 同事务 + chunk 分批 insert + embedding 并发闸」。
 *   夹具用 600+ 切片并让 fake db 在单条 insert 超过 500 行时抛 "too many parameters"
 *   (PG 参数上限的真实症状)。改前:doc 已先提交、chunk 单条插入 600 行必抛;改后:
 *   500 一批通过,且 embedding 在途数不超过 8。
 * F-140:无 embedding 时的关键词兜底必须带 SQL LIMIT,不能把该 owner 全部 chunk
 *   拉进内存。夹具断言 select 链调用了 limit(2000)。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// ── embedding provider:可控开关 + 在途计数 ──
const embedState = vi.hoisted(() => ({
  enabled: true,
  inFlight: 0,
  maxInFlight: 0,
  calls: 0,
  reset() {
    this.enabled = true
    this.inFlight = 0
    this.maxInFlight = 0
    this.calls = 0
  },
}))

vi.mock('../embedding-provider.js', () => ({
  getEmbeddingProvider: () => {
    if (!embedState.enabled) return null
    return {
      async embed(texts: string[]) {
        embedState.calls += texts.length
        embedState.inFlight += texts.length
        embedState.maxInFlight = Math.max(embedState.maxInFlight, embedState.inFlight)
        await new Promise((r) => setTimeout(r, 0))
        embedState.inFlight -= texts.length
        return texts.map(() => new Array<number>(1536).fill(0))
      },
    }
  },
}))

vi.mock('@ihui/database', async () => await import('@ihui/database'))

// ── fake db:内存表 + 事务缓冲 + 单语句 500 行上限(PG 参数上限的替身) ──
const mem = vi.hoisted(() => ({
  docs: [] as Array<Record<string, unknown>>,
  chunks: [] as Array<Record<string, unknown>>,
  seq: 0,
  failChunks: false,
  insertBatches: [] as number[],
  selectLimits: [] as number[],
  reset() {
    this.docs.length = 0
    this.chunks.length = 0
    this.seq = 0
    this.failChunks = false
    this.insertBatches.length = 0
    this.selectLimits.length = 0
  },
}))

vi.mock('../../db/index.js', async () => {
  const { getTableName } = await import('drizzle-orm')
  const tableName = (t: unknown): string => {
    try {
      return getTableName(t as Parameters<typeof getTableName>[0])
    } catch {
      return ''
    }
  }
  const CHUNK = 'zhs_knowledge_chunk'
  const DOC = 'zhs_knowledge_doc'

  type Buffer = { docs: Array<Record<string, unknown>>; chunks: Array<Record<string, unknown>> }

  const makeInsert = (buffer: Buffer) => (table: unknown) => {
    const st = { values: undefined as unknown }
    const chain: Record<string, unknown> = {
      values(v: unknown) {
        st.values = v
        return chain
      },
      returning() {
        const doc = { id: ++mem.seq, ...(st.values as Record<string, unknown>) }
        buffer.docs.push(doc)
        return Promise.resolve([{ id: doc.id }])
      },
      then(onF?: (v: unknown) => unknown, onR?: (e: unknown) => unknown) {
        const name = tableName(table)
        if (name === CHUNK) {
          const rows = st.values as Array<Record<string, unknown>>
          mem.insertBatches.push(rows.length)
          if (mem.failChunks) throw new Error('too many parameters')
          if (rows.length > 500) throw new Error('too many parameters')
          buffer.chunks.push(...rows)
        }
        return Promise.resolve([]).then(onF, onR)
      },
    }
    return chain
  }

  const makeSelect = () => {
    const st: { limit?: number } = {}
    const chain: Record<string, unknown> = {}
    for (const m of ['from', 'where', 'orderBy']) chain[m] = () => chain
    chain.limit = (n: number) => {
      st.limit = n
      mem.selectLimits.push(n)
      return chain
    }
    chain.then = (onF?: (v: unknown) => unknown, onR?: (e: unknown) => unknown) => {
      const rows = st.limit === undefined ? mem.chunks : mem.chunks.slice(0, st.limit)
      return Promise.resolve(rows).then(onF, onR)
    }
    return chain
  }

  const makeDb = (buffer: Buffer) => ({
    insert: makeInsert(buffer),
    select: makeSelect,
    execute: async () => [],
    update: () => ({ set: () => ({ where: async () => [] }) }),
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      const txBuffer: Buffer = { docs: [], chunks: [] }
      const result = await fn(makeDb(txBuffer))
      mem.docs.push(...txBuffer.docs)
      mem.chunks.push(...txBuffer.chunks)
      return result
    },
  })

  const rootBuffer: Buffer = {
    get docs() {
      return mem.docs
    },
    get chunks() {
      return mem.chunks
    },
  } as Buffer
  const db = makeDb(rootBuffer)
  return { db, dbRead: db }
})

import { knowledgeRagService } from '../knowledge-rag-service.js'

describe('F-139 大文本入库(事务 + 分批 + 并发闸)', () => {
  beforeEach(() => {
    mem.reset()
    embedState.reset()
  })

  it('600+ 切片:chunk 分批插入(每批 ≤500),doc.chunkCount 与实际行数一致', async () => {
    const text = ('x'.repeat(449) + '\n').repeat(700)
    const chunkCount = await knowledgeRagService.ingestText({
      ownerUuid: 'u1',
      title: 'big',
      text,
    })
    expect(chunkCount).toBeGreaterThan(500)
    expect(mem.docs).toHaveLength(1)
    expect(mem.docs[0]!.chunkCount).toBe(chunkCount)
    expect(mem.chunks).toHaveLength(chunkCount)
    expect(Math.max(...mem.insertBatches)).toBeLessThanOrEqual(500)
    expect(mem.insertBatches.length).toBeGreaterThan(1)
    expect(mem.chunks[0]!.docId).toBe(mem.docs[0]!.id)
    // embedding 并发闸:绝不允许一次在途 600+
    expect(embedState.maxInFlight).toBeLessThanOrEqual(8)
    expect(embedState.maxInFlight).toBeGreaterThan(1)
  })

  it('chunk 落库失败时整体回滚,不留下空壳 doc', async () => {
    mem.failChunks = true
    const text = ('y'.repeat(449) + '\n').repeat(700)
    await expect(
      knowledgeRagService.ingestText({ ownerUuid: 'u1', title: 'fail', text }),
    ).rejects.toThrow('too many parameters')
    expect(mem.docs).toHaveLength(0)
    expect(mem.chunks).toHaveLength(0)
  })
})

describe('F-140 关键词兜底候选上限', () => {
  beforeEach(() => {
    mem.reset()
    embedState.reset()
  })

  it('无 embedding 时 select 带 LIMIT(2000),不再全表拉取', async () => {
    embedState.enabled = false
    for (let i = 0; i < 3000; i++) {
      mem.chunks.push({
        id: i + 1,
        docId: 1,
        collectionName: 'default',
        ownerUuid: 'u1',
        chunkIndex: i,
        content: i === 0 ? 'needle keyword' : `other ${i}`,
      })
    }
    const hits = await knowledgeRagService.search({
      query: 'needle',
      ownerUuid: 'u1',
      collectionName: 'default',
      topK: 5,
      scoreThreshold: 0.01,
    })
    expect(mem.selectLimits).toContain(2000)
    expect(hits.length).toBe(1)
    expect(hits[0]!.content).toContain('needle')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
