// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-653 回归锁:巡检阶段 2 的健康检查异常/落库失败不得静默,也不得虚增 healthChecked。
 *
 * 病灶(修前):`adapter.checkHealth()` 与 `db.update(...)` 包在同一 try,catch 空吞;
 * `out.healthChecked++` 又在 DB 更新之前 —— 适配器/代理/DB 故障一律无痕,面板显示
 * 「已检查 N 个」而状态从未落库,账号长期停在 unknown。
 *
 * 本文件锁三格:
 *   ① checkHealth 抛错 ⇒ healthFailed+1、healthChecked 不变,且留 warn(含账号与错误消息);
 *   ② DB 更新失败 ⇒ 同样计 healthFailed、healthChecked 不变;
 *   ③ 全部成功 ⇒ healthChecked 如实计数、healthFailed=0。
 *
 * 零真实 PG/Redis:db 链式打桩;shared-state 走内存锁兜底。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const state = vi.hoisted(() => ({
  selectRows: [] as unknown[],
  updateFails: false,
}))

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}))

vi.mock('../src/utils/logger.js', () => ({ logger: mockLogger }))

vi.mock('../src/db/index.js', () => {
  const withSettlers = (step: Record<string, unknown>, resolver: () => unknown[]) => {
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve().then(resolver).then(resolve, reject)
    step.catch = (reject?: (e: unknown) => void) => Promise.resolve().then(resolver).catch(reject)
    step.finally = (fn?: () => void) => Promise.resolve().then(resolver).finally(fn)
    return step
  }
  const chainSelect = () => {
    const step: Record<string, unknown> = {}
    for (const m of ['from', 'where', 'limit', 'offset', 'orderBy', 'groupBy']) {
      step[m] = vi.fn(() => step)
    }
    return withSettlers(step, () => state.selectRows)
  }
  const chainWrite = () => {
    const step: Record<string, unknown> = {}
    for (const m of ['from', 'where', 'returning', 'values']) {
      step[m] = vi.fn(() => step)
    }
    step.set = vi.fn(() => step)
    return withSettlers(step, () => {
      if (state.updateFails) throw new Error('db update failed')
      return [{ id: 'applied' }]
    })
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
  isProductionGuard: false,
}))

const mockPurgeAccountUsage = vi.hoisted(() => vi.fn().mockResolvedValue(0))
vi.mock('../src/services/relay-account-usage.js', () => ({
  purgeAccountUsage: mockPurgeAccountUsage,
}))

// 镜像腿会 spawn 子进程;本轮不触发刷新,只需让模块导出齐备且不落真实 IO。
vi.mock('../src/services/relay-client-session-mirror.js', () => ({
  pullClientSession: vi.fn(async () => null),
  pushClientSession: vi.fn(async () => false),
  buildPushPayload: vi.fn(() => ({})),
  shouldPushAfterRefresh: vi.fn(() => false),
  shouldAdoptClientRt: vi.fn(() => false),
}))

import {
  __test__ as schedulerTest,
  sweepAccountPool,
} from '../src/services/relay-account-pool-scheduler.js'
import { __test__ as sharedState } from '../src/services/relay-account-shared-state.js'
import { registerRelayAdapter } from '../src/services/relay-upstream-adapters.js'

function poolRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'acct-f653',
    ownerUserId: null,
    providerCode: 'trae',
    uid: 'uid-f653',
    name: 'F-653 号',
    tokenEnc: 'enc:jwt',
    refreshTokenEnc: null,
    cookiesEnc: null,
    secretsEnc: null,
    tokenExpiresAt: new Date(Date.now() + 86_400_000),
    refreshExpiresAt: null,
    deviceId: null,
    machineId: null,
    proxyUrl: null,
    extraMetadata: null,
    isEnabled: true,
    tempUnschedulable: false,
    healthStatus: 'unknown',
    healthCheckedAt: null,
    refreshFailureCount: 3, // 已达摘除阈值 ⇒ 步骤 3 down 恢复轮跳过,只留步骤 2 受测
    consecutiveFailures: 0,
    lastErrorMessage: null,
    priority: 0,
    weight: 1,
    lastUsedAt: null,
    lastRefreshAt: null,
    ...overrides,
  }
}

function registerHealth(checkHealth: (ctx: unknown, opts: unknown) => Promise<unknown>): void {
  registerRelayAdapter({
    providerCode: 'trae',
    buildChatRequest: () => ({ url: 'https://x.test', method: 'POST', headers: {}, body: {} }),
    translateStreamChunk: () => null,
    translateNonStream: (_c: unknown, body: unknown) => (body ?? {}) as Record<string, unknown>,
    checkHealth,
    isAuthFailure: (status: number) => status === 401,
  } as never)
}

function healthWarns(): Array<[unknown, unknown]> {
  return mockLogger.warn.mock.calls.filter(
    (call) => String(call[0]).includes('健康检查/落库异常') && call.length > 1,
  ) as Array<[unknown, unknown]>
}

beforeEach(async () => {
  state.selectRows = []
  state.updateFails = false
  mockLogger.info.mockClear()
  mockLogger.warn.mockClear()
  mockLogger.error.mockClear()
  mockPurgeAccountUsage.mockClear()
  schedulerTest.resetUsagePurgeThrottle()
  schedulerTest.resetCheckinReconcileThrottle()
  await sharedState.reset()
})

describe('F-653 巡检阶段 2 计数账', () => {
  it('checkHealth 抛错:healthFailed+1、healthChecked 不虚增,并留 warn(账号 + 错误消息)', async () => {
    registerHealth(async () => {
      throw new Error('proxy 502')
    })
    state.selectRows = [poolRow({ id: 'acct-f653-throw' })]

    const out = await sweepAccountPool()

    expect(out.healthFailed).toBe(1)
    expect(out.healthChecked).toBe(0)
    // 不中断整轮:后续轮次照常完成
    expect(out.skipped).toBe(false)

    const warns = healthWarns()
    expect(warns.length).toBe(1)
    const meta = warns[0]![1] as Record<string, unknown>
    expect(meta.accountId).toBe('acct-f653-throw')
    expect(meta.providerCode).toBe('trae')
    expect(String(meta.error)).toContain('proxy 502')
  })

  it('健康结论落库失败:同样计 healthFailed、healthChecked 不虚增', async () => {
    registerHealth(async () => ({ ok: true }))
    state.selectRows = [poolRow({ id: 'acct-f653-dbfail' })]
    state.updateFails = true

    const out = await sweepAccountPool()

    expect(out.healthFailed).toBe(1)
    expect(out.healthChecked).toBe(0)
    const warns = healthWarns()
    expect(warns.length).toBe(1)
    expect((warns[0]![1] as Record<string, unknown>).accountId).toBe('acct-f653-dbfail')
    expect(String((warns[0]![1] as Record<string, unknown>).error)).toContain('db update failed')
  })

  it('全部成功:healthChecked 如实计数、healthFailed=0', async () => {
    registerHealth(async () => ({ ok: true }))
    state.selectRows = [
      poolRow({ id: 'acct-f653-ok-1', uid: 'uid-ok-1' }),
      poolRow({ id: 'acct-f653-ok-2', uid: 'uid-ok-2' }),
    ]

    const out = await sweepAccountPool()

    expect(out.healthChecked).toBe(2)
    expect(out.healthFailed).toBe(0)
    expect(healthWarns().length).toBe(0)
  })
})
