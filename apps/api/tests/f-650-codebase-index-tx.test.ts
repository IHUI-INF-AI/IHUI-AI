// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-650 回归锁(2026-11-13)。
 *
 * 病灶:indexChunks 先按 filePath 逐条 DELETE 旧切片,再(异常被静默吞掉的)embedding、
 * 再分批 INSERT,删/插分属两个事务。任一插入批次失败 ⇒ 旧切片已删、新切片未写,
 * 该文件从检索面整体消失,用户只看到 500。
 *
 * 本文件锁:
 *   ① 删除旧切片与分批插入在**同一事务**内(全部 operators 走 tx,顺序 delete → insert);
 *   ② 插入失败整体回滚,旧切片一条不丢;
 *   ③ embedding 失败直接抛出,且**不触发任何删除**(旧索引原样保留);
 *   ④ 成功路径:批次数(indexed 统计)与返回值语义不变;
 *   ⑤ 已带 1536 维向量的切片不重复嵌入,vectorized / localEmbedded 统计正确。
 *
 * 不连库:mock db(tx 带快照回滚)与 embedding-provider,用 PgDialect 解析真实 where
 * 参数做行级匹配。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'

const REPO_ID = 'repo-f650'
const OWNER = 'owner-f650'
const FILE_A = 'src/a.ts'
const FILE_B = 'src/b.ts'

interface StoreRow {
  repoId: string
  filePath: string
  ownerUuid: string
  [key: string]: unknown
}

const { state } = vi.hoisted(() => ({
  state: {
    tableRows: [] as StoreRow[],
    txCalls: 0,
    writeOrder: [] as string[],
    deleteCalls: [] as Array<{ scope: 'db' | 'tx'; where: unknown }>,
    insertCalls: [] as Array<{ scope: 'db' | 'tx'; count: number }>,
    insertSeq: 0,
    failInsertAt: -1,
    provider: null as null | { name: string; embed: (texts: string[]) => Promise<number[][]> },
    embedTexts: [] as string[][],
  },
}))

vi.mock('../src/services/embedding-provider.js', () => ({
  getEmbeddingProvider: () => state.provider,
}))

vi.mock('../src/db/index.js', () => {
  const dialect = new PgDialect()

  // 行级匹配:where 参数里同时出现该行的 filePath / repoId / ownerUuid 即命中
  function matches(where: unknown, row: StoreRow): boolean {
    const params = dialect.sqlToQuery(where as Parameters<PgDialect['sqlToQuery']>[0])
      .params as unknown[]
    return (
      params.includes(row.filePath) &&
      params.includes(row.repoId) &&
      params.includes(row.ownerUuid)
    )
  }

  function makeClient(scope: 'db' | 'tx') {
    return {
      delete: vi.fn(() => ({
        where: async (where: unknown) => {
          state.deleteCalls.push({ scope, where })
          state.writeOrder.push('delete')
          state.tableRows = state.tableRows.filter((row) => !matches(where, row))
        },
      })),
      insert: vi.fn(() => ({
        values: async (batch: unknown[]) => {
          const seq = state.insertSeq++
          state.insertCalls.push({ scope, count: batch.length })
          state.writeOrder.push('insert')
          if (state.failInsertAt === seq) throw new Error('insert batch failed')
          state.tableRows.push(...(batch as StoreRow[]))
        },
      })),
    }
  }

  return {
    db: {
      ...makeClient('db'),
      transaction: vi.fn(async (fn: (tx: unknown) => unknown) => {
        state.txCalls += 1
        const snapshot = state.tableRows.map((row) => ({ ...row }))
        try {
          return await fn(makeClient('tx'))
        } catch (e) {
          // 事务回滚:恢复到进入事务那一刻的快照
          state.tableRows = snapshot
          throw e
        }
      }),
    },
  }
})

import { codebaseIndexService } from '../src/services/codebase-index-service.js'
import type { ChunkInput } from '../src/services/codebase-index-service.js'

function chunk(filePath: string, i: number, extra: Partial<ChunkInput> = {}): ChunkInput {
  return {
    filePath,
    lineStart: i * 10 + 1,
    lineEnd: i * 10 + 10,
    content: `// ${filePath}#${i}`,
    ...extra,
  }
}

function oldRow(filePath: string, i: number): StoreRow {
  return {
    repoId: REPO_ID,
    filePath,
    ownerUuid: OWNER,
    content: `old ${filePath}#${i}`,
  }
}

function vec(): number[] {
  return new Array(1536).fill(0.1)
}

beforeEach(() => {
  state.tableRows = []
  state.txCalls = 0
  state.writeOrder.length = 0
  state.deleteCalls.length = 0
  state.insertCalls.length = 0
  state.insertSeq = 0
  state.failInsertAt = -1
  state.provider = null
  state.embedTexts.length = 0
})

describe('indexChunks:删旧 + 插新同一事务(F-650)', () => {
  it('按文件删除与分批插入全部走 tx,且删除先于插入', async () => {
    const result = await codebaseIndexService.indexChunks(
      REPO_ID,
      [chunk(FILE_A, 0), chunk(FILE_A, 1), chunk(FILE_B, 0)],
      OWNER,
    )

    expect(state.txCalls).toBe(1)
    expect(state.deleteCalls).toHaveLength(2)
    expect(state.deleteCalls.every((d) => d.scope === 'tx')).toBe(true)
    expect(state.insertCalls).toHaveLength(1)
    expect(state.insertCalls[0]?.scope).toBe('tx')
    expect(state.writeOrder).toEqual(['delete', 'delete', 'insert'])

    expect(result).toEqual({ indexed: 3, vectorized: 0, localEmbedded: 0 })
    expect(state.tableRows).toHaveLength(3)
    expect(state.tableRows.every((r) => r.ownerUuid === OWNER && r.repoId === REPO_ID)).toBe(true)
  })

  it('插入批次失败:整体回滚,旧切片一条不丢', async () => {
    state.tableRows = [oldRow(FILE_A, 0), oldRow(FILE_A, 1)]
    // 150 条 → 两批(100 + 50),让第二批失败
    state.failInsertAt = 1

    const chunks = Array.from({ length: 150 }, (_, i) => chunk(FILE_A, i))

    await expect(codebaseIndexService.indexChunks(REPO_ID, chunks, OWNER)).rejects.toThrow(
      'insert batch failed',
    )

    expect(state.txCalls).toBe(1)
    expect(state.insertCalls.map((c) => c.count)).toEqual([100, 50])
    // 回滚后仍是原来那两条旧切片,一条都不少,也没有新切片残留
    expect(state.tableRows).toHaveLength(2)
    expect(state.tableRows.map((r) => r.content)).toEqual([
      `old ${FILE_A}#0`,
      `old ${FILE_A}#1`,
    ])
  })

  it('embedding 失败:直接抛出且不触发任何删除', async () => {
    state.tableRows = [oldRow(FILE_A, 0)]
    state.provider = {
      name: 'mock',
      embed: async () => {
        throw new Error('embedding down')
      },
    }

    await expect(
      codebaseIndexService.indexChunks(REPO_ID, [chunk(FILE_A, 0), chunk(FILE_A, 1)], OWNER),
    ).rejects.toThrow('embedding down')

    expect(state.txCalls).toBe(0)
    expect(state.deleteCalls).toHaveLength(0)
    expect(state.insertCalls).toHaveLength(0)
    expect(state.tableRows).toHaveLength(1)
  })

  it('成功路径:250 条按 100 分批,统计与返回值不变', async () => {
    const chunks = Array.from({ length: 250 }, (_, i) =>
      chunk(i < 200 ? FILE_A : FILE_B, i),
    )

    const result = await codebaseIndexService.indexChunks(REPO_ID, chunks, OWNER)

    expect(state.insertCalls.map((c) => c.count)).toEqual([100, 100, 50])
    expect(state.insertCalls.every((c) => c.scope === 'tx')).toBe(true)
    expect(result).toEqual({ indexed: 250, vectorized: 0, localEmbedded: 0 })
    expect(state.tableRows).toHaveLength(250)
    expect(state.tableRows.every((r) => r.embedding === null)).toBe(true)
    expect(state.tableRows.every((r) => r.expiresAt instanceof Date)).toBe(true)
  })

  it('已有向量的切片不重复嵌入,vectorized / localEmbedded 统计正确', async () => {
    state.provider = {
      name: 'mock',
      embed: async (texts) => {
        state.embedTexts.push(texts)
        return texts.map(() => vec())
      },
    }

    const chunks = [
      chunk(FILE_A, 0),
      chunk(FILE_A, 1),
      chunk(FILE_A, 2),
      chunk(FILE_B, 0, { embedding: vec() }),
      chunk(FILE_B, 1, { embedding: vec(), embeddingProvider: 'local-hash' }),
    ]

    const result = await codebaseIndexService.indexChunks(REPO_ID, chunks, OWNER)

    expect(state.embedTexts).toHaveLength(1)
    expect(state.embedTexts[0]).toHaveLength(3)
    expect(result).toEqual({ indexed: 5, vectorized: 3, localEmbedded: 1 })

    const inserted = state.tableRows
    expect(inserted.filter((r) => r.embeddingProvider === 'remote')).toHaveLength(4)
    expect(inserted.filter((r) => r.embeddingProvider === 'local-hash')).toHaveLength(1)
    expect(inserted.every((r) => Array.isArray(r.embedding))).toBe(true)
  })
})
