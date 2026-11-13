// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-145 回归锁(2026-11-13)。
 *
 * 病灶:知识库删除文档 = 软删 `knowledge_doc.status` + 物理删 `knowledge_chunk` 两步,
 * 修复前两步各自独立提交(`db.update` 后 `db.delete`)。第二步失败时 status 已在库中变成
 * 'deleted'(列表页看不到该文档,用户以为删了),但 chunk 仍在;而 RAG 检索只查 chunk 表、
 * 从不 join doc.status ⇒ 已删内容继续被注入聊天 prompt 并作为引用下发(隐私/合规)。
 *
 * 本文件锁:
 *   ① 删除必须走同一 `db.transaction`:软删状态与物理删 chunk 都在 tx 内,且先改状态后删 chunk;
 *      根 db 上不得出现任何写操作(否则回滚救不回来)。
 *   ② 事务内任一步抛错 → 整体失败回滚,不出现「状态已改但 chunk 未删」的半删状态。
 *   ③ 检索谓词:EXISTS 关联 knowledge_doc 且只认 status='active';
 *      向量路 SQL 与关键词路 where 都真实带上该谓词。
 *
 * 只 mock db / embedding-provider,不连真实 PG、不触达外部 embedding 服务。
 */
import { getTableName } from 'drizzle-orm'
import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  db: {
    select: vi.fn(),
    execute: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
  },
  tx: {
    select: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  getEmbeddingProvider: vi.fn(),
}))

vi.mock('../src/db/index.js', () => ({
  db: mocks.db,
  dbRead: { select: vi.fn() },
  dbClient: {},
}))

vi.mock('../src/services/embedding-provider.js', () => ({
  getEmbeddingProvider: mocks.getEmbeddingProvider,
}))

import {
  knowledgeRagService,
  KNOWLEDGE_ACTIVE_DOC_EXISTS_SQL,
} from '../src/services/knowledge-rag-service.js'

/** 删除路径的内存替身状态(模拟 doc.status 与 chunk 行) */
interface FakeStore {
  docStatus: string
  chunks: number[]
}

/**
 * 让 mock 的 transaction 具备 PostgreSQL 语义:回调抛错即回滚到进入事务前的快照。
 *
 * 这不是在测 mock —— 它让「半删状态」成为可观测事实:若被测代码把某条写操作落在根 db 上
 * (绕过事务),回滚就盖不住它,store 会留在半删状态,断言即失败。
 */
function installTransactionalStore(store: FakeStore): void {
  mocks.tx.select.mockImplementation(() => ({
    from: () => ({ where: () => ({ limit: async () => [{ id: 1 }] }) }),
  }))
  mocks.tx.update.mockImplementation(() => ({
    set: (values: { status?: string }) => ({
      where: async () => {
        if (values.status) store.docStatus = values.status
      },
    }),
  }))
  mocks.tx.delete.mockImplementation(() => ({
    where: async () => {
      store.chunks = []
    },
  }))
  mocks.db.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
    const snapshot: FakeStore = { docStatus: store.docStatus, chunks: [...store.chunks] }
    try {
      return await fn(mocks.tx)
    } catch (e) {
      store.docStatus = snapshot.docStatus
      store.chunks = snapshot.chunks
      throw e
    }
  })
}

/**
 * 从 drizzle SQL 树里找「active 文档」谓词。
 *
 * `sql.raw()` 落成 StringChunk(`value: string[]`),再被 and/join 嵌进外层 SQL 的
 * queryChunks ⇒ 递归只沿 queryChunks 走即可,不碰 Column/Param 的其它字段。
 */
function containsActiveDocExists(node: unknown): boolean {
  const seen = new Set<unknown>()
  const walk = (n: unknown): boolean => {
    if (n === null || n === undefined) return false
    if (typeof n === 'string') return n.includes('EXISTS (') && n.includes("'active'")
    if (typeof n !== 'object') return false
    if (seen.has(n)) return false
    seen.add(n)
    if (Array.isArray(n)) return n.some(walk)
    const chunkValue = (n as { value?: unknown }).value
    if (Array.isArray(chunkValue) && chunkValue.every((v) => typeof v === 'string')) {
      const text = chunkValue.join('')
      if (text.includes('EXISTS (') && text.includes("'active'")) return true
    }
    const chunks = (n as { queryChunks?: unknown }).queryChunks
    return Array.isArray(chunks) ? chunks.some(walk) : false
  }
  return walk(node)
}

describe('F-145 删除文档两步同事务 + 检索只召回 active 文档', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getEmbeddingProvider.mockReturnValue(null)
  })

  it('① 删除走同一事务:tx 内先软删状态、再物理删 chunk,根 db 无写操作', async () => {
    const store: FakeStore = { docStatus: 'active', chunks: [11, 12, 13] }
    installTransactionalStore(store)

    const ok = await knowledgeRagService.deleteDoc(1, 'f145-user')

    expect(ok).toBe(true)
    expect(mocks.db.transaction).toHaveBeenCalledTimes(1)
    // 两条写语句都在事务连接上执行,且目标表正确
    expect(mocks.tx.update).toHaveBeenCalledTimes(1)
    expect(getTableName(mocks.tx.update.mock.calls[0]![0])).toBe('zhs_knowledge_doc')
    expect(mocks.tx.delete).toHaveBeenCalledTimes(1)
    expect(getTableName(mocks.tx.delete.mock.calls[0]![0])).toBe('zhs_knowledge_chunk')
    // 顺序:先改状态,后删 chunk
    expect(mocks.tx.update.mock.invocationCallOrder[0]!).toBeLessThan(
      mocks.tx.delete.mock.invocationCallOrder[0]!,
    )
    // 写操作不得绕过事务落到根 db(否则回滚救不回半删状态)
    expect(mocks.db.update).not.toHaveBeenCalled()
    expect(mocks.db.delete).not.toHaveBeenCalled()
    // 事务成功后两件事都完成
    expect(store.docStatus).toBe('deleted')
    expect(store.chunks).toHaveLength(0)
  })

  it('② 删 chunk 失败 → 整体失败回滚,不出现「状态已改但 chunk 未删」', async () => {
    const store: FakeStore = { docStatus: 'active', chunks: [11, 12, 13] }
    installTransactionalStore(store)
    mocks.tx.delete.mockImplementation(() => ({
      where: async () => {
        throw new Error('chunk delete failed')
      },
    }))

    await expect(knowledgeRagService.deleteDoc(1, 'f145-user')).rejects.toThrow(
      'chunk delete failed',
    )

    expect(mocks.db.transaction).toHaveBeenCalledTimes(1)
    // 软删语句确实执行过(失败发生在它之后)……
    expect(mocks.tx.update).toHaveBeenCalledTimes(1)
    // ……但事务回滚后 doc 仍是 active、chunk 一条不少:不存在半删状态
    expect(store.docStatus).toBe('active')
    expect(store.chunks).toEqual([11, 12, 13])
    // 关键前提:没有任何写操作落在根 db 上(绕过事务的写无法回滚)
    expect(mocks.db.update).not.toHaveBeenCalled()
    expect(mocks.db.delete).not.toHaveBeenCalled()
  })

  it('③ 检索谓词:EXISTS 关联 knowledge_doc 且只认 status=active', () => {
    expect(KNOWLEDGE_ACTIVE_DOC_EXISTS_SQL).toContain('EXISTS (')
    expect(KNOWLEDGE_ACTIVE_DOC_EXISTS_SQL).toContain('"d"."id" = "zhs_knowledge_chunk"."doc_id"')
    expect(KNOWLEDGE_ACTIVE_DOC_EXISTS_SQL).toContain(`"d"."status" = 'active'`)
  })

  it('④ 向量路 SQL 带 active 文档过滤(已删文档的残留 chunk 不被召回)', async () => {
    mocks.getEmbeddingProvider.mockReturnValue({
      name: 'f145-test',
      embed: async () => [new Array<number>(1536).fill(0.01)],
    })
    mocks.db.execute.mockResolvedValue([])

    const hits = await knowledgeRagService.search({ query: '已删除的机密文档', ownerUuid: 'u1' })

    expect(hits).toEqual([])
    expect(mocks.db.execute).toHaveBeenCalledTimes(1)
    expect(containsActiveDocExists(mocks.db.execute.mock.calls[0]![0])).toBe(true)
  })

  it('⑤ 关键词路 where 带 active 文档过滤(embedding 不可用时同样不召回)', async () => {
    let whereArg: unknown
    mocks.db.select.mockImplementation(() => ({
      from: () => ({
        where: (cond: unknown) => {
          whereArg = cond
          return { limit: async () => [] }
        },
      }),
    }))

    const hits = await knowledgeRagService.search({ query: '已删除的机密文档', ownerUuid: 'u1' })

    expect(hits).toEqual([])
    expect(whereArg).toBeDefined()
    expect(containsActiveDocExists(whereArg)).toBe(true)
  })
})
