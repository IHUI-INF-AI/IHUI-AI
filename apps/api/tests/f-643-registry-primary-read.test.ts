// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-643 回归锁(2026-11-13)。
 *
 * 病灶:registry 同步的存在性/版本判定读 dbRead(只读副本),写入走主库 db;
 * 副本延迟窗口内 inserted/skipped/oldVersion 失真(审计链断档 / 主库停留旧版本)。
 *
 * 本文件锁:
 *   ① 单条 upsert 的判定读主库事务(tx),不触达 dbRead;inserted 由 xmax 原子判定;
 *   ② oldVersion 与主库既有行一致,新插入时为 null;
 *   ③ 批量 upsert 的判定与写入在同一事务内完成(tx.select + tx.insert);
 *   ④ getRegistryItemVersion 的版本判定读主库。
 *
 * 只 mock db/dbRead/computePayloadHash,不触达真实 PG。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { RawRegistryItem } from '../src/services/registry-sync/types.js'

const {
  mockDbSelect,
  mockDbInsert,
  mockDbTransaction,
  mockTxSelect,
  mockTxInsert,
  mockDbReadSelect,
  mockComputePayloadHash,
} = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
  mockDbInsert: vi.fn(),
  mockDbTransaction: vi.fn(),
  mockTxSelect: vi.fn(),
  mockTxInsert: vi.fn(),
  mockDbReadSelect: vi.fn(),
  mockComputePayloadHash: vi.fn().mockResolvedValue('mock-hash'),
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col: unknown, val: unknown) => ({ op: 'eq', col, val })),
  and: vi.fn((...conds: unknown[]) => ({ op: 'and', conds })),
  or: vi.fn((...conds: unknown[]) => ({ op: 'or', conds })),
  desc: vi.fn((col: unknown) => ({ op: 'desc', col })),
  ilike: vi.fn((col: unknown, pattern: unknown) => ({ op: 'ilike', col, pattern })),
  sql: Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => ({ op: 'sql', strings, values }),
    {
      raw: vi.fn((s: string) => ({ op: 'sql-raw', raw: s })),
      join: vi.fn((values: unknown[], sep: unknown) => ({ op: 'sql-join', values, sep })),
    },
  ),
}))

vi.mock('@ihui/database', () => ({
  registryItems: {
    id: 'id',
    sourceType: 'source_type',
    source: 'source',
    sourceId: 'source_id',
    name: 'name',
    description: 'description',
    version: 'version',
    author: 'author',
    homepage: 'homepage',
    repoUrl: 'repo_url',
    downloadUrl: 'download_url',
    categories: 'categories',
    tags: 'tags',
    heatScore: 'heat_score',
    qualityScore: 'quality_score',
    latestSyncedAt: 'latest_synced_at',
    payload: 'payload',
    payloadHash: 'payload_hash',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  registrySyncLogs: {},
  registryWebhookTriggers: {},
}))

vi.mock('../src/db/index.js', () => {
  // 事务句柄与主库本身分开打桩:用例据此断言"判定与写入都发生在同一个 tx 上"。
  const tx = { select: mockTxSelect, insert: mockTxInsert }
  return {
    db: {
      select: mockDbSelect,
      insert: mockDbInsert,
      transaction: (fn: (inner: typeof tx) => unknown) => {
        mockDbTransaction()
        return fn(tx)
      },
    },
    dbRead: { select: mockDbReadSelect, execute: vi.fn() },
  }
})

vi.mock('../src/services/registry-sync/index.js', () => ({
  computePayloadHash: mockComputePayloadHash,
}))

import {
  batchUpsertRegistryItems,
  getRegistryItemVersion,
  upsertRegistryItem,
} from '../src/db/registry-queries.js'

/** drizzle 查询构建器是链式 + thenable;所有链方法返回自身,await 时取最终值。 */
function makeChain(finalValue: unknown) {
  const chain: Record<string, unknown> & { then?: unknown } = {
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(finalValue).then(resolve, reject),
  }
  for (const method of [
    'from',
    'where',
    'orderBy',
    'limit',
    'offset',
    'values',
    'onConflictDoUpdate',
    'returning',
    'set',
  ]) {
    chain[method] = vi.fn().mockReturnValue(chain)
  }
  return chain as Record<string, ReturnType<typeof vi.fn>> & {
    then: (resolve: (v: unknown) => unknown) => Promise<unknown>
  }
}

function rawItem(overrides: Partial<RawRegistryItem> = {}): RawRegistryItem {
  return {
    sourceType: 'mcp',
    source: 'mcp_marketplace',
    sourceId: 'srv-1',
    name: 'Demo MCP',
    description: null,
    version: '1.0.0',
    author: null,
    homepage: 'https://example.com/home',
    repoUrl: 'https://github.com/acme/demo',
    downloadUrl: null,
    categories: ['tools'],
    tags: [],
    payload: { id: 'srv-1' },
    ...overrides,
  }
}

function batchItem(raw: RawRegistryItem): {
  raw: RawRegistryItem
  heat: number
  quality: number
  hash: string
} {
  return { raw, heat: 1, quality: 1, hash: `h-${raw.sourceId}` }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockComputePayloadHash.mockResolvedValue('mock-hash')
})

describe('F-643 registry 同步判定必须读主库', () => {
  it('① 单条 upsert 的判定读主库事务,不调用 dbRead', async () => {
    mockTxSelect.mockReturnValueOnce(makeChain([{ id: 'item-1', version: '0.9.0' }]))
    const insertChain = makeChain([{ inserted: false }])
    mockTxInsert.mockReturnValueOnce(insertChain)

    const res = await upsertRegistryItem(rawItem(), 1, 1)

    expect(res.inserted).toBe(false)
    expect(mockDbTransaction).toHaveBeenCalledTimes(1)
    expect(mockTxSelect).toHaveBeenCalledTimes(1)
    expect(mockTxInsert).toHaveBeenCalledTimes(1)
    expect(mockDbReadSelect).not.toHaveBeenCalled()
    expect(mockDbSelect).not.toHaveBeenCalled()
    expect(mockDbInsert).not.toHaveBeenCalled()
    expect(insertChain.returning).toHaveBeenCalledWith({
      inserted: expect.anything(),
    })
  })

  it('② inserted/oldVersion 与主库判定一致:已存在取主库版本,新条目为 null', async () => {
    mockTxSelect.mockReturnValueOnce(makeChain([{ id: 'item-1', version: '0.9.0' }]))
    mockTxInsert.mockReturnValueOnce(makeChain([{ inserted: false }]))
    const updated = await upsertRegistryItem(rawItem({ version: '1.0.0' }), 1, 1)
    expect(updated.inserted).toBe(false)
    expect(updated.oldVersion).toBe('0.9.0')

    mockTxSelect.mockReturnValueOnce(makeChain([]))
    mockTxInsert.mockReturnValueOnce(makeChain([{ inserted: true }]))
    const created = await upsertRegistryItem(rawItem({ sourceId: 'srv-new' }), 1, 1)
    expect(created.inserted).toBe(true)
    expect(created.oldVersion).toBeNull()

    expect(mockDbReadSelect).not.toHaveBeenCalled()
  })

  it('③ 批量路径的判定与写入在同一事务内完成', async () => {
    mockTxSelect.mockReturnValueOnce(
      makeChain([
        { id: 'x1', sourceType: 'mcp', source: 'mcp_marketplace', sourceId: 'a', version: 'v1' },
      ]),
    )
    const insertChain = makeChain([])
    mockTxInsert.mockReturnValueOnce(insertChain)

    const res = await batchUpsertRegistryItems([
      batchItem(rawItem({ sourceId: 'a', version: 'v1' })),
      batchItem(rawItem({ sourceId: 'b', version: 'v1' })),
    ])

    expect(mockDbTransaction).toHaveBeenCalledTimes(1)
    expect(mockTxSelect).toHaveBeenCalledTimes(1)
    expect(mockTxInsert).toHaveBeenCalledTimes(1)
    expect(mockDbReadSelect).not.toHaveBeenCalled()
    expect(mockDbSelect).not.toHaveBeenCalled()
    expect(mockDbInsert).not.toHaveBeenCalled()

    // 判定(跳过 a)与写入(只写 b)来自同一次主库事务,计数与 oldVersion 一致
    expect(res.skipped).toBe(1)
    expect(res.inserted).toBe(1)
    expect(res.updated).toBe(0)
    expect(res.oldVersions).toEqual([
      {
        sourceType: 'mcp',
        source: 'mcp_marketplace',
        sourceId: 'a',
        oldVersion: 'v1',
        newVersion: 'v1',
      },
      {
        sourceType: 'mcp',
        source: 'mcp_marketplace',
        sourceId: 'b',
        oldVersion: null,
        newVersion: 'v1',
      },
    ])
    const written = insertChain.values.mock.calls[0]![0] as Array<{ sourceId: string }>
    expect(written.map((v) => v.sourceId)).toEqual(['b'])
  })

  it('④ 版本判定查询读主库,不读只读副本', async () => {
    mockDbSelect.mockReturnValueOnce(makeChain([{ version: '2.0.0' }]))

    expect(await getRegistryItemVersion('mcp', 'mcp_marketplace', 'srv-1')).toBe('2.0.0')
    expect(mockDbSelect).toHaveBeenCalledTimes(1)
    expect(mockDbReadSelect).not.toHaveBeenCalled()
  })
})
