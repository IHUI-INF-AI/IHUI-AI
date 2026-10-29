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
  renewalPolicyOf,
  shouldDeferRefresh,
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
  // 本文件既有断言全部专注「临期刷新 / unknown 定级 / down 恢复」三档;本桩的 select
  // 无视 WHERE(查什么回同一行),空闲保活档(2026-10-26 新增)若开着会把同一行再算一遍,
  // 计数与意图混淆。故整文件默认关档,由「空闲保活档在 sweep 里真的执行」一节显式开档对照。
  process.env.RELAY_ACCOUNT_KEEPALIVE_DAYS = 'off'
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

  it('健康检查未判定(上游 5xx/网络)→ 保留 unknown,不写 down', async () => {
    const checkHealth = vi.fn(async () => ({
      ok: false,
      indeterminate: true,
      error: 'model_list HTTP 500: Internal Server Error',
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
    const healthUpdate = updateCalls.find((s) => s.healthStatus !== undefined)
    expect(healthUpdate?.healthStatus).toBe('unknown')
    expect(String(healthUpdate?.lastErrorMessage)).toContain('500')
  })
})

describe('client-first 续期策略(trae 池不与客户端抢轮换)', () => {
  function adapterWithRefresh(refreshToken: ReturnType<typeof vi.fn>): Record<string, unknown> {
    return {
      providerCode: 'trae',
      buildChatRequest: () => ({ url: 'https://x.test', method: 'POST', headers: {}, body: {} }),
      translateStreamChunk: () => null,
      translateNonStream: (_c, body) => (body ?? {}) as Record<string, unknown>,
      checkHealth: vi.fn(async () => ({ ok: true })),
      refreshToken,
      isAuthFailure: (status) => status === 401,
    }
  }

  it('纯函数:trae/qoder=client-first;其余平台=server;开关 0/false/off 退回 server', () => {
    expect(renewalPolicyOf('trae')).toBe('client-first')
    // qoder 2026-10-28 纳入:deviceToken/refresh 轮换 refresh_token,池主动刷会顶号
    expect(renewalPolicyOf('qoder')).toBe('client-first')
    expect(renewalPolicyOf('workbuddy')).toBe('server')
    expect(renewalPolicyOf('trae', { RELAY_TRAE_CLIENT_FIRST_REFRESH: '0' })).toBe('server')
    expect(renewalPolicyOf('trae', { RELAY_TRAE_CLIENT_FIRST_REFRESH: 'false' })).toBe('server')
    expect(renewalPolicyOf('trae', { RELAY_TRAE_CLIENT_FIRST_REFRESH: 'off' })).toBe('server')
    expect(renewalPolicyOf('trae', { RELAY_TRAE_CLIENT_FIRST_REFRESH: '1' })).toBe('client-first')
    expect(renewalPolicyOf('qoder', { RELAY_QODER_CLIENT_FIRST_REFRESH: '0' })).toBe('server')
    expect(renewalPolicyOf('qoder', { RELAY_QODER_CLIENT_FIRST_REFRESH: 'off' })).toBe('server')
    expect(renewalPolicyOf('qoder', { RELAY_QODER_CLIENT_FIRST_REFRESH: '1' })).toBe('client-first')
    // 开关名不得串门:trae 的开关不影响 qoder
    expect(renewalPolicyOf('qoder', { RELAY_TRAE_CLIENT_FIRST_REFRESH: '0' })).toBe('client-first')
  })

  it('纯函数:trae/qoder 票未过期 ⇒ 延迟;已过期 ⇒ 放行;无到期时刻 ⇒ 放行(无法证明客户端在养票,兜底)', () => {
    const now = new Date('2026-10-24T12:00:00.000Z')
    expect(
      shouldDeferRefresh(
        { providerCode: 'trae', tokenExpiresAt: new Date(now.getTime() + 60_000) },
        now,
      ),
    ).toBe(true)
    expect(
      shouldDeferRefresh(
        { providerCode: 'trae', tokenExpiresAt: new Date(now.getTime() - 60_000) },
        now,
      ),
    ).toBe(false)
    expect(shouldDeferRefresh({ providerCode: 'trae', tokenExpiresAt: null }, now)).toBe(false)
    expect(
      shouldDeferRefresh(
        { providerCode: 'workbuddy', tokenExpiresAt: new Date(now.getTime() + 60_000) },
        now,
      ),
    ).toBe(false)
    // qoder 与 trae 同档:票未过期就不许池刷(刷 = 轮换 rt = 顶号)
    expect(
      shouldDeferRefresh(
        { providerCode: 'qoder', tokenExpiresAt: new Date(now.getTime() + 60_000) },
        now,
      ),
    ).toBe(true)
    expect(
      shouldDeferRefresh(
        { providerCode: 'qoder', tokenExpiresAt: new Date(now.getTime() - 60_000) },
        now,
      ),
    ).toBe(false)
  })

  it('trae 票未过期(临期窗口内)⇒ refreshToken 不被调用,refreshSkipped+1', async () => {
    const refreshToken = vi.fn(async () => ({
      token: 'x',
      refreshToken: 'y',
      expiresAt: new Date(),
    }))
    registerRelayAdapter(adapterWithRefresh(refreshToken) as never)
    accountRows = [sweepRow({ tokenExpiresAt: new Date(Date.now() + 5 * 60_000) })]
    const out = await sweepAccountPool()
    expect(out.refreshed).toBe(0)
    expect(out.refreshSkipped).toBe(1)
    expect(refreshToken).not.toHaveBeenCalled()
  })

  it('trae 票已过期 ⇒ 池兜底刷新(refreshToken 恰好一次)', async () => {
    const refreshToken = vi.fn(async () => ({
      token: 'new-token',
      refreshToken: 'new-rt',
      expiresAt: new Date(Date.now() + 86_400_000),
    }))
    registerRelayAdapter(adapterWithRefresh(refreshToken) as never)
    accountRows = [sweepRow({ tokenExpiresAt: new Date(Date.now() - 60_000) })]
    const out = await sweepAccountPool()
    expect(out.refreshed).toBe(1)
    // mock 的 select 对三档查询返回同一行:该行同时命中"临期刷新"与"down 恢复"两档 ⇒ 2 次
    expect(refreshToken).toHaveBeenCalledTimes(2)
  })

  it('阳性对照:workbuddy 临期未过期 ⇒ 照旧刷新(server 策略不受影响)', async () => {
    const refreshToken = vi.fn(async () => ({
      token: 'wb-new',
      refreshToken: 'wb-rt',
      expiresAt: new Date(Date.now() + 86_400_000),
    }))
    registerRelayAdapter({
      providerCode: 'workbuddy',
      buildChatRequest: () => ({ url: 'https://x.test', method: 'POST', headers: {}, body: {} }),
      translateStreamChunk: () => null,
      translateNonStream: (_c, body) => (body ?? {}) as Record<string, unknown>,
      checkHealth: vi.fn(async () => ({ ok: true })),
      refreshToken,
      isAuthFailure: (status) => status === 401,
    } as never)
    accountRows = [
      sweepRow({ providerCode: 'workbuddy', tokenExpiresAt: new Date(Date.now() + 5 * 60_000) }),
    ]
    const out = await sweepAccountPool()
    expect(out.refreshed).toBe(1)
    // 同上:mock 不筛查询,临期 + down 恢复各命中一次
    expect(refreshToken).toHaveBeenCalledTimes(2)
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

/**
 * 刷新成功必须涨 cred_version(2026-10-23 立)。
 * 对账收敛器只在「号池 cred_version > 签到 pool_cred_version」时补推 ⇒ 适配器换出来的新票
 * 若不涨版本,签到侧会永远持有导入那一刻的旧凭证,而号池自己看着 healthy:两面都绿、
 * 上游天天 401。涨版本与写凭证必须是同一笔 UPDATE;失败档不涨(凭证没变,无新东西可推)。
 */
describe('refreshOne 成功必须涨 credVersion', () => {
  const renderSql = (frag: unknown) => new PgDialect().sqlToQuery(frag as never).sql.toLowerCase()

  it('刷新成功 ⇒ 同一笔 UPDATE 里写新凭证 + cred_version 原子自增', async () => {
    const { refreshOne } = await import('../src/services/relay-account-pool-scheduler.js')
    registerRelayAdapter({
      providerCode: 'trae',
      refreshToken: vi.fn(async () => ({
        token: 'new-jwt',
        refreshToken: 'new-rt',
        expiresAt: new Date(Date.now() + 86_400_000),
      })),
    } as never)

    const ok = await refreshOne(sweepRow({ refreshTokenEnc: 'enc:rt' }) as never)
    expect(ok).toBe(true)
    const written = updateCalls[updateCalls.length - 1] as Record<string, unknown>
    expect(String(written.tokenEnc)).toBe('enc:new-jwt')
    expect(written.credVersion).toBeTruthy()
    const text = renderSql(written.credVersion)
    expect(text).toContain('cred_version')
    expect(text).toContain('+ 1')
  })

  it('刷新失败 ⇒ 不涨版本(凭证没变就不许制造版本差)', async () => {
    const { refreshOne } = await import('../src/services/relay-account-pool-scheduler.js')
    registerRelayAdapter({
      providerCode: 'trae',
      refreshToken: vi.fn(async () => {
        throw new Error('Qoder deviceToken/refresh HTTP 400')
      }),
    } as never)
    updateCalls.length = 0

    const ok = await refreshOne(sweepRow({ refreshTokenEnc: 'enc:rt' }) as never)
    expect(ok).toBe(false)
    const written = updateCalls[updateCalls.length - 1] as Record<string, unknown>
    expect(written.credVersion).toBeUndefined()
  })
})

/**
 * 「可调度」判据单源(2026-10-23 立)。
 * 立因:巡检把上游明确拒收判成 healthStatus='down' 并收敛到期列,而选号 WHERE 只看
 * isEnabled ∧ ¬tempUnschedulable ⇒ 巡检判死的号照样被转发选中,两个面各写一份「可用」口径。
 * 这里渲染调度实际使用的条件对象(与生产同一份,§0.6 不复写判据),并把巡检的产物
 * (healthStatusOf)喂回去,锁死"巡检判死的那一格正是调度排除的那一格"。
 */
describe('可调度判据:巡检 down ⇒ 调度当场排除', () => {
  const render = (frag: unknown) => {
    const q = new PgDialect().sqlToQuery(frag as never)
    return { text: q.sql.toLowerCase(), params: (q.params as unknown[]).map(String) }
  }

  it('条件含启用/摘除/健康三面,且排除 healthStatus=down', async () => {
    const { accountSchedulableCondition } =
      await import('../src/services/relay-account-pool-scheduler.js')
    const { text, params } = render(accountSchedulableCondition())
    expect(text).toContain('is_enabled')
    expect(text).toContain('temp_unschedulable')
    expect(text).toContain('health_status')
    expect(text).toContain('<>')
    expect(params).toContain('down')
  })

  it('巡检产出的死值就是调度排除的值(healthStatusOf → 条件参数)', async () => {
    const m = await import('../src/services/relay-account-pool-scheduler.js')
    // 明确拒收(非 indeterminate)才判死;未判定必须留在 unknown(否则一次 5xx 就摘活号)
    const rejected = m.healthStatusOf({ ok: false, indeterminate: false })
    expect(rejected).toBe('down')
    expect(m.healthStatusOf({ ok: false, indeterminate: true })).toBe('unknown')
    expect(render(m.accountSchedulableCondition()).params).toContain(rejected)
  })

  it('选号侧只 import 这一条判据,不得自己再写一份 isEnabled/tempUnschedulable', async () => {
    // 由本文件自身位置推导(禁 process.cwd() 定根,§15)
    const src = fs.readFileSync(
      fileURLToPath(new URL('../src/services/relay-account-forwarder.ts', import.meta.url)),
      'utf8',
    )
    expect(src).toContain('accountSchedulableCondition')
    expect(src).not.toContain('eq(aiRelayAccountPool.isEnabled')
    expect(src).not.toContain('eq(aiRelayAccountPool.tempUnschedulable')
  })

  it('markAccountAuthRejected:到期列收敛与健康降级同一次写(管理面余额档复用)', async () => {
    const m = await import('../src/services/relay-account-pool-scheduler.js')
    const now = new Date('2026-10-24T00:00:00Z')
    updateCalls.length = 0
    await m.markAccountAuthRejected('acct-expiry-admin', 'quota HTTP 401: TOKEN_INVALID', now)
    const written = updateCalls[updateCalls.length - 1] as Record<string, unknown>
    expect(written.tokenExpiresAt).toBe(now)
    expect(written.healthStatus).toBe('down')
    expect(written.healthCheckedAt).toBe(now)
    expect(String(written.lastErrorMessage)).toContain('401')
  })
})

/**
 * 空闲保活(2026-10-26 立,对标 workbuddy-switch 桌面端的「每日保活」)。
 * 为什么单独锁:上游会清理闲置的 refresh 会话(实测 invalid_grant),而临期档只救
 * 「将过期」的号 —— 一池号若整周没被转发用过,临期档一条都不会命中,整池静默等死。
 * 这一档的全部价值只能在 WHERE 形状上证明,所以渲染生产同一份条件对象
 * (§0.6 不在测试里复制第二份判据);env 档锁「失效方向 = 照默认保活」而非静默关档。
 */
describe('空闲保活:窗口 env 与 WHERE 形状', () => {
  const render = (frag: unknown) => {
    const q = new PgDialect().sqlToQuery(frag as never)
    return { text: q.sql.toLowerCase(), params: (q.params as unknown[]).map(String) }
  }

  it('env 矩阵:缺省=默认窗口;数字生效;0/off/false 整档关;非法值回落默认(不得静默关掉保活)', async () => {
    const { keepaliveIdleDays, KEEPALIVE_DEFAULT_DAYS } =
      await import('../src/services/relay-account-pool-scheduler.js')
    expect(keepaliveIdleDays({})).toBe(KEEPALIVE_DEFAULT_DAYS)
    expect(keepaliveIdleDays({ RELAY_ACCOUNT_KEEPALIVE_DAYS: '3' })).toBe(3)
    expect(keepaliveIdleDays({ RELAY_ACCOUNT_KEEPALIVE_DAYS: '0' })).toBeNull()
    expect(keepaliveIdleDays({ RELAY_ACCOUNT_KEEPALIVE_DAYS: 'off' })).toBeNull()
    expect(keepaliveIdleDays({ RELAY_ACCOUNT_KEEPALIVE_DAYS: 'FALSE' })).toBeNull()
    expect(keepaliveIdleDays({ RELAY_ACCOUNT_KEEPALIVE_DAYS: 'abc' })).toBe(KEEPALIVE_DEFAULT_DAYS)
    expect(keepaliveIdleDays({ RELAY_ACCOUNT_KEEPALIVE_DAYS: '-1' })).toBe(KEEPALIVE_DEFAULT_DAYS)
    expect(KEEPALIVE_DEFAULT_DAYS).toBeGreaterThanOrEqual(3)
  })

  it('WHERE:三面闸(启用/未摘除/未判死)+ 自救通道 + 闲置时钟', async () => {
    const m = await import('../src/services/relay-account-pool-scheduler.js')
    const { text, params } = render(m.keepaliveIdleWhere(new Date('2026-10-26T00:00:00Z')))
    expect(text).toContain('is_enabled')
    expect(text).toContain('temp_unschedulable')
    expect(text).toContain('health_status')
    expect(text).toContain('refresh_token_enc')
    expect(text).toContain('cookies_enc')
    expect(params.length).toBeGreaterThan(0)
  })

  /**
   * 窗口边界必须是驱动能吃的类型(2026-10-28 生产实测补)。
   *
   * 上一版 WHERE 用 `lt(accountIdleClock(), cutoff)` —— 左边是裸 sql 片段,没有列可推断,
   * drizzle 不会替 Date 做 mapToDriverValue,postgres.js 收到 Date 当场抛
   * `ERR_INVALID_ARG_TYPE: Received an instance of Date`,整个 sweep 从步骤 1.5 开始每 5 分钟
   * 抛死(后面的定级/恢复/对账全不执行)。
   *
   * 为什么之前没红:上面的 render 用 `String(p)` 收窄过 params,Date → 字符串,缺陷被抹平。
   * 所以这条断言**取原始 params**(不经 String),锁死「不得出现 Date 实例 + 边界是 ISO 串 +
   * 带显式 ::timestamptz 转换」。没有它,这类错只在生产运行时现形,单测永远绿。
   */
  it('窗口边界绑定驱动可吃的类型(原始 params 不得含 Date 实例)', async () => {
    const m = await import('../src/services/relay-account-pool-scheduler.js')
    const frag = m.keepaliveIdleWhere(new Date('2026-10-26T00:00:00Z'))
    const q = new PgDialect().sqlToQuery(frag as never)
    const raw = q.params as unknown[]
    expect(raw.some((p) => p instanceof Date)).toBe(false)
    expect(raw).toContain('2026-10-26T00:00:00.000Z')
    expect(q.sql.toLowerCase()).toContain('::timestamptz')
  })

  it('闲置时钟必须同吃 last_used_at 与 last_refresh_at(只看使用 = 每轮重刷同一批号的续票风暴)', async () => {
    const m = await import('../src/services/relay-account-pool-scheduler.js')
    const { text } = render(m.accountIdleClock())
    expect(text).toContain('greatest(')
    expect(text).toContain('coalesce')
    expect(text).toContain('last_used_at')
    expect(text).toContain('last_refresh_at')
    expect(text).toContain('created_at')
  })
})

/**
 * 空闲保活档在 sweep 里真的执行(2026-10-26 立,开关侧成对对照)。
 * 为什么成对:本桩 select 无视 WHERE,「档有没有被接线」不能靠形状证,只能靠
 * 开/关两次产出差分 —— 只跑开档一侧,档被摘掉测试也不会红(§0.9 造好没装车=没有)。
 */
describe('空闲保活档在 sweep 里真的执行(开关成对对照)', () => {
  const DAY = 86_400_000

  function adapterWith(refreshToken: ReturnType<typeof vi.fn>) {
    return {
      providerCode: 'workbuddy',
      buildChatRequest: () => ({ url: 'https://x.test', method: 'POST', headers: {}, body: {} }),
      translateStreamChunk: () => null,
      translateNonStream: (_c: unknown, body: unknown) => (body ?? {}) as Record<string, unknown>,
      checkHealth: async () => ({ ok: true }),
      isAuthFailure: (status: number) => status === 401,
      refreshToken,
    }
  }

  /**
   * 为什么必须成对:本桩 select 无视 WHERE ⇒ 同一行会被临期/恢复档重复派发,「保活档
   * 有没有接线」无法靠形状证明;只有「开档 = 关档 + 恰好 1 次派发」这个差值能证明
   * 它真的挂在 sweep 上(§0.9 造好没装车=没有;只测开档一侧,摘掉档也不会红)。
   * 每侧都用全新 spy:registerRelayAdapter 是覆盖注册,复用同一 spy 会把两档计数混在一起。
   */
  async function dispatchCount(days: string): Promise<{ keepalive: number; calls: number }> {
    const refreshToken = vi.fn(async () => ({
      token: 'new-jwt',
      refreshToken: 'new-rt',
      expiresAt: new Date(Date.now() + 30 * DAY),
    }))
    registerRelayAdapter(adapterWith(refreshToken) as never)
    accountRows = [
      sweepRow({
        providerCode: 'workbuddy',
        refreshTokenEnc: 'enc:rt',
        healthStatus: 'healthy',
        tokenExpiresAt: new Date(Date.now() + 30 * DAY),
      }),
    ]
    process.env.RELAY_ACCOUNT_KEEPALIVE_DAYS = days
    const out = await sweepAccountPool()
    return { keepalive: out.keepalive, calls: refreshToken.mock.calls.length }
  }

  it('关档 keepalive=0;开档 keepalive=1 且派发次数恰为关档 + 1(差值只可能来自这一档)', async () => {
    const off = await dispatchCount('off')
    const on = await dispatchCount('3')
    try {
      expect(off.keepalive).toBe(0)
      expect(on.keepalive).toBe(1)
      expect(off.calls).toBeGreaterThan(0) // 桩会把它塞进临期档:非零才说明对照成立
      expect(on.calls).toBe(off.calls + 1)
    } finally {
      process.env.RELAY_ACCOUNT_KEEPALIVE_DAYS = 'off'
    }
  })
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
