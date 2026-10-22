// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * relay-account-pool-scheduler 巡检分布式锁测试(2026-10-22 多实例改造)。
 * 零真实 Redis/DB:shared-state 走内存兜底档(REDIS_URL 指死端口)+ drizzle 链式 mock。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

let accountRows: unknown[] = []
let selectCalls = 0
const updateCalls: Array<Record<string, unknown>> = []

vi.mock('../src/db/index.js', () => {
  const withSettlers = (step: Record<string, unknown>, resolver: () => unknown[]) => {
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(resolver()).then(resolve, reject)
    step.catch = (reject?: (e: unknown) => void) => Promise.resolve(resolver()).catch(reject)
    step.finally = (fn?: () => void) => Promise.resolve(resolver()).finally(fn)
    return step
  }
  const chainSelect = () => {
    selectCalls++
    const step: Record<string, unknown> = {}
    for (const m of ['from', 'where', 'limit', 'offset', 'orderBy', 'groupBy']) {
      step[m] = vi.fn(() => step)
    }
    return withSettlers(step, () => accountRows)
  }
  const chainWrite = () => {
    const step: Record<string, unknown> = {}
    for (const m of ['from', 'where', 'returning', 'values']) {
      step[m] = vi.fn(() => step)
    }
    step.set = vi.fn((arg?: unknown) => {
      if (arg && typeof arg === 'object') updateCalls.push(arg as Record<string, unknown>)
      return step
    })
    return withSettlers(step, () => [])
  }
  return {
    db: { select: chainSelect, update: chainWrite, insert: chainWrite, delete: chainWrite },
    dbRead: { select: chainSelect },
  }
})

vi.mock('../src/utils/crypto.js', () => ({
  encryptField: (v: string) => `enc:${v}`,
  decryptField: (v: string) => (v.startsWith('enc:') ? v.slice(4) : v),
}))

// shared-state 强制「内存兜底」档:内存锁表即等价多实例互斥语义(单进程视角)
vi.mock('../src/config/index.js', () => ({
  config: { REDIS_URL: 'redis://127.0.0.1:1/0' },
}))

import { SWEEP_LOCK_NAME, sweepAccountPool } from '../src/services/relay-account-pool-scheduler.js'
import {
  __test__ as sharedState,
  tryAcquireSharedLock,
} from '../src/services/relay-account-shared-state.js'
import { registerRelayAdapter } from '../src/services/relay-upstream-adapters.js'

function sweepRow(overrides: Record<string, unknown> = {}): unknown {
  return {
    id: `acct-sweep-${Math.random().toString(36).slice(2)}`,
    providerCode: 'trae',
    uid: 'uid-1',
    name: '巡检号',
    tokenEnc: 'enc:jwt',
    refreshTokenEnc: null,
    cookiesEnc: null,
    secretsEnc: null,
    tokenExpiresAt: new Date(Date.now() + 86_400_000),
    priority: 0,
    weight: 1,
    isEnabled: true,
    tempUnschedulable: false,
    healthStatus: 'unknown',
    lastErrorMessage: null,
    lastUsedAt: null,
    refreshFailureCount: 0,
    consecutiveFailures: 0,
    proxyUrl: null,
    ...overrides,
  }
}

beforeEach(async () => {
  accountRows = []
  selectCalls = 0
  updateCalls.length = 0
  await sharedState.reset()
})

describe('sweepAccountPool 分布式锁', () => {
  it('锁空闲 → 正常执行本轮,结束后锁已释放', async () => {
    accountRows = []
    const out = await sweepAccountPool()
    expect(out.skipped).toBe(false)
    // finally 释放:紧接着还能再抢到同一把锁
    const l = await tryAcquireSharedLock(SWEEP_LOCK_NAME, 1_000)
    expect(l).not.toBeNull()
    await l!.release()
  })

  it('锁被其他实例持有 → 本轮整体跳过(零 DB 查询)', async () => {
    const holder = await tryAcquireSharedLock(SWEEP_LOCK_NAME, 60_000)
    expect(holder).not.toBeNull()
    accountRows = [sweepRow()] // 即便有活可干,拿不到锁也不许动
    selectCalls = 0
    const out = await sweepAccountPool()
    expect(out.skipped).toBe(true)
    expect(out.refreshed).toBe(0)
    expect(out.healthChecked).toBe(0)
    expect(selectCalls).toBe(0)
    expect(updateCalls.length).toBe(0)
    await holder!.release()
  })

  it('跳过一轮后锁仍在持有者手里;释放后下一轮恢复执行', async () => {
    const holder = await tryAcquireSharedLock(SWEEP_LOCK_NAME, 60_000)
    const skipped = await sweepAccountPool()
    expect(skipped.skipped).toBe(true)
    // sweep 不得把别人的锁释放掉(token 校验)
    const again = await tryAcquireSharedLock(SWEEP_LOCK_NAME, 60_000)
    expect(again).toBeNull()
    await holder!.release()
    const ran = await sweepAccountPool()
    expect(ran.skipped).toBe(false)
  })

  it('正常巡检行为不因加锁回归:unknown 定级 + 无 refreshToken 跳过刷新', async () => {
    const checkHealth = vi.fn(async () => ({ ok: true }))
    registerRelayAdapter({
      providerCode: 'trae',
      buildChatRequest: () => ({ url: 'https://x.test', method: 'POST', headers: {}, body: {} }),
      translateStreamChunk: () => null,
      translateNonStream: (_c, body) => (body ?? {}) as Record<string, unknown>,
      checkHealth,
      isAuthFailure: (status) => status === 401,
    } as never)
    accountRows = [sweepRow()]
    const out = await sweepAccountPool()
    expect(out.skipped).toBe(false)
    expect(out.refreshSkipped).toBe(1) // 临期候选无 refreshToken 适配器能力 → 跳过
    expect(out.healthChecked).toBe(1) // unknown → checkHealth 定级
    await vi.waitFor(() => expect(updateCalls.length).toBeGreaterThan(0))
    expect(updateCalls.some((s) => s.healthStatus === 'healthy')).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
