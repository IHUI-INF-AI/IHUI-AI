// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 周期对账腿单测(2026-11-09 立):身份键比对 / 不一致补推 / 失败落 pending /
 * 单轮上限 / 跨平台不互命中。db/config/crypto/logger 全 mock;push 与 pending
 * 全部经 io 注入 —— 零真实网络、零真实 DB。
 *
 * 注:任务书给的路径 `relay-account-pool-reconcile.test.ts` 已被既有的
 * `relay-account-pool-reconcile.ts` 收敛器测试占用,故本腿(不同模块)另起文件名,
 * 避免覆盖既有用例。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  planCheckinEnabledReconcile,
  reconcileCheckinEnabledState,
  checkinReconcileIntervalMs,
  CHECKIN_RECONCILE_DEFAULT_INTERVAL_MINUTES,
  CHECKIN_RECONCILE_MAX_PER_ROUND,
  type CheckinReconcilePeer,
  type CheckinReconcilePoolRow,
} from '../relay-account-pool-checkin-sync.js'

const hoisted = vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.NODE_ENV = 'test'
  return {
    cfg: {
      AI_CALLBACK_SECRET: 'test-internal-secret' as string | undefined,
      AI_SERVICE_URL: 'http://ai-service.test:8803',
    },
  }
})

vi.mock('../../config/index.js', () => ({ config: hoisted.cfg }))
vi.mock('../../utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('../../utils/crypto.js', () => ({
  encryptField: (v: string) => `enc:${v}`,
  decryptField: (v: string) => {
    if (typeof v !== 'string') throw new Error('decryptField: 非字符串输入')
    return v.replace(/^enc:/, '')
  },
}))
vi.mock('drizzle-orm', () => ({
  sql: (strings: TemplateStringsArray, ...vals: unknown[]) => ({
    __sql: strings.join('?'),
    __vals: vals,
  }),
  inArray: (_col: unknown, vals: unknown[]) => ({ __in: vals }),
  eq: (_col: unknown, val: unknown) => ({ __eq: val }),
}))
vi.mock('../../db/index.js', () => ({
  db: { update: vi.fn() },
  dbRead: { select: vi.fn() },
}))
vi.mock('@ihui/database', () => ({
  aiRelayAccountPool: new Proxy(
    {},
    { get: (_t, prop) => ({ __col: typeof prop === 'string' ? prop : String(prop) }) },
  ),
}))

function poolRow(over: Partial<CheckinReconcilePoolRow> = {}): CheckinReconcilePoolRow {
  return {
    id: 'pool-1',
    ownerUserId: null,
    providerCode: 'workbuddy',
    uid: 'uid-1',
    name: 'wb-1',
    isEnabled: true,
    credVersion: 2,
    extraMetadata: null,
    ...over,
  }
}

function peer(over: Partial<CheckinReconcilePeer> = {}): CheckinReconcilePeer {
  return {
    platform: 'workbuddy',
    identityKey: 'uid-1',
    enabled: true,
    poolCredVersion: 2,
    poolAccountId: 'pool-1',
    ...over,
  }
}

function ioWith(over: Record<string, unknown> = {}) {
  return {
    pushState: vi.fn(async (..._args: unknown[]) => ({ ok: true, error: null })),
    pushSync: vi.fn(async (..._args: unknown[]) => ({
      ok: true,
      pushed: 1,
      skipped: 0,
      failed: 0,
      failedIds: [],
      error: null,
    })),
    markPending: vi.fn(async (..._args: unknown[]) => undefined),
    loadSyncAccount: vi.fn(async () => null),
    ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('planCheckinEnabledReconcile', () => {
  it('两侧一致 ⇒ 零动作(零出站)', () => {
    const plan = planCheckinEnabledReconcile([poolRow()], [peer()])
    expect(plan.actions).toHaveLength(0)
    expect(plan.consistent).toBe(1)
    expect(plan.truncated).toBe(0)
  })

  it('号池 enabled=true 而签到 enabled=false ⇒ 一个 state 动作', () => {
    const plan = planCheckinEnabledReconcile([poolRow()], [peer({ enabled: false })])
    expect(plan.actions).toHaveLength(1)
    expect(plan.actions[0]).toMatchObject({ kind: 'state', state: 'enabled' })
  })

  it('cred_version 落后 ⇒ 一个 cred 动作(不改版本本身)', () => {
    const plan = planCheckinEnabledReconcile(
      [poolRow({ credVersion: 5 })],
      [peer({ poolCredVersion: 3 })],
    )
    expect(plan.actions).toHaveLength(1)
    expect(plan.actions[0]?.kind).toBe('cred')
  })

  it('同一身份键不同 platform 不互相命中(跨平台同名是正常形态)', () => {
    const plan = planCheckinEnabledReconcile(
      [poolRow({ uid: '13800000000' })],
      [peer({ platform: 'trae', identityKey: '13800000000', enabled: false })],
    )
    expect(plan.actions).toHaveLength(0)
    expect(plan.unmatched).toBe(1)
  })

  it('超过单轮上限 ⇒ 只保留前 N 个动作,余量记 truncated', () => {
    const pool = [
      poolRow({ id: 'a', uid: 'u-a' }),
      poolRow({ id: 'b', uid: 'u-b' }),
      poolRow({ id: 'c', uid: 'u-c' }),
    ]
    const checkin = [
      peer({ identityKey: 'u-a', enabled: false }),
      peer({ identityKey: 'u-b', enabled: false }),
      peer({ identityKey: 'u-c', enabled: false }),
    ]
    const plan = planCheckinEnabledReconcile(pool, checkin, 2)
    expect(plan.actions).toHaveLength(2)
    expect(plan.truncated).toBe(1)
  })
})

describe('reconcileCheckinEnabledState', () => {
  it('一致的行不发任何请求', async () => {
    const io = ioWith()
    const out = await reconcileCheckinEnabledState({
      poolRows: [poolRow()],
      checkinRows: [peer()],
      io,
    })
    expect(io.pushState).not.toHaveBeenCalled()
    expect(io.pushSync).not.toHaveBeenCalled()
    expect(out.statePushed).toBe(0)
    expect(out.consistent).toBe(1)
  })

  it('enabled 不一致 ⇒ 补推一次 state=enabled', async () => {
    const io = ioWith()
    const out = await reconcileCheckinEnabledState({
      poolRows: [poolRow()],
      checkinRows: [peer({ enabled: false })],
      io,
    })
    expect(io.pushState).toHaveBeenCalledTimes(1)
    expect(io.pushState.mock.calls[0]?.[0]).toBe('workbuddy')
    expect(io.pushState.mock.calls[0]?.[2]).toBe('enabled')
    expect(out.statePushed).toBe(1)
    expect(io.markPending).not.toHaveBeenCalled()
  })

  it('补推抛错 ⇒ 落 pending 且不向上抛', async () => {
    const io = ioWith({
      pushState: vi.fn(async () => {
        throw new Error('boom')
      }),
    })
    const out = await reconcileCheckinEnabledState({
      poolRows: [poolRow()],
      checkinRows: [peer({ enabled: false })],
      io,
    })
    expect(out.stateFailed).toBe(1)
    expect(io.markPending).toHaveBeenCalledTimes(1)
    expect(io.markPending.mock.calls[0]?.[0]).toEqual(['pool-1'])
    expect(io.markPending.mock.calls[0]?.[1]).toBe('state')
  })

  it('超过单轮上限 ⇒ 只处理前 N 个(断言调用次数)', async () => {
    const pool = Array.from({ length: 4 }, (_, i) => poolRow({ id: `p${i}`, uid: `u${i}` }))
    const checkin = Array.from({ length: 4 }, (_, i) =>
      peer({ identityKey: `u${i}`, enabled: false }),
    )
    const io = ioWith()
    const out = await reconcileCheckinEnabledState({
      poolRows: pool,
      checkinRows: checkin,
      limit: 2,
      io,
    })
    expect(io.pushState).toHaveBeenCalledTimes(2)
    expect(out.statePushed).toBe(2)
    expect(out.truncated).toBe(2)
  })

  it('签到侧无同身份键 ⇒ 不补推(缺行归 push 腿)', async () => {
    const io = ioWith()
    const out = await reconcileCheckinEnabledState({
      poolRows: [poolRow({ providerCode: 'codearts' })],
      checkinRows: [peer()],
      io,
    })
    expect(io.pushState).not.toHaveBeenCalled()
    expect(out.outOfScope).toBe(1)
  })
})

describe('checkinReconcileIntervalMs', () => {
  it('缺省 6 小时,0/off 可关闭,非法值回落缺省', () => {
    expect(checkinReconcileIntervalMs({})).toBe(CHECKIN_RECONCILE_DEFAULT_INTERVAL_MINUTES * 60_000)
    expect(checkinReconcileIntervalMs({ RELAY_CHECKIN_STATE_RECONCILE_MINUTES: '0' })).toBeNull()
    expect(checkinReconcileIntervalMs({ RELAY_CHECKIN_STATE_RECONCILE_MINUTES: 'off' })).toBeNull()
    expect(checkinReconcileIntervalMs({ RELAY_CHECKIN_STATE_RECONCILE_MINUTES: 'abc' })).toBe(
      CHECKIN_RECONCILE_DEFAULT_INTERVAL_MINUTES * 60_000,
    )
    expect(checkinReconcileIntervalMs({ RELAY_CHECKIN_STATE_RECONCILE_MINUTES: '30' })).toBe(
      30 * 60_000,
    )
  })

  it('单轮上限是有限的小常量', () => {
    expect(CHECKIN_RECONCILE_MAX_PER_ROUND).toBeGreaterThan(0)
    expect(CHECKIN_RECONCILE_MAX_PER_ROUND).toBeLessThanOrEqual(50)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
