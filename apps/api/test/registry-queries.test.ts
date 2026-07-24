/**
 * 资源上游同步中心 DB 查询层单元测试(2026-07-24 立)。
 *
 * 覆盖范围:
 *   - listRegistryItems 三种排序(latest / hot / best)+ installedIds 逻辑
 *   - upsertRegistryItem 新增 vs 更新(inserted / oldVersion)
 *   - cleanupOldWebhookTriggers TTL 清理(daysToKeep → DELETE WHERE cutoff)
 *
 * mock 策略:mock drizzle-orm 操作符 + mock @ihui/database 表 schema + mock db/dbRead,
 * 被测查询逻辑(排序条件 / where 组装 / installedIds 匹配 / upsert 分支)保持真实。
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'

// =============================================================================
// Mock 函数(vi.hoisted 确保在 vi.mock 之前可用)
// =============================================================================
const {
  mockDbInsert,
  mockDbDelete,
  mockDbUpdate,
  mockDbReadSelect,
  mockDbReadExecute,
  mockComputePayloadHash,
} = vi.hoisted(() => ({
  mockDbInsert: vi.fn(),
  mockDbDelete: vi.fn(),
  mockDbUpdate: vi.fn(),
  mockDbReadSelect: vi.fn(),
  mockDbReadExecute: vi.fn(),
  mockComputePayloadHash: vi.fn().mockResolvedValue('mock-hash'),
}))

// =============================================================================
// Mock 模块
// =============================================================================

// mock drizzle-orm 操作符 — 返回可辨识对象,供测试验证 orderBy/where 参数
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col: any, val: any) => ({ op: 'eq', col, val })),
  and: vi.fn((...conds: any[]) => ({ op: 'and', conds })),
  or: vi.fn((...conds: any[]) => ({ op: 'or', conds })),
  desc: vi.fn((col: any) => ({ op: 'desc', col })),
  ilike: vi.fn((col: any, pattern: any) => ({ op: 'ilike', col, pattern })),
  sql: Object.assign(
    (strings: TemplateStringsArray, ...values: any[]) => ({ op: 'sql', strings: [...strings], values }),
    {
      raw: vi.fn((s: string) => ({ op: 'sql-raw', raw: s })),
      join: vi.fn((values: any[], sep: any) => ({ op: 'sql-join', values, sep })),
    },
  ),
}))

vi.mock('@ihui/database', () => ({
  registryItems: {
    id: 'id', sourceType: 'source_type', source: 'source', sourceId: 'source_id',
    name: 'name', description: 'description', version: 'version', author: 'author',
    homepage: 'homepage', repoUrl: 'repo_url', downloadUrl: 'download_url',
    categories: 'categories', tags: 'tags', installCount: 'install_count',
    heatScore: 'heat_score', qualityScore: 'quality_score', latestSyncedAt: 'latest_synced_at',
    payload: 'payload', payloadHash: 'payload_hash', createdAt: 'created_at', updatedAt: 'updated_at',
  },
  registrySyncLogs: {
    id: 'id', sourceType: 'source_type', sourceName: 'source_name', status: 'status',
    errorMessage: 'error_message', payloadHash: 'payload_hash', oldVersion: 'old_version',
    newVersion: 'new_version', durationMs: 'duration_ms', startedAt: 'started_at', finishedAt: 'finished_at',
  },
  registryWebhookTriggers: {
    id: 'id', name: 'name', eventType: 'event_type', source: 'source', signature: 'signature',
    payload: 'payload', receivedAt: 'received_at', processedAt: 'processed_at', status: 'status',
    resultMessage: 'result_message',
  },
}))

vi.mock('../src/db/index.js', () => ({
  db: { insert: mockDbInsert, delete: mockDbDelete, update: mockDbUpdate },
  dbRead: { select: mockDbReadSelect, execute: mockDbReadExecute },
}))

vi.mock('../src/services/registry-sync/index.js', () => ({
  computePayloadHash: mockComputePayloadHash,
}))

// =============================================================================
// 导入被测模块(必须在 mock 之后)
// =============================================================================
import {
  listRegistryItems,
  upsertRegistryItem,
  cleanupOldWebhookTriggers,
} from '../src/db/registry-queries.js'
import { eq, desc, sql as sqlOp } from 'drizzle-orm'

// =============================================================================
// 辅助:构建 thenable 查询链(drizzle 查询构建器是链式 + thenable)
// =============================================================================

/**
 * 创建 thenable 链式 mock。所有链方法返回 this,await 时 resolve finalValue。
 * 暴露所有链方法为 vi.fn() 供测试验证参数。
 */
function makeChain(finalValue: any) {
  const chain: any = {
    then: (resolve: any, reject?: any) => Promise.resolve(finalValue).then(resolve, reject),
  }
  for (const m of ['from', 'where', 'orderBy', 'limit', 'offset', 'values', 'onConflictDoUpdate', 'returning', 'set']) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  return chain
}

/** 构建 mock DB row(registry_items 表) */
function makeItemRow(overrides: Record<string, any> = {}) {
  return {
    id: 'item-001',
    sourceType: 'mcp',
    source: 'github',
    sourceId: 'test-repo',
    name: 'Test MCP',
    description: 'A test item',
    version: '1.0.0',
    author: 'test',
    homepage: 'https://example.com',
    repoUrl: 'https://github.com/test/repo',
    downloadUrl: null,
    categories: ['tools'],
    tags: ['stable'],
    installCount: 100,
    heatScore: 50,
    qualityScore: 80,
    latestSyncedAt: new Date('2026-07-24T00:00:00Z'),
    payload: { foo: 'bar' },
    createdAt: new Date('2026-07-01T00:00:00Z'),
    updatedAt: new Date('2026-07-24T00:00:00Z'),
    ...overrides,
  }
}

// =============================================================================
// 测试套件
// =============================================================================
describe('Registry DB Queries', () => {

  beforeEach(() => {
    vi.clearAllMocks()
    mockComputePayloadHash.mockResolvedValue('mock-hash')
  })

  // ===========================================================================
  // listRegistryItems — 排序
  // ===========================================================================
  describe('listRegistryItems 排序', () => {
    it('传 sort=latest 时,按 latestSyncedAt 降序查询', async () => {
    const rowsChain = makeChain([makeItemRow({ id: 'item-1' })])
    const countChain = makeChain([{ c: 1 }])
    mockDbReadSelect
      .mockReturnValueOnce(rowsChain)
      .mockReturnValueOnce(countChain)

    const result = await listRegistryItems({ sort: 'latest', page: 1, pageSize: 20 })

    // orderBy 被调用,且参数是 sql 模板(latestSyncedAt desc nulls last)
    expect(rowsChain.orderBy).toHaveBeenCalledTimes(1)
    const orderArg = rowsChain.orderBy.mock.calls[0][0]
    expect(orderArg.op).toBe('sql')
    // sql 模板的 strings 数组应包含 'desc nulls last'
    const joinedStrings = orderArg.strings.join('')
    expect(joinedStrings).toContain('desc nulls last')
    expect(result.total).toBe(1)
    expect(result.items).toHaveLength(1)
    })

    it('传 sort=hot 时,按 heatScore 降序查询', async () => {
    const rowsChain = makeChain([makeItemRow({ id: 'item-hot' })])
    const countChain = makeChain([{ c: 1 }])
    mockDbReadSelect
      .mockReturnValueOnce(rowsChain)
      .mockReturnValueOnce(countChain)

    await listRegistryItems({ sort: 'hot', page: 1, pageSize: 20 })

    const orderArg = rowsChain.orderBy.mock.calls[0][0]
    expect(orderArg.op).toBe('desc')
    expect(orderArg.col).toBe('heat_score')
    })

    it('传 sort=best 时,按 qualityScore 降序查询', async () => {
    const rowsChain = makeChain([makeItemRow({ id: 'item-best' })])
    const countChain = makeChain([{ c: 1 }])
    mockDbReadSelect
      .mockReturnValueOnce(rowsChain)
      .mockReturnValueOnce(countChain)

    await listRegistryItems({ sort: 'best', page: 1, pageSize: 20 })

    const orderArg = rowsChain.orderBy.mock.calls[0][0]
    expect(orderArg.op).toBe('desc')
    expect(orderArg.col).toBe('quality_score')
    })
  })

  // ===========================================================================
  // listRegistryItems — installedIds
  // ===========================================================================
  describe('listRegistryItems installedIds', () => {
    it('传 userId 时,查询 user_preferences 并返回 installedIds', async () => {
    const row = makeItemRow({ id: 'item-installed', sourceType: 'mcp', sourceId: 'repo-x' })
    const rowsChain = makeChain([row])
    const countChain = makeChain([{ c: 1 }])
    mockDbReadSelect
      .mockReturnValueOnce(rowsChain)
      .mockReturnValueOnce(countChain)
    // user_preferences 查询返回匹配的 key
    mockDbReadExecute.mockResolvedValue([{ key: 'mcp:repo-x' }])

    const result = await listRegistryItems({ sort: 'latest', page: 1, pageSize: 20 }, 'user-001')

    expect(mockDbReadExecute).toHaveBeenCalledTimes(1)
    // installedIds 应包含匹配的 item id
    expect(result.installedIds).toContain('item-installed')
    })

    it('不传 userId 时,installedIds 返回空数组', async () => {
    const rowsChain = makeChain([makeItemRow({ id: 'item-1' })])
    const countChain = makeChain([{ c: 1 }])
    mockDbReadSelect
      .mockReturnValueOnce(rowsChain)
      .mockReturnValueOnce(countChain)

    const result = await listRegistryItems({ sort: 'latest', page: 1, pageSize: 20 })

    // 不传 userId 时不应查 user_preferences
    expect(mockDbReadExecute).not.toHaveBeenCalled()
    expect(result.installedIds).toEqual([])
    })
  })

  // ===========================================================================
  // upsertRegistryItem
  // ===========================================================================
  describe('upsertRegistryItem', () => {
    it('新条目时(existing 为空),执行 INSERT,返回 inserted=true', async () => {
    // existing 查询返回空数组 → 新插入
    const existingChain = makeChain([])
    mockDbReadSelect.mockReturnValueOnce(existingChain)
    const insertChain = makeChain(undefined)
    mockDbInsert.mockReturnValueOnce(insertChain)

    const raw = {
      sourceType: 'mcp' as const,
      source: 'github' as const,
      sourceId: 'new-repo',
      name: 'New MCP',
      description: 'desc',
      version: '1.0.0',
      author: 'author',
      homepage: 'https://example.com',
      repoUrl: 'https://github.com/test/new-repo',
      downloadUrl: null,
      categories: ['tools'],
      tags: ['stable'],
      payload: { foo: 'bar' },
    }

    const result = await upsertRegistryItem(raw, 50, 80)

    expect(result.inserted).toBe(true)
    expect(result.oldVersion).toBe(null)
    expect(result.hash).toBe('mock-hash')
    // db.insert 被调用
    expect(mockDbInsert).toHaveBeenCalledTimes(1)
    })

    it('已有条目时,执行 UPDATE(onConflictDoUpdate),返回 inserted=false + oldVersion', async () => {
    // existing 查询返回已有记录(version='0.9.0')
    const existingChain = makeChain([{ id: 'item-existing', version: '0.9.0' }])
    mockDbReadSelect.mockReturnValueOnce(existingChain)
    const insertChain = makeChain(undefined)
    mockDbInsert.mockReturnValueOnce(insertChain)

    const raw = {
      sourceType: 'mcp' as const,
      source: 'github' as const,
      sourceId: 'existing-repo',
      name: 'Existing MCP',
      description: 'updated desc',
      version: '1.0.0',
      author: 'author',
      homepage: 'https://example.com',
      repoUrl: 'https://github.com/test/existing-repo',
      downloadUrl: null,
      categories: ['tools'],
      tags: ['stable'],
      payload: { foo: 'baz' },
    }

    const result = await upsertRegistryItem(raw, 60, 90)

    expect(result.inserted).toBe(false)
    expect(result.oldVersion).toBe('0.9.0')
    // db.insert 被调用(走 onConflictDoUpdate 分支,实际是 INSERT ... ON CONFLICT UPDATE)
    expect(mockDbInsert).toHaveBeenCalledTimes(1)
    const insertChain2 = mockDbInsert.mock.results[0].value
    expect(insertChain2.onConflictDoUpdate).toHaveBeenCalledTimes(1)
    })
  })

  // ===========================================================================
  // cleanupOldWebhookTriggers
  // ===========================================================================
  describe('cleanupOldWebhookTriggers', () => {
    it('传 daysToKeep=30 时,DELETE WHERE receivedAt < cutoff', async () => {
    const deletedRows = [{ id: 'del-1' }, { id: 'del-2' }, { id: 'del-3' }]
    const deleteChain = makeChain(deletedRows)
    mockDbDelete.mockReturnValueOnce(deleteChain)

    const beforeTime = Date.now()
    const result = await cleanupOldWebhookTriggers(30)
    const afterTime = Date.now()

    // db.delete 被调用
    expect(mockDbDelete).toHaveBeenCalledTimes(1)
    // where 被调用(参数是 sql 模板,包含 cutoff 日期)
    expect(deleteChain.where).toHaveBeenCalledTimes(1)
    const whereArg = deleteChain.where.mock.calls[0][0]
    expect(whereArg.op).toBe('sql')
    // returning 被调用
    expect(deleteChain.returning).toHaveBeenCalledTimes(1)
    // 返回删除行数
    expect(result).toBe(3)
    // cutoff 应在合理范围内(30 天前)
    // sql 模板 `${col} < ${cutoff}` 的 values = [colName, cutoff],cutoff 在索引 1
    const cutoff = whereArg.values[1]
    expect(cutoff).toBeInstanceOf(Date)
    const expectedCutoffMin = new Date(beforeTime - 30 * 86400_000 - 1000)
    const expectedCutoffMax = new Date(afterTime - 30 * 86400_000 + 1000)
    expect(cutoff.getTime()).toBeGreaterThanOrEqual(expectedCutoffMin.getTime())
    expect(cutoff.getTime()).toBeLessThanOrEqual(expectedCutoffMax.getTime())
    })
  })
})
