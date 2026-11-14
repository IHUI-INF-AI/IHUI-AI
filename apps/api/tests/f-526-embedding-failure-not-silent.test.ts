// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * F-526 回归锁(2026-11-13)。
 *
 * 病灶:`getEmbedding` 用空 catch 把上游失败吞成 `null`,`_ingestChunks` 再把
 * `embedding=null` 当合法值写库并照常返回 chunkCount ⇒ key 失效 / 配额耗尽 /
 * 上游 5xx / 超时 / 维度不符时,上传与 /ingest 全部"成功",整库静默失去语义检索。
 *
 * 本文件锁:
 *   ① embedding 抛错 → 抛 EmbeddingGenerationError,不落任何 doc/chunk(NULL 向量不入库);
 *   ② 错误体 + 日志都带 failed 计数与总块数,调用方可见失败规模;
 *   ③ provider 返回维度不符的向量 → 同样整批失败,不得置 NULL 继续入库;
 *   ④ 续写已有 doc(ingestFile 带 docId)失败 → 目标 doc 回写 status=failed,
 *      且不写任何 chunk(既有切片不参与检索,因为检索只认 active 文档);
 *   ⑤ 正常路径不变:1536 维向量照常落库;
 *   ⑥ 检索侧 query embedding 失败仍降级关键词(不抛 500),但必须留结构化 warn 日志。
 *
 * 只打桩 db / document-parser / embedding-provider / logger,不连真实 PG 与向量库。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const embedState = vi.hoisted(() => ({
  mode: 'ok' as 'ok' | 'throw' | 'bad-dim',
  calls: 0,
  reset() {
    this.mode = 'ok'
    this.calls = 0
  },
}))

vi.mock('../src/services/embedding-provider.js', () => ({
  getEmbeddingProvider: () => ({
    name: 'f526-stub',
    async embed(texts: string[]) {
      embedState.calls += texts.length
      if (embedState.mode === 'throw') throw new Error('upstream embedding 503')
      if (embedState.mode === 'bad-dim') return texts.map(() => new Array<number>(3).fill(0))
      return texts.map(() => new Array<number>(1536).fill(0))
    },
  }),
}))

vi.mock('../src/services/document-parser.js', () => ({
  parseDocument: async () => 'F-526 测试文档正文,用于触发 ingestFile 入库路径。',
}))

vi.mock('../src/utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const mem = vi.hoisted(() => ({
  docs: [] as Array<Record<string, unknown>>,
  chunks: [] as Array<Record<string, unknown>>,
  updates: [] as Array<{ table: string; values: Record<string, unknown> }>,
  seq: 0,
  reset() {
    this.docs.length = 0
    this.chunks.length = 0
    this.updates.length = 0
    this.seq = 0
  },
}))

vi.mock('../src/db/index.js', async () => {
  const { getTableName } = await import('drizzle-orm')
  const tableName = (t: unknown): string => {
    try {
      return getTableName(t as Parameters<typeof getTableName>[0])
    } catch {
      return ''
    }
  }
  const CHUNK = 'zhs_knowledge_chunk'

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
        if (tableName(table) === CHUNK) {
          buffer.chunks.push(...(st.values as Array<Record<string, unknown>>))
        }
        return Promise.resolve([]).then(onF, onR)
      },
    }
    return chain
  }

  const makeSelect = () => {
    const chain: Record<string, unknown> = {}
    for (const m of ['from', 'where', 'orderBy', 'limit']) chain[m] = () => chain
    chain.then = (onF?: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
      Promise.resolve([]).then(onF, onR)
    return chain
  }

  const makeDb = (buffer: Buffer) => ({
    insert: makeInsert(buffer),
    select: makeSelect,
    execute: async () => [],
    update: (table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: async () => {
          mem.updates.push({ table: tableName(table), values })
          return []
        },
      }),
    }),
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      const txBuffer: Buffer = { docs: [], chunks: [] }
      const result = await fn(makeDb(txBuffer))
      // 事务提交:失败时 fn 抛错,走不到这里(与真实回滚等价)
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

import { knowledgeRagService, EmbeddingGenerationError } from '../src/services/knowledge-rag-service.js'
import { logger } from '../src/utils/logger.js'

/** 1200 字符 → 3 个切片,用于断言"全部块失败"的计数 */
const LONG_TEXT = 'F-526 长文本入库失败用例。'.repeat(80)

function rejected(p: Promise<unknown>): Promise<Error> {
  return p.then(
    () => {
      throw new Error('expected rejection, got success')
    },
    (e: Error) => e,
  )
}

beforeEach(() => {
  mem.reset()
  embedState.reset()
  vi.mocked(logger.error).mockClear()
  vi.mocked(logger.warn).mockClear()
})

describe('F-526 入库链路 embedding 失败不得静默', () => {
  it('provider 抛错:整批失败,不写任何 doc/chunk(NULL 向量不入库)', async () => {
    embedState.mode = 'throw'
    const err = await rejected(
      knowledgeRagService.ingestText({ ownerUuid: 'u1', title: 'fail', text: LONG_TEXT }),
    )

    expect(err).toBeInstanceOf(EmbeddingGenerationError)
    const embedErr = err as EmbeddingGenerationError
    expect(embedErr.code).toBe('EMBEDDING_GENERATION_FAILED')
    expect(embedErr.provider).toBe('f526-stub')
    expect(embedErr.totalChunks).toBeGreaterThan(1)
    expect(embedErr.failedChunks).toBe(embedErr.totalChunks)

    // 关键:没有任何行以 embedding=NULL 落库,也没有半截 doc
    expect(mem.docs).toHaveLength(0)
    expect(mem.chunks).toHaveLength(0)
  })

  it('错误体与 error 日志都带 failed 计数,调用方可见失败规模', async () => {
    embedState.mode = 'throw'
    const err = (await rejected(
      knowledgeRagService.ingestText({ ownerUuid: 'u1', title: 'fail', text: LONG_TEXT }),
    )) as EmbeddingGenerationError

    expect(err.message).toContain('failed=')
    expect(err.message).toContain(String(err.failedChunks))

    const logCall = vi
      .mocked(logger.error)
      .mock.calls.find((c) => String(c[0]).includes('embedding'))
    expect(logCall).toBeDefined()
    const meta = logCall![1] as Record<string, unknown>
    expect(meta.failedChunks).toBe(err.failedChunks)
    expect(meta.totalChunks).toBe(err.totalChunks)
    expect(meta.provider).toBe('f526-stub')
  })

  it('provider 返回非 1536 维向量:同样整批失败,不置 NULL 继续入库', async () => {
    embedState.mode = 'bad-dim'
    const err = await rejected(
      knowledgeRagService.ingestText({ ownerUuid: 'u1', title: 'bad-dim', text: LONG_TEXT }),
    )

    expect(err).toBeInstanceOf(EmbeddingGenerationError)
    expect((err as EmbeddingGenerationError).failedChunks).toBeGreaterThan(0)
    expect(mem.docs).toHaveLength(0)
    expect(mem.chunks).toHaveLength(0)
  })

  it('续写已有 doc 时失败:doc 回写 status=failed,且不写任何 chunk', async () => {
    embedState.mode = 'throw'
    const err = await rejected(
      knowledgeRagService.ingestFile({
        ownerUuid: 'u1',
        title: 'existing',
        buffer: Buffer.from('doc'),
        mimeType: 'text/plain',
        filename: 'a.txt',
        docId: 42,
      }),
    )

    expect(err).toBeInstanceOf(EmbeddingGenerationError)
    expect(mem.chunks).toHaveLength(0)
    expect(mem.updates).toHaveLength(1)
    expect(mem.updates[0]!.table).toBe('zhs_knowledge_doc')
    expect(mem.updates[0]!.values).toMatchObject({ status: 'failed' })
  })

  it('正常路径不变:1536 维向量照常落库', async () => {
    const chunkCount = await knowledgeRagService.ingestText({
      ownerUuid: 'u1',
      title: 'ok',
      text: LONG_TEXT,
    })

    expect(chunkCount).toBeGreaterThan(1)
    expect(mem.docs).toHaveLength(1)
    expect(mem.chunks).toHaveLength(chunkCount)
    for (const chunk of mem.chunks) {
      expect(Array.isArray(chunk.embedding)).toBe(true)
      expect((chunk.embedding as number[]).length).toBe(1536)
    }
  })

  it('检索侧 query embedding 失败仍降级关键词(不抛 500),并留结构化 warn 日志', async () => {
    embedState.mode = 'throw'
    const hits = await knowledgeRagService.search({ query: '关键词', ownerUuid: 'u1' })

    expect(hits).toEqual([])
    const warnCall = vi
      .mocked(logger.warn)
      .mock.calls.find((c) => String(c[0]).includes('F-526'))
    expect(warnCall).toBeDefined()
    expect((warnCall![1] as Record<string, unknown>).provider).toBe('f526-stub')
  })
})
