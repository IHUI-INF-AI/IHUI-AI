// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 号池凭证到期字段 × 上游接受态(2026-10-23 立)。
 *
 * 立因(dev 库现读):trae 号 token_expires_at 记未来时刻而上游余额端点当场 401 code 1001,
 * 两枚 qoder 号同样记为未过期而 quota 端点 401 TOKEN_INVALID ⇒ 该列不能单独当「票仍可用」。
 * 本用例锁三条闭环:
 * 1. 换票成功 → 上游 expires_at(ISO)按同一单位写入 tokenExpiresAt;
 * 2. 上游明确 401 拒收 → tokenExpiresAt 收敛到 now,且与健康降级同一次写;
 * 3. 5xx 未判定 → 不碰 tokenExpiresAt(不凭猜测把网络故障当凭证失效)。
 *
 * 零真实 DB/Redis:db 链式打桩只捕获 set() 入参;上游响应用 fetchImpl 注入。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.NODE_ENV = 'test'
})

const updateCalls: Array<Record<string, unknown>> = []
let accountRows: unknown[] = []
// 写链默认返回空(= CAS 未命中,既有用例的语义);需要「回写真落定」的用例按例置非空。
let writeResult: unknown[] = []

vi.mock('../../db/index.js', () => {
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
    return withSettlers(step, () => writeResult)
  }
  return {
    db: { select: chainSelect, update: chainWrite, insert: chainWrite, delete: chainWrite },
    dbRead: { select: chainSelect },
  }
})

vi.mock('../../utils/crypto.js', () => ({
  encryptField: (v: string) => `enc:${v}`,
  decryptField: (v: string) => (v.startsWith('enc:') ? v.slice(4) : v),
}))

// shared-state 走内存兜底(锁不碰真实 Redis)
vi.mock('../../config/index.js', () => ({
  config: { REDIS_URL: 'redis://127.0.0.1:1/0' },
  // config 出口新增的守卫开关:被测模块会 import 它,漏在 mock 外会让整个文件收集期就失败
  // (vitest 报 No "isProductionGuard" export is defined on the mock —— 测试静默不跑)。
  isProductionGuard: false,
}))

const mockPurgeAccountUsage = vi.hoisted(() => vi.fn().mockResolvedValue(0))
vi.mock('../relay-account-usage.js', () => ({
  purgeAccountUsage: mockPurgeAccountUsage,
}))

import {
  __test__ as schedulerTest,
  refreshOne,
  sweepAccountPool,
} from '../relay-account-pool-scheduler.js'
import { __test__ as sharedState } from '../relay-account-shared-state.js'
import { registerRelayAdapter } from '../relay-upstream-adapters.js'
import { qoderAdapter } from '../upstream-adapters/qoder-adapter.js'

const UPSTREAM_EXPIRES_AT = '2026-12-01T00:00:00.000Z'

function poolRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'acct-expiry',
    ownerUserId: null,
    providerCode: 'qoder',
    uid: 'uid-expiry',
    name: '到期口径号',
    tokenEnc: 'enc:dt-old',
    refreshTokenEnc: 'enc:drt-old',
    cookiesEnc: null,
    secretsEnc: null,
    tokenExpiresAt: new Date('2026-12-31T00:00:00Z'),
    refreshExpiresAt: null,
    deviceId: null,
    machineId: null,
    proxyUrl: null,
    extraMetadata: null,
    isEnabled: true,
    tempUnschedulable: false,
    healthStatus: 'unknown',
    healthCheckedAt: null,
    refreshFailureCount: 0,
    consecutiveFailures: 0,
    lastErrorMessage: null,
    priority: 0,
    weight: 1,
    lastUsedAt: null,
    lastRefreshAt: null,
    ...overrides,
  } as never
}

function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function registerQoder(overrides: Record<string, unknown>): void {
  registerRelayAdapter({
    providerCode: 'qoder',
    buildChatRequest: () => {
      throw new Error('本用例不跑 chat')
    },
    translateStreamChunk: () => null,
    translateNonStream: (_c: unknown, body: unknown) => (body ?? {}) as Record<string, unknown>,
    isAuthFailure: qoderAdapter.isAuthFailure,
    ...overrides,
  } as never)
}

beforeEach(async () => {
  updateCalls.length = 0
  accountRows = []
  writeResult = []
  mockPurgeAccountUsage.mockClear()
  schedulerTest.resetUsagePurgeThrottle()
  await sharedState.reset()
})

describe('号池到期列与上游接受态同口径', () => {
  it('换票成功:上游 expires_at 写入 tokenExpiresAt', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, {
        device_token: 'dt-new',
        refresh_token: 'drt-new',
        expires_at: UPSTREAM_EXPIRES_AT,
      }),
    )

    // 1) 适配器按上游响应解析(Iso → Date),证明单位与列语义一致
    const parsed = await qoderAdapter.refreshToken!(
      {
        row: poolRow(),
        credentials: { token: 'dt-old', refreshToken: 'drt-old', cookies: [], secrets: {} },
      },
      { fetchImpl: fetchImpl as unknown as typeof fetch },
    )
    expect(parsed?.expiresAt?.toISOString()).toBe(UPSTREAM_EXPIRES_AT)

    // 2) 调度刷新回写同一时刻
    registerQoder({
      refreshToken: (ctx: unknown, opts: unknown) =>
        qoderAdapter.refreshToken!(
          ctx as never,
          {
            ...(opts as Record<string, unknown>),
            fetchImpl: fetchImpl as unknown as typeof fetch,
          } as never,
        ),
    })
    expect(await refreshOne(poolRow())).toBe(true)

    const write = updateCalls.find((s) => 'tokenExpiresAt' in s)
    expect(write).toBeTruthy()
    expect((write!.tokenExpiresAt as Date).toISOString()).toBe(UPSTREAM_EXPIRES_AT)
    expect(write!.lastRefreshAt).toBeInstanceOf(Date)
  })

  it('上游 401 明确拒收:tokenExpiresAt 收敛到当下,并与健康降级同一次写', async () => {
    const before = Date.now()
    registerQoder({
      checkHealth: (ctx: unknown) =>
        qoderAdapter.checkHealth!(ctx as never, {
          fetchImpl: (async () =>
            jsonResponse(401, { code: 'TOKEN_INVALID', message: 'token expired' })) as never,
        }),
    })
    accountRows = [poolRow()]

    const out = await sweepAccountPool()
    expect(out.healthChecked).toBe(1)

    const write = updateCalls.find((s) => 'healthStatus' in s)
    expect(write).toBeTruthy()
    expect(write!.healthStatus).toBe('down')
    const converged = write!.tokenExpiresAt as Date
    expect(converged).toBeInstanceOf(Date)
    expect(converged.getTime()).toBeGreaterThanOrEqual(before - 1_000)
    expect(converged.getTime()).toBeLessThanOrEqual(Date.now() + 1_000)
  })

  it('上游 5xx 未判定:只保留 unknown,不得收敛 tokenExpiresAt', async () => {
    registerQoder({
      checkHealth: (ctx: unknown) =>
        qoderAdapter.checkHealth!(ctx as never, {
          fetchImpl: (async () => jsonResponse(503, { message: 'upstream unavailable' })) as never,
        }),
    })
    accountRows = [poolRow()]

    const out = await sweepAccountPool()
    expect(out.healthChecked).toBe(1)

    const write = updateCalls.find((s) => 'healthStatus' in s)
    expect(write).toBeTruthy()
    expect(write!.healthStatus).toBe('unknown')
    expect('tokenExpiresAt' in write!).toBe(false)
  })
})

describe('换票回写 → 跨端同步脏标记(2026-11-12 接线)', () => {
  it('回写真落定后打脏标记:巡检换票也必须在 2 分钟内进另一端(rt 轮换型不同步 = 对端续期必死)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ihui-pool-dirty-'))
    const file = join(dir, 'dirty')
    const prev = process.env['IHUI_POOL_SYNC_DIRTY_FILE']
    process.env['IHUI_POOL_SYNC_DIRTY_FILE'] = file
    writeResult = [{ id: 'acct-codearts' }] // CAS 命中 = 本次回写真落定
    try {
      registerRelayAdapter({
        providerCode: 'codearts', // 非镜像平台:避开刷后 push 客户端的副作用,只验打点
        buildChatRequest: () => {
          throw new Error('本用例不跑 chat')
        },
        translateStreamChunk: () => null,
        translateNonStream: (_c: unknown, body: unknown) => (body ?? {}) as Record<string, unknown>,
        isAuthFailure: () => false,
        refreshToken: async () => ({
          token: 't-new',
          refreshToken: 'r-new',
          expiresAt: new Date(UPSTREAM_EXPIRES_AT),
        }),
      } as never)

      expect(await refreshOne(poolRow({ providerCode: 'codearts' }))).toBe(true)

      const stamped = readFileSync(file, 'utf8')
      expect(Number.isNaN(new Date(stamped).getTime())).toBe(false)
    } finally {
      writeResult = []
      if (prev === undefined) delete process.env['IHUI_POOL_SYNC_DIRTY_FILE']
      else process.env['IHUI_POOL_SYNC_DIRTY_FILE'] = prev
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
