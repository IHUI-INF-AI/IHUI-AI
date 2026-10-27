// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * O64 号池 sweep「产出面 × 消费面」同键锁(2026-10-24 立)。
 *
 * 立因(HEAD 现读):`relay-account-pool-worker` 在 sweep 日志里读 `result.checkinReconcile`
 * 与 `result.checkinRetry`,而生产端 `sweepAccountPool` 只发 6 枚键 ⇒ `pnpm --filter @ihui/api
 * typecheck` 13 处 TS2339(全部落在那枚 worker 文件),运行时那两枚键恒为 undefined。
 * 这是「半接线」的一型:消费端先于生产端落地(或生产端被整文件写回旧态),两面都无人喊。
 *
 * 本用例把这条判据接成机器尺子,而不是靠人眼对账:
 * 1. 产出面 —— 未抢到锁 / 抢到锁两条分支必须发同一组键(某条分支漏发 = 消费端在该分支读到 undefined);
 * 2. 消费面 —— worker 源码里每一枚 `result.<键>` 都必须落在产出面真实发出的键集内。
 *
 * 键集一律**从生产端运行时导出**,测试内不复制第二份清单(AGENTS §0.6 单一真相源);
 * 产出面对接口 `AccountPoolSweepResult` 的符合性由 apps/api 的 src 面 tsc 证(对象字面量同时受
 * 「必带全部必填键」与「不得多写键」两头约束 ⇒ 字面量键集 ≡ 接口键集)。
 *
 * 零真实 DB/Redis:db 链式打桩返回空集;锁走 `relay-account-shared-state` 的内存兜底。
 */
import { readFileSync } from 'node:fs'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.NODE_ENV = 'test'
})

vi.mock('../src/db/index.js', () => {
  const withSettlers = (step: Record<string, unknown>, resolver: () => unknown[]) => {
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(resolver()).then(resolve, reject)
    step.catch = (reject?: (e: unknown) => void) => Promise.resolve(resolver()).catch(reject)
    step.finally = (fn?: () => void) => Promise.resolve(resolver()).finally(fn)
    return step
  }
  const chainSelect = () => {
    const step: Record<string, unknown> = {}
    for (const m of ['from', 'where', 'limit', 'offset', 'orderBy', 'groupBy']) {
      step[m] = vi.fn(() => step)
    }
    // 空号池:本轮既不刷新也不定级,产出面只剩计数器与 skipped 旗
    return withSettlers(step, () => [])
  }
  const chainWrite = () => {
    const step: Record<string, unknown> = {}
    for (const m of ['from', 'where', 'returning', 'values']) {
      step[m] = vi.fn(() => step)
    }
    step.set = vi.fn(() => step)
    return withSettlers(step, () => [])
  }
  return {
    db: {
      select: chainSelect,
      execute: vi.fn(async () => []),
      update: chainWrite,
      insert: chainWrite,
      delete: chainWrite,
    },
    dbRead: { select: chainSelect },
  }
})

vi.mock('../src/utils/crypto.js', () => ({
  encryptField: (v: string) => `enc:${v}`,
  decryptField: (v: string) => (v.startsWith('enc:') ? v.slice(4) : v),
}))

vi.mock('../src/config/index.js', () => ({
  config: { REDIS_URL: 'redis://127.0.0.1:1/0' },
}))

const mockPurgeAccountUsage = vi.hoisted(() => vi.fn().mockResolvedValue(0))
vi.mock('../src/services/relay-account-usage.js', () => ({
  purgeAccountUsage: mockPurgeAccountUsage,
}))

import {
  __test__ as schedulerTest,
  SWEEP_LOCK_NAME,
  sweepAccountPool,
} from '../src/services/relay-account-pool-scheduler.js'
import {
  __test__ as sharedState,
  tryAcquireSharedLock,
} from '../src/services/relay-account-shared-state.js'

const WORKER_SOURCE = new URL('../src/workers/relay-account-pool-worker.ts', import.meta.url)

/** 产出面真实发出的键集(从运行时导出,不在测试里复制第二份清单)。 */
function emittedKeys(result: object): string[] {
  return Object.keys(result).sort()
}

/** 消费面(worker 源码)读到的键集,含 `result?.x` 形态。 */
function consumedKeys(source: string): string[] {
  const out = new Set<string>()
  for (const match of source.matchAll(/\bresult\??\.([A-Za-z0-9_]+)/g)) {
    if (match[1]) out.add(match[1])
  }
  return [...out].sort()
}

beforeEach(async () => {
  mockPurgeAccountUsage.mockClear()
  schedulerTest.resetUsagePurgeThrottle()
  await sharedState.reset()
})

describe('号池 sweep 产出面 × 消费面同键', () => {
  it('两条分支(锁被占跳过 / 真跑一轮)发出的键集完全一致', async () => {
    const held = await tryAcquireSharedLock(SWEEP_LOCK_NAME, 60_000)
    expect(held).not.toBeNull()
    let skipped
    try {
      skipped = await sweepAccountPool()
    } finally {
      expect(held).not.toBeNull()
      await held!.release()
    }
    expect(skipped.skipped).toBe(true)

    // 锁已释放 ⇒ 这一轮真跑 runSweepOnce(空号池:计数全 0,skipped=false)
    const ran = await sweepAccountPool()
    expect(ran.skipped).toBe(false)
    expect(emittedKeys(ran)).toEqual(emittedKeys(skipped))
    expect(ran.refreshed).toBe(0)
  })

  it('产出面每一枚值都是标量(不得偷偷多发对象/嵌套键而消费面不解码)', async () => {
    const ran = await sweepAccountPool()
    for (const [key, value] of Object.entries(ran)) {
      expect(typeof value, `sweepAccountPool().${key}`).toMatch(/^(number|boolean)$/)
    }
  })

  it('消费面(worker 日志)不得读产出面不发的键', async () => {
    const produced = emittedKeys(await sweepAccountPool())
    const consumed = consumedKeys(readFileSync(WORKER_SOURCE, 'utf8'))

    // 防空转:两侧都必须枚举到东西,任一侧为 0 判死不记绿(AGENTS §0.3)
    expect(produced.length).toBeGreaterThan(1)
    expect(consumed.length).toBeGreaterThan(0)

    const phantom = consumed.filter((key) => !produced.includes(key))
    expect(
      phantom,
      `worker 读取了 sweepAccountPool 未发出的键 ${phantom.join(',')} ⇒ tsc 必红(产出面=${produced.join(',')})`,
    ).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
