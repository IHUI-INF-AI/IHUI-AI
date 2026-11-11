// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// SDB-09 回归:外部 MCP 市场字段落库前必须在 DB 层(registry-queries)统一净化。
//
// 覆盖:① 超长 varchar 按 schema 列宽截断;② 非 http(s) 链接置空但记录仍入库;
// ③ http/https 原样保留;④ 必填字段非法仍被拒绝;⑤ 截断/丢弃/拒绝计数可观测。

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { RawRegistryItem } from '../src/services/registry-sync/types.js'

const { mockDbInsert, mockDbReadSelect, mockComputePayloadHash } = vi.hoisted(() => ({
  mockDbInsert: vi.fn(),
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

vi.mock('../src/db/index.js', () => ({
  db: { insert: mockDbInsert, delete: vi.fn(), update: vi.fn() },
  dbRead: { select: mockDbReadSelect, execute: vi.fn() },
}))

vi.mock('../src/services/registry-sync/index.js', () => ({
  computePayloadHash: mockComputePayloadHash,
}))

import {
  batchUpsertRegistryItems,
  upsertRegistryItem,
} from '../src/db/registry-queries.js'

/** drizzle 查询构建器是链式 + thenable;所有链方法返回自身,await 时取最终值。 */
function makeChain(finalValue: unknown) {
  const chain: Record<string, unknown> & { then?: unknown } = {
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(finalValue).then(resolve, reject),
  }
  for (const method of ['from', 'where', 'orderBy', 'limit', 'offset', 'values', 'onConflictDoUpdate', 'returning', 'set']) {
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

/** 为一次批量 upsert 备好 existing 查询与 insert 链,返回 insert 链供断言落库值。 */
function mockBatchDb(existing: unknown[] = []) {
  mockDbReadSelect.mockReturnValueOnce(makeChain(existing))
  const insertChain = makeChain([])
  mockDbInsert.mockReturnValueOnce(insertChain)
  return insertChain
}

beforeEach(() => {
  vi.clearAllMocks()
  mockComputePayloadHash.mockResolvedValue('mock-hash')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('SDB-09 registry 外部字段落库净化', () => {
  it('① 超长 varchar 按 schema 列宽截断,text 的 description 不截断', async () => {
    const insertChain = mockBatchDb()
    const description = '描'.repeat(3000)
    const res = await batchUpsertRegistryItems([
      batchItem(
        rawItem({
          name: 'n'.repeat(260),
          sourceId: 's'.repeat(300),
          version: 'v'.repeat(150),
          author: 'a'.repeat(260),
          description,
        }),
      ),
    ])

    const values = insertChain.values.mock.calls[0]![0] as Array<Record<string, unknown>>
    expect(values).toHaveLength(1)
    expect(values[0]!.name).toHaveLength(200)
    expect(values[0]!.sourceId).toHaveLength(255)
    expect(values[0]!.version).toHaveLength(100)
    expect(values[0]!.author).toHaveLength(200)
    // schema 中 description 是 text(无列宽),不截断也不会触发 DB 长度错误
    expect(values[0]!.description).toBe(description)
    expect(res.inserted).toBe(1)
    expect(res.sanitized.truncated).toBe(4)
  })

  it('② javascript:/file:/data: 链接被丢弃为 null,记录仍入库', async () => {
    const insertChain = mockBatchDb()
    const res = await batchUpsertRegistryItems([
      batchItem(
        rawItem({
          homepage: 'javascript:alert(1)',
          repoUrl: 'file:///etc/passwd',
          downloadUrl: 'data:text/html,<script>alert(1)</script>',
        }),
      ),
    ])

    const values = insertChain.values.mock.calls[0]![0] as Array<Record<string, unknown>>
    expect(values[0]!.homepage).toBeNull()
    expect(values[0]!.repoUrl).toBeNull()
    expect(values[0]!.downloadUrl).toBeNull()
    expect(res.inserted).toBe(1)
    expect(res.sanitized.droppedUrls).toBe(3)
    expect(res.sanitized.rejected).toBe(0)
  })

  it('③ http/https 链接正常保留', async () => {
    const insertChain = mockBatchDb()
    const homepage = 'https://example.com/home?a=1'
    const repoUrl = 'http://example.org/repo'
    const downloadUrl = 'HTTPS://cdn.example.com/pkg.zip'
    const res = await batchUpsertRegistryItems([
      batchItem(rawItem({ homepage, repoUrl, downloadUrl })),
    ])

    const values = insertChain.values.mock.calls[0]![0] as Array<Record<string, unknown>>
    expect(values[0]!.homepage).toBe(homepage)
    expect(values[0]!.repoUrl).toBe(repoUrl)
    expect(values[0]!.downloadUrl).toBe(downloadUrl)
    expect(res.sanitized.droppedUrls).toBe(0)
  })

  it('④ 单条缺必填 name 时拒绝且不写库', async () => {
    await expect(upsertRegistryItem(rawItem({ name: '   ' }), 1, 1)).rejects.toThrow(
      /必填字段非法\(name\)/,
    )
    expect(mockDbInsert).not.toHaveBeenCalled()
    expect(mockDbReadSelect).not.toHaveBeenCalled()
  })

  it('④ 批量中一条缺必填 sourceId:仅该条计 failed,其余照常入库', async () => {
    const insertChain = mockBatchDb()
    const res = await batchUpsertRegistryItems([
      batchItem(rawItem({ sourceId: '' })),
      batchItem(rawItem({ sourceId: 'ok-1', name: 'Good MCP' })),
    ])

    const values = insertChain.values.mock.calls[0]![0] as Array<Record<string, unknown>>
    expect(values.map((v) => v.sourceId)).toEqual(['ok-1'])
    expect(res.inserted).toBe(1)
    expect(res.failed).toBe(1)
    expect(res.sanitized.rejected).toBe(1)
  })

  it('⑤ 截断/丢弃/拒绝计数可观测,并有一次聚合 warn 日志', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockBatchDb()
    const res = await batchUpsertRegistryItems([
      batchItem(rawItem({ name: 'n'.repeat(260), homepage: 'javascript:alert(1)' })),
      batchItem(rawItem({ sourceId: '', name: 'Bad MCP' })),
    ])

    expect(res.sanitized).toEqual({ truncated: 1, droppedUrls: 1, rejected: 1 })
    expect(res.inserted).toBe(1)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]![0])).toContain(
      'truncated=1 droppedUrls=1 rejected=1',
    )
  })

  it('全字段合规时不产生净化日志', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockBatchDb()
    const res = await batchUpsertRegistryItems([batchItem(rawItem())])

    expect(res.sanitized).toEqual({ truncated: 0, droppedUrls: 0, rejected: 0 })
    expect(warn).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
