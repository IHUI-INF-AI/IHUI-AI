// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-349:registry 同步适配器失败不得被吞成空数组。
 *
 * 三种场景都要与"上游确实没有数据"区分开:
 * - 全部来源失败 → sync_log 记 fail 且抛错(trigger 由 failed 事件回写 failed);
 * - 部分来源失败 → sync_log 记 fail + 失败明细,trigger 记 failed(不能标 processed);
 * - 确实为空 → 仍是 skipped,trigger 照常 processed。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const m = vi.hoisted(() => ({
  githubFetch: vi.fn(),
  npmFetch: vi.fn(),
  mcpFetch: vi.fn(),
  customFetch: vi.fn(),
  insertSyncLog: vi.fn(),
  batchUpsert: vi.fn(),
  markTrigger: vi.fn(),
  processor: { current: null as ((job: unknown) => Promise<unknown>) | null },
}))

vi.mock('../src/services/registry-sync/github-adapter.js', () => ({
  githubAdapter: { fetch: m.githubFetch },
}))
vi.mock('../src/services/registry-sync/npm-adapter.js', () => ({
  npmAdapter: { fetch: m.npmFetch },
}))
vi.mock('../src/services/registry-sync/mcp-marketplace-adapter.js', () => ({
  mcpMarketplaceAdapter: { fetch: m.mcpFetch },
}))
vi.mock('../src/services/registry-sync/custom-registry-adapter.js', () => ({
  customRegistryAdapter: { fetch: m.customFetch },
}))
vi.mock('../src/db/registry-queries.js', () => ({
  insertSyncLog: m.insertSyncLog,
  batchUpsertRegistryItems: m.batchUpsert,
  markWebhookTriggerProcessed: m.markTrigger,
}))
vi.mock('bullmq', () => {
  class Worker {
    constructor(_name: string, processor: (job: unknown) => Promise<unknown>) {
      m.processor.current = processor
    }
    on(): this {
      return this
    }
  }
  class Queue {
    constructor() {}
  }
  return { Worker, Queue }
})

import { fetchAllRawItems } from '../src/services/registry-sync/index.js'
import { startRegistrySyncWorker } from '../src/workers/registry-sync-worker.js'

function rawItem(): {
  payload: Record<string, unknown>
  tags: string[]
  meta: Record<string, unknown>
} {
  return { payload: { name: 'demo' }, tags: [], meta: {} }
}

function makeServer(): FastifyInstance {
  return {
    redisForQueue: {},
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  } as unknown as FastifyInstance
}

function startAndGetProcessor(): (job: unknown) => Promise<unknown> {
  m.processor.current = null
  startRegistrySyncWorker(makeServer())
  expect(m.processor.current).not.toBeNull()
  return m.processor.current!
}

function makeJob(triggerId?: string): {
  id: string
  // sourceType=null ⇒ 每个源都跑 mcp/skill/plugin 三种类型(部分失败用例需要多个组合)
  data: { sourceType: null; source: 'github' | 'npm'; force: false; triggerId?: string }
  attemptsMade: number
} {
  return {
    id: 'job-1',
    data: { sourceType: null, source: 'npm', force: false, triggerId },
    attemptsMade: 0,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  m.batchUpsert.mockResolvedValue({
    inserted: 1,
    updated: 0,
    skipped: 0,
    failed: 0,
    oldVersions: [],
    hashList: ['h1'],
    deduped: 0,
  })
})

describe('fetchAllRawItems 失败明细', () => {
  it('适配器抛错时返回 failures,而不是空数组当"没数据"', async () => {
    m.githubFetch.mockRejectedValue(new Error('403 rate limited'))
    const result = await fetchAllRawItems('mcp', 'github')
    expect(result.items).toEqual([])
    expect(result.attempted).toBe(1)
    expect(result.failures).toEqual([
      { source: 'github', type: 'mcp', error: '403 rate limited' },
    ])
  })

  it('全部成功时 failures 为空', async () => {
    m.npmFetch.mockResolvedValue([rawItem()])
    const result = await fetchAllRawItems('mcp', 'npm')
    expect(result.items).toHaveLength(1)
    expect(result.failures).toEqual([])
    expect(result.attempted).toBe(1)
  })
})

describe('worker 不再把全失败读成 skipped', () => {
  it('全部来源失败:sync_log 记 fail 并抛出', async () => {
    m.npmFetch.mockRejectedValue(new Error('ECONNRESET'))
    const processor = startAndGetProcessor()
    await expect(processor(makeJob('trig-1'))).rejects.toThrow(/所有来源拉取失败/)
    expect(m.insertSyncLog).toHaveBeenCalledTimes(1)
    const log = m.insertSyncLog.mock.calls[0]![0] as { status: string; errorMessage: string }
    expect(log.status).toBe('fail')
    expect(log.errorMessage).toContain('npm/mcp: ECONNRESET')
    // 抛出后由 BullMQ failed 事件回写 trigger,此处不应提前标 processed
    expect(m.markTrigger).not.toHaveBeenCalled()
  })

  it('部分来源失败:sync_log 记 fail,trigger 回写 failed', async () => {
    m.npmFetch
      .mockResolvedValueOnce([rawItem()])
      .mockRejectedValueOnce(new Error('timeout mcp'))
      .mockRejectedValueOnce(new Error('timeout plugin'))
    const processor = startAndGetProcessor()
    await processor(makeJob('trig-2'))
    const log = m.insertSyncLog.mock.calls[0]![0] as { status: string; errorMessage: string }
    expect(log.status).toBe('fail')
    expect(log.errorMessage).toContain('来源拉取失败 2 项')
    expect(m.markTrigger).toHaveBeenCalledWith('trig-2', 'failed', expect.stringContaining('fetchFailed=2'))
  })

  it('上游确实没有数据:仍记 skipped 且 trigger processed', async () => {
    m.npmFetch.mockResolvedValue([])
    const processor = startAndGetProcessor()
    await processor(makeJob('trig-3'))
    const log = m.insertSyncLog.mock.calls[0]![0] as { status: string; errorMessage: unknown }
    expect(log.status).toBe('skipped')
    expect(log.errorMessage).toBeNull()
    expect(m.markTrigger).toHaveBeenCalledWith('trig-3', 'processed', expect.any(String))
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
