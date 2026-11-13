// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-647 回归锁(2026-11-13):人工「临时摘除」不得被巡检自动撤销。
 *
 * 病灶:`tempUnschedulable` 同时承载巡检自动摘除与管理员人工止血,而 `refreshOne`
 * 换票成功无脑写 `tempUnschedulable=false` ⇒ 人工摘除在 5 分钟内被下一轮 sweep 撤销。
 *
 * 本文件锁:
 *   ① 自动摘除(来源 auto,或历史行失败计数达阈值)⇒ 换票成功可清理摘除态;
 *   ② 人工摘除(来源 manual,或历史行计数未达阈值)⇒ 换票成功也不得撤旗;
 *   ③ 候选面 SQL 必须带来源判据(down 恢复排除 manual、永久保活解摘只吃 auto);
 *   ④ 来源判据/键名单源 import 生产端,测试不复制第二份规则(§0.6)。
 *
 * 只 mock db / crypto / config / 日志 / 客户端镜像,零真实 DB/Redis/上游。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.NODE_ENV = 'test'
})

let accountRows: unknown[] = []
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

// shared-state 强制内存兜底档(Redis 指死端口),不触真实 Redis
vi.mock('../src/config/index.js', () => ({
  config: { REDIS_URL: 'redis://127.0.0.1:1/0' },
}))

const mockPurgeAccountUsage = vi.hoisted(() => vi.fn().mockResolvedValue(0))
vi.mock('../src/services/relay-account-usage.js', () => ({
  purgeAccountUsage: mockPurgeAccountUsage,
}))

vi.mock('../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
  },
}))

// 客户端会话镜像只换掉会落进程的 IO;调度器只消费这五个出口
vi.mock('../src/services/relay-client-session-mirror.js', () => ({
  pullClientSession: vi.fn(async () => null),
  pushClientSession: vi.fn(async () => false),
  shouldAdoptClientRt: () => false,
  shouldPushAfterRefresh: () => false,
  buildPushPayload: () => ({}),
}))

import {
  downRecoveryWhere,
  isManuallyUnschedulable,
  keepAliveReviveWhere,
  sweepAccountPool,
  unschedulableSourceOf,
  UNSCHEDULABLE_SOURCE_KEY,
  __test__,
} from '../src/services/relay-account-pool-scheduler.js'
import { __test__ as sharedState } from '../src/services/relay-account-shared-state.js'
import { registerRelayAdapter } from '../src/services/relay-upstream-adapters.js'

const render = (frag: unknown) => {
  const built = new PgDialect().sqlToQuery(frag as never)
  return { sql: built.sql.toLowerCase(), params: built.params as unknown[] }
}

function poolRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'acct-f647',
    providerCode: 'trae',
    uid: 'uid-f647',
    name: 'F-647 号',
    tokenEnc: 'enc:jwt',
    refreshTokenEnc: 'enc:rt',
    cookiesEnc: null,
    secretsEnc: null,
    tokenExpiresAt: new Date(Date.now() - 60_000), // 已过期 ⇒ client-first 不拦,必走换票
    priority: 0,
    weight: 1,
    isEnabled: true,
    tempUnschedulable: true,
    healthStatus: 'down',
    healthCheckedAt: null,
    lastErrorMessage: '管理员临时摘除',
    lastUsedAt: null,
    lastRefreshAt: null,
    refreshFailureCount: 0,
    consecutiveFailures: 0,
    proxyUrl: null,
    credVersion: 7,
    extraMetadata: {},
    createdAt: new Date(Date.now() - 86_400_000),
    updatedAt: new Date(),
    ...overrides,
  }
}

/** 换票成功那一笔写(失败/健康/解摘档都不写 credVersion) */
const refreshWrites = () => updateCalls.filter((s) => 'credVersion' in s)

let refreshTokenCalls = 0
beforeEach(async () => {
  accountRows = []
  updateCalls.length = 0
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
    isAuthError: (status: number) => status === 401,
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

describe('摘除来源判据(单源 import 生产端)', () => {
  it('① 只认 manual/auto 两个字面量,缺失/坏形态 ⇒ null', () => {
    expect(unschedulableSourceOf({ extraMetadata: { [UNSCHEDULABLE_SOURCE_KEY]: 'manual' } })).toBe(
      'manual',
    )
    expect(unschedulableSourceOf({ extraMetadata: { [UNSCHEDULABLE_SOURCE_KEY]: 'auto' } })).toBe(
      'auto',
    )
    for (const meta of [{}, null, undefined, 'x', [], { [UNSCHEDULABLE_SOURCE_KEY]: 'MANUAL' }]) {
      expect(unschedulableSourceOf({ extraMetadata: meta as unknown })).toBeNull()
    }
  })

  it('② 人工摘除:来源 manual,或历史行失败计数未达自动摘除阈值', () => {
    expect(
      isManuallyUnschedulable({
        tempUnschedulable: true,
        refreshFailureCount: 0,
        extraMetadata: { [UNSCHEDULABLE_SOURCE_KEY]: 'manual' },
      }),
    ).toBe(true)
    // 历史行(无标记):管理员摘的号计数通常为 0
    expect(
      isManuallyUnschedulable({ tempUnschedulable: true, refreshFailureCount: 0, extraMetadata: {} }),
    ).toBe(true)
    expect(isManuallyUnschedulable({ tempUnschedulable: true, refreshFailureCount: 2 })).toBe(true)
  })

  it('③ 自动摘除:来源 auto,或历史行计数已达阈值;未摘除的号两种都不算', () => {
    expect(
      isManuallyUnschedulable({
        tempUnschedulable: true,
        refreshFailureCount: 3,
        extraMetadata: { [UNSCHEDULABLE_SOURCE_KEY]: 'auto' },
      }),
    ).toBe(false)
    expect(isManuallyUnschedulable({ tempUnschedulable: true, refreshFailureCount: 3 })).toBe(false)
    expect(
      isManuallyUnschedulable({
        tempUnschedulable: false,
        refreshFailureCount: 0,
        extraMetadata: { [UNSCHEDULABLE_SOURCE_KEY]: 'manual' },
      }),
    ).toBe(false)
  })
})

describe('巡检换票成功:只清理自动摘除', () => {
  it('④ 自动摘除的号被换票成功恢复(tempUnschedulable → false)', async () => {
    accountRows = [
      poolRow({
        refreshFailureCount: 3,
        extraMetadata: { [UNSCHEDULABLE_SOURCE_KEY]: 'auto' },
      }),
    ]
    await sweepAccountPool()
    expect(refreshTokenCalls).toBeGreaterThan(0)
    const cleared = refreshWrites().filter((s) => s.tempUnschedulable === false)
    expect(cleared.length).toBeGreaterThan(0)
  })

  it('⑤ 人工摘除的号即使换票成功也保持摘除态(不得自动撤销止血)', async () => {
    accountRows = [
      poolRow({
        refreshFailureCount: 0,
        extraMetadata: { [UNSCHEDULABLE_SOURCE_KEY]: 'manual' },
      }),
    ]
    await sweepAccountPool()
    // 桩不筛 WHERE ⇒ 换票确实发生过,证明「保留」来自撤旗闸门而不是「没走到」
    expect(refreshTokenCalls).toBeGreaterThan(0)
    expect(refreshWrites().some((s) => s.tempUnschedulable === false)).toBe(false)
    expect(refreshWrites().every((s) => !('tempUnschedulable' in s))).toBe(true)
  })

  it('⑥ 历史人工摘除行(无标记、计数未达阈值)同样不被撤旗', async () => {
    accountRows = [poolRow({ refreshFailureCount: 0, extraMetadata: {} })]
    await sweepAccountPool()
    expect(refreshTokenCalls).toBeGreaterThan(0)
    expect(refreshWrites().some((s) => s.tempUnschedulable === false)).toBe(false)
  })
})

describe('候选面 SQL 必须区分来源', () => {
  it('⑦ down 恢复档排除 manual,但形状不退回「看 temp 列」', () => {
    const { sql } = render(downRecoveryWhere())
    expect(sql).toContain('unschedulablesource')
    expect(sql).toContain('distinct from')
    expect(sql).toContain("'manual'")
    expect(sql).not.toContain('temp_unschedulable')
  })

  it('⑧ 永久保活解摘档只吃自动摘除(auto)', () => {
    const { sql } = render(keepAliveReviveWhere(new Date()))
    expect(sql).toContain('unschedulablesource')
    expect(sql).toContain("'auto'")
    expect(sql).toContain('temp_unschedulable')
  })
})
