// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * C 档接线锁(2026-11-10):sweep 的「接管前当场再探测」通道 + 让位留声。
 *
 * 钉的失效形态:
 *  P1 探测「在跑」⇒ 永久保活号一枚都不刷(refreshToken 零调用)——这是不可逆掉线的正面防线;
 *  P2 探测未判定/不传 probe ⇒ 同向让位(默认=多让,绝不因量不到而接管);
 *  P3 探测「没在跑」且心跳陈旧 ⇒ 才允许接管(refreshToken 被调,临期/保活/down 三档同判据);
 *  P4 同轮逐平台只问一次(探测是 spawn,重复问 = 同轮两个读数打架);
 *  P5 让位必须有声:foreverDeferred 进 sweep 读数面 + 逐枚原因进日志(§0.10 不许静默);
 *  P6 非永久保活号不受 probe 影响(client-first 票面语义原样)。
 *
 * 判据 import 生产端(§0.6),测试内零复制。零真实 DB/Redis/上游。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

let accountRows: unknown[] = []
const updateCalls: Array<Record<string, unknown>> = []

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

vi.mock('../src/config/index.js', () => ({
  config: { REDIS_URL: 'redis://127.0.0.1:1/0' },
}))

const mockPurgeAccountUsage = vi.hoisted(() => vi.fn().mockResolvedValue(0))
vi.mock('../src/services/relay-account-usage.js', () => ({
  purgeAccountUsage: mockPurgeAccountUsage,
}))

const logInfo = vi.hoisted(() => vi.fn())
const logWarn = vi.hoisted(() => vi.fn())
vi.mock('../src/utils/logger.js', () => ({
  logger: {
    info: logInfo,
    warn: logWarn,
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
  },
}))

import {
  __test__,
  CLIENT_ACTIVE_AT_KEY,
  KEEPALIVE_FOREVER_KEY,
  sweepAccountPool,
} from '../src/services/relay-account-pool-scheduler.js'
import { __test__ as sharedState } from '../src/services/relay-account-shared-state.js'
import { registerRelayAdapter } from '../src/services/relay-upstream-adapters.js'

function foreverRow(heartbeat: Date | null): unknown {
  return {
    id: 'acct-forever-1',
    providerCode: 'trae',
    uid: 'uid-forever',
    name: '永久保活号',
    tokenEnc: 'enc:jwt',
    refreshTokenEnc: 'enc:rt',
    cookiesEnc: null,
    secretsEnc: null,
    tokenExpiresAt: new Date(Date.now() + 60_000), // 临期窗口内 ⇒ 进临期档候选
    priority: 0,
    weight: 1,
    isEnabled: true,
    tempUnschedulable: false,
    healthStatus: 'down', // 让 down 恢复档也吃到同一枚(三档同源判据的正对照)
    lastErrorMessage: null,
    lastUsedAt: null,
    refreshFailureCount: 0,
    consecutiveFailures: 0,
    proxyUrl: null,
    extraMetadata: {
      [KEEPALIVE_FOREVER_KEY]: true,
      ...(heartbeat ? { [CLIENT_ACTIVE_AT_KEY]: heartbeat.toISOString() } : {}),
    },
  }
}

function nonForeverRow(): unknown {
  const row = foreverRow(null) as Record<string, unknown>
  row.extraMetadata = {}
  return row
}

let refreshTokenCalls = 0
beforeEach(async () => {
  accountRows = []
  updateCalls.length = 0
  logInfo.mockClear()
  refreshTokenCalls = 0
  mockPurgeAccountUsage.mockClear()
  __test__.resetUsagePurgeThrottle()
  await sharedState.reset()
  registerRelayAdapter({
    providerCode: 'trae',
    buildChatRequest: () => ({ url: 'https://x.test', method: 'POST', headers: {}, body: {} }),
    translateStreamChunk: () => null,
    translateNonStream: (_c: unknown, body: unknown) => (body ?? {}) as Record<string, unknown>,
    checkHealth: vi.fn(async () => ({ ok: true })),
    isAuthFailure: (status: number) => status === 401,
    refreshToken: vi.fn(async () => {
      refreshTokenCalls++
      return {
        token: 'new-token',
        refreshToken: 'new-rt',
        expiresAt: new Date(Date.now() + 86_400_000),
      }
    }),
  } as never)
})

const STALE = new Date(Date.now() - 31 * 60 * 1000) // 超过 CLIENT_ACTIVE_TTL_MS(现读 30min)

describe('sweep 接管前当场再探测(C 档)', () => {
  it('P1 探测「在跑」⇒ 永久保活号零刷新,即使心跳陈旧', async () => {
    accountRows = [foreverRow(STALE)]
    const out = await sweepAccountPool(() => true)
    expect(refreshTokenCalls).toBe(0)
    expect(out.refreshed).toBe(0)
    expect(out.foreverDeferred).toBeGreaterThan(0)
  })

  it('P2 探测未判定/不传 probe ⇒ 同向让位(默认=多让,绝不因量不到而接管)', async () => {
    accountRows = [foreverRow(STALE)]
    const nullOut = await sweepAccountPool(() => null)
    expect(refreshTokenCalls).toBe(0)
    expect(nullOut.foreverDeferred).toBeGreaterThan(0)
    await sharedState.reset()
    accountRows = [foreverRow(STALE)]
    const bareOut = await sweepAccountPool()
    expect(refreshTokenCalls).toBe(0)
    expect(bareOut.foreverDeferred).toBeGreaterThan(0)
  })

  it('P3 探测「没在跑」且心跳陈旧 ⇒ 才接管(refreshToken 被调,foreverDeferred=0)', async () => {
    accountRows = [foreverRow(STALE)]
    const out = await sweepAccountPool(() => false)
    expect(refreshTokenCalls).toBeGreaterThan(0)
    expect(out.foreverDeferred).toBe(0)
  })

  it('P4 同轮逐平台只问一次(三档候选同一枚号不重复触发探测)', async () => {
    accountRows = [foreverRow(STALE)]
    const probe = vi.fn(() => true)
    await sweepAccountPool(probe)
    expect(probe).toHaveBeenCalledTimes(1)
  })

  it('P5 让位留声:逐枚原因进调度日志(§0.10,不得静默)', async () => {
    accountRows = [foreverRow(STALE)]
    const out = await sweepAccountPool(() => true)
    const deferLogs = logInfo.mock.calls.filter((c) =>
      String(c[0]).includes('永久保活号本轮让位客户端'),
    )
    expect(deferLogs.length).toBeGreaterThan(0)
    expect(String(deferLogs[0]?.[1]?.reason)).toBe('client-running-or-unjudged')
    expect(out.foreverDeferred).toBeGreaterThan(0)
  })

  it('P6 非永久保活号不受 probe 影响:client-first 票未过期照旧让位,与探测三态无关', async () => {
    accountRows = [nonForeverRow()]
    const out = await sweepAccountPool(() => false)
    expect(refreshTokenCalls).toBe(0) // 票未过期(60s 后到期 > now)⇒ client-first 让位
    expect(out.foreverDeferred).toBe(0) // 普通号的让位不计进永久保活读数面
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
