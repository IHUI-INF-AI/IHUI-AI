// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * F-285 回归(2026-11-08):WS/SSE Redis 工具在 Redis 不可达时必须快速降级,
 * 不得因 maxRetriesPerRequest:null + 离线队列把 Promise 永久挂起(调用方 catch 永不执行)。
 *
 * 改前必红口径:用永不 settle 的 fake Redis(旧构造选项 enableOfflineQueue 未关),
 * 断言 isDuplicate/checkWsRateLimit/bufferMessage/replayMessages/fetchSessionMeta
 * 都能在 200ms 内返回降级值;旧实现会全部超时。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fake = vi.hoisted(() => {
  const capturedOptions: Array<Record<string, unknown>> = []
  class FakePipeline {
    constructor(private readonly client: FakeRedis) {}
    zremrangebyscore(): this { return this }
    zadd(): this { return this }
    zcard(): this { return this }
    pexpire(): this { return this }
    rpush(): this { return this }
    ltrim(): this { return this }
    expire(): this { return this }
    exec(): Promise<unknown> { return this.client.command() }
  }
  class FakeRedis {
    private readonly options: Record<string, unknown>
    constructor(_url: string, options: Record<string, unknown> = {}) {
      this.options = options
      capturedOptions.push(options)
    }
    on(): this { return this }
    once(): this { return this }
    quit(): Promise<'OK'> { return Promise.resolve('OK') }
    duplicate(): FakeRedis { return new FakeRedis('dup', this.options) }
    subscribe(): Promise<number> { return Promise.resolve(1) }
    command<T>(): Promise<T> {
      // 新实现必须关离线队列:未连接时立即 reject,走各工具的 catch 降级分支。
      if ((this.options as { enableOfflineQueue?: boolean }).enableOfflineQueue === false) {
        return Promise.reject(new Error('redis offline (FakeRedis)'))
      }
      // 旧实现:命令进离线队列后永不 settle。
      return new Promise<T>(() => {})
    }
    set(): Promise<'OK'> { return this.command() }
    get(): Promise<string | null> { return this.command() }
    lrange(): Promise<string[]> { return this.command() }
    del(): Promise<number> { return this.command() }
    expire(): Promise<number> { return this.command() }
    publish(): Promise<number> { return this.command() }
    pipeline(): FakePipeline { return new FakePipeline(this) }
  }
  return { FakeRedis, capturedOptions }
})

vi.mock('ioredis', () => ({ default: fake.FakeRedis }))

vi.mock('../../config/index.js', () => ({
  config: {
    REDIS_URL: 'redis://127.0.0.1:6399',
    SSE_REGISTRY_BACKEND: 'redis',
  },
}))

vi.mock('../logger.js', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

import { _resetDedupClient, isDuplicate } from '../ws-dedup.js'
import { _resetRateLimitClient, checkWsRateLimit } from '../ws-rate-limit.js'
import { _resetReplayClient, bufferMessage, replayMessages } from '../ws-replay-buffer.js'
import { _resetSseStateStore, getSseStateStore } from '../sse-state-store.js'

const TIMEOUT_MS = 200

async function settlesWithin<T>(p: Promise<T>): Promise<T | 'timeout'> {
  return Promise.race([
    p,
    new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), TIMEOUT_MS)),
  ])
}

beforeEach(() => {
  fake.capturedOptions.length = 0
  _resetDedupClient()
  _resetRateLimitClient()
  _resetReplayClient()
  _resetSseStateStore()
})

afterEach(() => {
  _resetSseStateStore()
})

describe('F-285 Redis 不可达快速降级', () => {
  it('Redis 客户端必须关离线队列且设有限重试/命令超时', () => {
    void isDuplicate('msg-1')
    const opts = fake.capturedOptions.at(-1) ?? {}
    expect(opts.enableOfflineQueue).toBe(false)
    expect(Number(opts.commandTimeout)).toBeGreaterThan(0)
    expect(Number(opts.maxRetriesPerRequest)).toBeLessThanOrEqual(2)
  })

  it('isDuplicate 降级为放行而非挂起', async () => {
    const r = await settlesWithin(isDuplicate('msg-1'))
    expect(r).not.toBe('timeout')
    expect(r).toBe(false)
  })

  it('checkWsRateLimit 降级为放行而非挂起', async () => {
    const r = await settlesWithin(checkWsRateLimit('u-1', 'room-1'))
    expect(r).not.toBe('timeout')
    expect(r).toBe(true)
  })

  it('bufferMessage 降级为静默丢弃而非挂起', async () => {
    const r = await settlesWithin(bufferMessage('room-1', { text: 'hi' }))
    expect(r).not.toBe('timeout')
  })

  it('replayMessages 降级为空数组而非挂起', async () => {
    const r = await settlesWithin(replayMessages('room-1', 0))
    expect(r).not.toBe('timeout')
    expect(r).toEqual([])
  })

  it('SSE 状态层跨副本读取降级为 null 而非挂起', async () => {
    const r = await settlesWithin(getSseStateStore().fetchSessionMeta('conv:msg'))
    expect(r).not.toBe('timeout')
    expect(r).toBeNull()
  })
})
