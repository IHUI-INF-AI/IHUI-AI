// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * relay-account-pool-scheduler 巡检分布式锁测试(2026-10-22 多实例改造)。
 * 零真实 Redis/DB:shared-state 走内存兜底档(REDIS_URL 指死端口)+ drizzle 链式 mock。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

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

// 台账清理单独 mock:验证 sweep 每轮触发 + 24h 节流,不牵扯真实删除
const mockPurgeAccountUsage = vi.hoisted(() => vi.fn().mockResolvedValue(0))
vi.mock('../src/services/relay-account-usage.js', () => ({
  purgeAccountUsage: mockPurgeAccountUsage,
}))

import {
  SWEEP_LOCK_NAME,
  __test__,
  healthStatusOf,
  sweepAccountPool,
} from '../src/services/relay-account-pool-scheduler.js'
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
  mockPurgeAccountUsage.mockClear()
  __test__.resetUsagePurgeThrottle()
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

describe('健康三态定级(取不到 ≠ 失效)', () => {
  it('healthStatusOf:ok → healthy;未判定 → unknown;明确拒收 → down', () => {
    expect(healthStatusOf({ ok: true })).toBe('healthy')
    expect(healthStatusOf({ ok: false, indeterminate: true })).toBe('unknown')
    expect(healthStatusOf({ ok: false })).toBe('down')
    expect(healthStatusOf({ ok: false, indeterminate: false, error: '401' })).toBe('down')
  })

  it('巡检遇到未判定结果保留 unknown,不得写 down', async () => {
    const checkHealth = vi.fn(async () => ({
      ok: false,
      indeterminate: true,
      error: 'model_list HTTP 500(未判定)',
    }))
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
    expect(out.healthChecked).toBe(1)
    await vi.waitFor(() => expect(updateCalls.length).toBeGreaterThan(0))
    const healthWrites = updateCalls.filter((s) => 'healthStatus' in s)
    expect(healthWrites.some((s) => s.healthStatus === 'down')).toBe(false)
    expect(healthWrites.some((s) => s.healthStatus === 'unknown')).toBe(true)
    expect(String(healthWrites[0]?.lastErrorMessage)).toContain('未判定')
  })
})

describe('sweepAccountPool 台账清理与并发上限', () => {
  it('每轮 sweep 触发一次台账清理;24h 内第二轮不再 delete', async () => {
    await sweepAccountPool()
    expect(mockPurgeAccountUsage).toHaveBeenCalledTimes(1)
    await sweepAccountPool()
    expect(mockPurgeAccountUsage).toHaveBeenCalledTimes(1)
    // 重置节流后恢复
    __test__.resetUsagePurgeThrottle()
    await sweepAccountPool()
    expect(mockPurgeAccountUsage).toHaveBeenCalledTimes(2)
  })

  it('健康检查并发不超过 5', async () => {
    let inFlight = 0
    let maxInFlight = 0
    const checkHealth = vi.fn(async () => {
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise((r) => setTimeout(r, 5))
      inFlight--
      return { ok: true }
    })
    registerRelayAdapter({
      providerCode: 'trae',
      buildChatRequest: () => ({ url: 'https://x.test', method: 'POST', headers: {}, body: {} }),
      translateStreamChunk: () => null,
      translateNonStream: (_c, body) => (body ?? {}) as Record<string, unknown>,
      checkHealth,
      isAuthFailure: (status) => status === 401,
    } as never)
    accountRows = Array.from({ length: 8 }, () => sweepRow())
    const out = await sweepAccountPool()
    expect(out.healthChecked).toBe(8)
    expect(maxInFlight).toBeLessThanOrEqual(5)
    expect(maxInFlight).toBeGreaterThan(1)
  })
})

/**
 * 候选谓词的形状锁(2026-10-23 立)。
 * 为什么单独锁这一格:调度器测试的 DB 桩是"给它什么行它就当查到了什么行",
 * 结构上**证不了 WHERE**。而这一票修的正是 WHERE ——
 * Trae web 号只有 cookiesEnc、没有 refreshTokenEnc,谓词写死 rt 非空时它既不进临期刷新、
 * 也不进 down 恢复,掉进 down 后永久停摆(盘上现读那枚 trae-web-real 就是这个形态)。
 * 所以这里直接渲染查询实际使用的那两个条件对象(与生产同一份,§0.6 不复写判据)。
 */
describe('可再取凭据的候选谓词(cookie 通道必须在内)', () => {
  const render = (sql: unknown) => {
    const q = new PgDialect().sqlToQuery(sql as never)
    return { text: q.sql.toLowerCase(), params: (q.params as unknown[]).map(String) }
  }

  it('临期刷新候选:rt 与 cookie 两条通道都以 OR 并存,且仍受到期界限约束', async () => {
    const { expiringRefreshWhere } = await import('../src/services/relay-account-pool-scheduler.js')
    const { text, params } = render(expiringRefreshWhere(new Date('2026-10-23T00:00:00Z')))
    expect(text).toContain(' or ')
    expect(text).toContain('refresh_token_enc')
    expect(text).toContain('cookies_enc')
    expect(text).toContain('is not null')
    expect(text).toContain('token_expires_at')
    expect(text).toContain('<=')
    expect(text).toContain('is_enabled')
    expect(params).toContain('true')
  })

  it('down 恢复候选:含 cookie 通道且按 down/degraded 定级筛,不受到期界限拦', async () => {
    const { downRecoveryWhere } = await import('../src/services/relay-account-pool-scheduler.js')
    const { text, params } = render(downRecoveryWhere())
    expect(text).toContain('cookies_enc')
    expect(text).toContain('refresh_token_enc')
    expect(text).toContain('health_status')
    expect(text).toContain(' in ')
    expect(params).toContain('down')
    expect(params).toContain('degraded')
    // 正向对照:恢复档刻意不加到期条件(down 号的到期字段本就可信度存疑)
    expect(text).not.toContain('token_expires_at')
  })

  it('谓词单源:两档都不得自带一份 rt 判空(全文件只许出现一次)', async () => {
    const m = await import('../src/services/relay-account-pool-scheduler.js')
    // 由本文件自身位置推导(禁 process.cwd() 定根,§15)
    const src = fs.readFileSync(
      fileURLToPath(new URL('../src/services/relay-account-pool-scheduler.ts', import.meta.url)),
      'utf8',
    )
    const sites = (src.match(/isNotNull\(aiRelayAccountPool\.refreshTokenEnc\)/g) ?? []).length
    expect(sites).toBe(1)
    // 且那一处必须在 recredentialableCondition 里(两档渲染片段都含它)
    const both = new PgDialect().sqlToQuery(m.recredentialableCondition() as never).sql
    expect(render(m.expiringRefreshWhere(new Date())).text).toContain(both.toLowerCase())
    expect(render(m.downRecoveryWhere()).text).toContain(both.toLowerCase())
  })
})

/**
 * 刷新失败原因的可见性(2026-10-23 立)。
 * 原形态:catch 把异常整个吞掉,只有撞上限那一次写一句"连续 N 次刷新失败",
 * 于是"cookie 死了 / 票被顶掉 / 代码错"三种成因在账面上一模一样 —— 本机为分辨它们
 * 跑了四型对照才定下来。失效方向必须是"多留一条可读原因",不能是静默。
 */
describe('refreshOne 失败原因必须带出来', () => {
  it('未超限 ⇒ 写原因、不写摘除;超限 ⇒ 原因与摘除并列', async () => {
    const { refreshOne } = await import('../src/services/relay-account-pool-scheduler.js')
    registerRelayAdapter({
      providerCode: 'trae',
      refreshToken: vi.fn(async () => {
        throw new Error('Trae GetUserToken 失败(HTTP 401): code=1001')
      }),
    } as never)

    await refreshOne(sweepRow({ refreshFailureCount: 0 }) as never)
    const first = updateCalls[updateCalls.length - 1] as Record<string, unknown>
    expect(String(first.lastErrorMessage)).toContain('GetUserToken 失败(HTTP 401)')
    expect(String(first.lastErrorMessage)).toContain('第 1/')
    expect(String(first.lastErrorMessage)).not.toContain('已自动摘除')
    expect(first.tempUnschedulable).not.toBe(true)

    updateCalls.length = 0
    await refreshOne(sweepRow({ refreshFailureCount: 99 }) as never)
    const last = updateCalls[updateCalls.length - 1] as Record<string, unknown>
    expect(String(last.lastErrorMessage)).toContain('GetUserToken 失败(HTTP 401)')
    expect(String(last.lastErrorMessage)).toContain('已自动摘除')
    expect(last.tempUnschedulable).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
