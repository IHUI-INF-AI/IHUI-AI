/**
 * 资源上游同步中心 Worker 单元测试(2026-07-24 立)。
 *
 * 覆盖范围:
 *   - BullMQ Worker job handler 逻辑(fetchAllRawItems → upsert → sync_log → webhook 回写)
 *   - 三态判定(success / fail / skipped)+ 部分失败聚合
 *   - d1 幂等:force=false + oldVersion===version → skipped
 *   - d2 oldVersion 聚合:取第一个版本有变化的 oldVersion
 *   - d10 worker.on(failed) 事件:webhook trigger 回写 failed
 *
 * mock 策略:mock bullmq(捕获 job handler)+ mock service 层 + mock DB 查询层,
 * 被测 Worker 逻辑(三态判定 / 聚合 / webhook 回写)保持真实。
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'

// =============================================================================
// 环境变量(Worker 读取 GITHUB_TOKEN / IHUI_CUSTOM_REGISTRY_URL)
// =============================================================================
vi.hoisted(() => {
  process.env.GITHUB_TOKEN ??= 'test-github-token'
  process.env.IHUI_CUSTOM_REGISTRY_URL ??= 'https://test-registry.example.com'
})

// =============================================================================
// Mock 函数 + BullMQ Worker harness(vi.hoisted 确保在 vi.mock 之前可用)
// =============================================================================
const {
  mockFetchAllRawItems,
  mockCalculateHeatScore,
  mockCalculateQualityScore,
  mockComputePayloadHash,
  mockBatchUpsertRegistryItems,
  mockInsertSyncLog,
  mockMarkWebhookTriggerProcessed,
  workerHarness,
} = vi.hoisted(() => {
  let jobHandler: ((job: any) => Promise<any>) | null = null
  let failedHandler: ((job: any, err: Error) => void) | null = null
  let completedHandler: (() => void) | null = null

  const Worker = vi.fn().mockImplementation((_queueName: string, handler: any, _opts: any) => {
    jobHandler = handler
    return {
      on: vi.fn((event: string, cb: any) => {
        if (event === 'failed') failedHandler = cb
        if (event === 'completed') completedHandler = cb
      }),
      close: vi.fn().mockResolvedValue(undefined),
    }
  })

  return {
    mockFetchAllRawItems: vi.fn(),
    mockCalculateHeatScore: vi.fn().mockReturnValue(50),
    mockCalculateQualityScore: vi.fn().mockReturnValue(80),
    mockComputePayloadHash: vi.fn().mockResolvedValue('mock-payload-hash'),
    mockBatchUpsertRegistryItems: vi.fn(),
    mockInsertSyncLog: vi.fn().mockResolvedValue(undefined),
    mockMarkWebhookTriggerProcessed: vi.fn().mockResolvedValue(undefined),
    workerHarness: {
      Worker,
      getJobHandler: () => jobHandler,
      getFailedHandler: () => failedHandler,
      getCompletedHandler: () => completedHandler,
    },
  }
})

// =============================================================================
// Mock 模块
// =============================================================================
vi.mock('bullmq', () => ({
  Worker: workerHarness.Worker,
  Queue: vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue({ id: 'job-1' }),
    close: vi.fn().mockResolvedValue(undefined),
  })),
}))

vi.mock('../src/services/registry-sync/index.js', () => ({
  fetchAllRawItems: mockFetchAllRawItems,
  calculateHeatScore: mockCalculateHeatScore,
  calculateQualityScore: mockCalculateQualityScore,
  computePayloadHash: mockComputePayloadHash,
}))

vi.mock('../src/db/registry-queries.js', () => ({
  batchUpsertRegistryItems: mockBatchUpsertRegistryItems,
  insertSyncLog: mockInsertSyncLog,
  markWebhookTriggerProcessed: mockMarkWebhookTriggerProcessed,
}))

// =============================================================================
// 导入被测模块
// =============================================================================
import { startRegistrySyncWorker } from '../src/workers/registry-sync-worker.js'

// =============================================================================
// 辅助函数
// =============================================================================

function createMockServer() {
  return {
    redisForQueue: {} as any,
    log: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  } as any
}

function createMockJob(data: Partial<{
  sourceType: string | null
  source: string | null
  force: boolean
  triggerId: string
}> = {}) {
  return {
    id: 'job-test-001',
    data: {
      sourceType: null,
      source: null,
      force: false,
      ...data,
    },
    attemptsMade: 0,
  } as any
}

function createRawItem(overrides: Record<string, any> = {}) {
  return {
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
    payload: { foo: 'bar' },
    ...overrides,
  }
}

// =============================================================================
// 测试套件
// =============================================================================
describe('Registry Sync Worker', () => {
  let server: any

  beforeAll(() => {
    server = createMockServer()
    startRegistrySyncWorker(server)
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchAllRawItems.mockResolvedValue([])
    mockCalculateHeatScore.mockReturnValue(50)
    mockCalculateQualityScore.mockReturnValue(80)
    mockComputePayloadHash.mockResolvedValue('mock-payload-hash')
    mockBatchUpsertRegistryItems.mockResolvedValue({
      inserted: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      oldVersions: [],
      hashList: [],
    })
    mockInsertSyncLog.mockResolvedValue(undefined)
    mockMarkWebhookTriggerProcessed.mockResolvedValue(undefined)
  })

  it('fetchAllRawItems 失败时,插入 fail 状态的 sync_log 并抛错', async () => {
    mockFetchAllRawItems.mockRejectedValue(new Error('network timeout'))

    const job = createMockJob({ sourceType: 'mcp', source: 'github' })
    const handler = workerHarness.getJobHandler()!

    await expect(handler(job)).rejects.toThrow('network timeout')

    expect(mockInsertSyncLog).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: 'mcp',
        sourceName: 'github',
        status: 'fail',
        errorMessage: expect.stringContaining('fetchAllRawItems 失败'),
      }),
    )
    expect(mockMarkWebhookTriggerProcessed).not.toHaveBeenCalled()
  })

  it('fetchAllRawItems 返回空数组时,插入 skipped 状态的 sync_log', async () => {
    mockFetchAllRawItems.mockResolvedValue([])

    const job = createMockJob()
    const handler = workerHarness.getJobHandler()!

    const result = await handler(job)

    expect(mockInsertSyncLog).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'skipped',
        payloadHash: null,
      }),
    )
    expect(result).toEqual({ synced: 0, failed: 0, skipped: 0, total: 0 })
  })

  it('fetchAllRawItems 返回 3 条数据,全部 upsert 成功时,插入 success 状态的 sync_log', async () => {
    mockFetchAllRawItems.mockResolvedValue([
      createRawItem({ sourceId: 'repo-1', version: '1.0.0' }),
      createRawItem({ sourceId: 'repo-2', version: '2.0.0' }),
      createRawItem({ sourceId: 'repo-3', version: '3.0.0' }),
    ])
    mockBatchUpsertRegistryItems.mockResolvedValue({
      inserted: 3,
      updated: 0,
      skipped: 0,
      failed: 0,
      oldVersions: [
        { sourceType: 'mcp', source: 'github', sourceId: 'repo-1', oldVersion: null, newVersion: '1.0.0' },
        { sourceType: 'mcp', source: 'github', sourceId: 'repo-2', oldVersion: null, newVersion: '2.0.0' },
        { sourceType: 'mcp', source: 'github', sourceId: 'repo-3', oldVersion: null, newVersion: '3.0.0' },
      ],
      hashList: ['hash-1', 'hash-2', 'hash-3'],
    })

    const job = createMockJob()
    const handler = workerHarness.getJobHandler()!

    const result = await handler(job)

    expect(mockInsertSyncLog).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'success',
        errorMessage: null,
      }),
    )
    expect(result).toEqual({ synced: 3, failed: 0, skipped: 0, total: 3 })
    expect(mockBatchUpsertRegistryItems).toHaveBeenCalledTimes(1)
  })

  it('upsertRegistryItem 部分失败时(2 成功 1 失败),sync_log 状态为 success,failed=1', async () => {
    mockFetchAllRawItems.mockResolvedValue([
      createRawItem({ sourceId: 'repo-1', version: '1.0.0' }),
      createRawItem({ sourceId: 'repo-2', version: '2.0.0' }),
      createRawItem({ sourceId: 'repo-3', version: '3.0.0' }),
    ])
    mockBatchUpsertRegistryItems.mockResolvedValue({
      inserted: 2,
      updated: 0,
      skipped: 0,
      failed: 1,
      oldVersions: [
        { sourceType: 'mcp', source: 'github', sourceId: 'repo-1', oldVersion: null, newVersion: '1.0.0' },
        { sourceType: 'mcp', source: 'github', sourceId: 'repo-2', oldVersion: null, newVersion: '2.0.0' },
      ],
      hashList: ['h1', 'h2'],
    })

    const job = createMockJob()
    const handler = workerHarness.getJobHandler()!

    const result = await handler(job)

    expect(mockInsertSyncLog).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'success',
        errorMessage: '1 个条目 upsert 失败',
      }),
    )
    expect(result).toEqual({ synced: 2, failed: 1, skipped: 0, total: 3 })
  })

  it('upsertRegistryItem 全部失败时,sync_log 状态为 fail', async () => {
    mockFetchAllRawItems.mockResolvedValue([
      createRawItem({ sourceId: 'repo-1', version: '1.0.0' }),
      createRawItem({ sourceId: 'repo-2', version: '2.0.0' }),
    ])
    mockBatchUpsertRegistryItems.mockRejectedValue(new Error('db down'))

    const job = createMockJob()
    const handler = workerHarness.getJobHandler()!

    const result = await handler(job)

    expect(mockInsertSyncLog).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'fail',
        errorMessage: '2 个条目 upsert 失败',
      }),
    )
    expect(result).toEqual({ synced: 0, failed: 2, skipped: 0, total: 2 })
  })

  it('triggerId 存在时,完成后回写 webhook trigger 状态为 processed', async () => {
    mockFetchAllRawItems.mockResolvedValue([
      createRawItem({ sourceId: 'repo-1', version: '1.0.0' }),
    ])
    mockBatchUpsertRegistryItems.mockResolvedValue({
      inserted: 1,
      updated: 0,
      skipped: 0,
      failed: 0,
      oldVersions: [
        { sourceType: 'mcp', source: 'github', sourceId: 'repo-1', oldVersion: null, newVersion: '1.0.0' },
      ],
      hashList: ['h1'],
    })

    const job = createMockJob({ triggerId: 'trigger-ok-001' })
    const handler = workerHarness.getJobHandler()!

    await handler(job)

    expect(mockMarkWebhookTriggerProcessed).toHaveBeenCalledWith(
      'trigger-ok-001',
      'processed',
      expect.stringContaining('synced=1'),
    )
  })

  it('triggerId 存在且同步失败时,回写 webhook trigger 状态为 failed', async () => {
    const syncError = new Error('upstream 503')
    mockFetchAllRawItems.mockRejectedValue(syncError)

    const job = createMockJob({ triggerId: 'trigger-fail-001' })
    const handler = workerHarness.getJobHandler()!

    await expect(handler(job)).rejects.toThrow('upstream 503')
    expect(mockMarkWebhookTriggerProcessed).not.toHaveBeenCalled()

    const failedHandler = workerHarness.getFailedHandler()!
    failedHandler(job, syncError)

    expect(mockMarkWebhookTriggerProcessed).toHaveBeenCalledWith(
      'trigger-fail-001',
      'failed',
      'upstream 503',
    )
  })

  it('force=false 且 upsert 返回 oldVersion === raw.version(无变更)时,计为 skipped', async () => {
    mockFetchAllRawItems.mockResolvedValue([
      createRawItem({ sourceId: 'repo-1', version: '1.0.0' }),
    ])
    mockBatchUpsertRegistryItems.mockResolvedValue({
      inserted: 0,
      updated: 0,
      skipped: 1,
      failed: 0,
      oldVersions: [
        { sourceType: 'mcp', source: 'github', sourceId: 'repo-1', oldVersion: '1.0.0', newVersion: '1.0.0' },
      ],
      hashList: ['h1'],
    })

    const job = createMockJob({ force: false })
    const handler = workerHarness.getJobHandler()!

    const result = await handler(job)

    expect(result).toEqual({ synced: 0, failed: 0, skipped: 1, total: 1 })
    expect(mockInsertSyncLog).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'success' }),
    )
  })

  it('sync_log 的 oldVersion 聚合:第一个版本变化的 oldVersion 被写入', async () => {
    mockFetchAllRawItems.mockResolvedValue([
      createRawItem({ sourceId: 'repo-1', version: '1.0.0' }),
      createRawItem({ sourceId: 'repo-2', version: '2.0.0' }),
      createRawItem({ sourceId: 'repo-3', version: '3.0.0' }),
    ])
    mockBatchUpsertRegistryItems.mockResolvedValue({
      inserted: 0,
      updated: 2,
      skipped: 0,
      failed: 0,
      oldVersions: [
        { sourceType: 'mcp', source: 'github', sourceId: 'repo-1', oldVersion: '1.0.0', newVersion: '2.0.0' },
      ],
      hashList: ['h1'],
    })

    const job = createMockJob()
    const handler = workerHarness.getJobHandler()!

    await handler(job)

    expect(mockInsertSyncLog).toHaveBeenCalledWith(
      expect.objectContaining({
        oldVersion: '1.0.0',
        newVersion: '2.0.0',
      }),
    )
  })

  it('worker.on(failed) 触发时,回写 webhook trigger 状态为 failed', async () => {
    const mockJob = createMockJob({ triggerId: 'trigger-failed-event' })
    const mockError = new Error('job processing crashed')

    const failedHandler = workerHarness.getFailedHandler()!
    failedHandler(mockJob, mockError)

    expect(mockMarkWebhookTriggerProcessed).toHaveBeenCalledWith(
      'trigger-failed-event',
      'failed',
      'job processing crashed',
    )
  })

  it('force=true 时,oldVersion===version 仍计为 synced(跳过幂等检查)', async () => {
    mockFetchAllRawItems.mockResolvedValue([
      createRawItem({ sourceId: 'repo-1', version: '1.0.0' }),
    ])
    mockBatchUpsertRegistryItems.mockResolvedValue({
      inserted: 0,
      updated: 1,
      skipped: 0,
      failed: 0,
      oldVersions: [
        { sourceType: 'mcp', source: 'github', sourceId: 'repo-1', oldVersion: '1.0.0', newVersion: '1.0.0' },
      ],
      hashList: ['h1'],
    })

    const job = createMockJob({ force: true })
    const handler = workerHarness.getJobHandler()!

    const result = await handler(job)

    expect(result).toEqual({ synced: 1, failed: 0, skipped: 0, total: 1 })
  })

  it('worker.on(completed) 触发时,stats.processed 递增', async () => {
    const completedHandler = workerHarness.getCompletedHandler()!
    const statsBefore = (server as any).registryWorkerStats.processed
    completedHandler()
    expect((server as any).registryWorkerStats.processed).toBe(statsBefore + 1)
    expect((server as any).registryWorkerStats.lastProcessedAt).toBeInstanceOf(Date)
  })
})
