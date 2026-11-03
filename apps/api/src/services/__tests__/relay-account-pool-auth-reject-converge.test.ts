// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票面复验(2026-10-24):「到期列」与「上游接受态」不得背离,判据只许一份。
 *
 * 立因(dev 库现读):trae 号 token_expires_at 记未来时刻而上游余额端点当场 401 code 1001;
 * 两枚 qoder 号同为「未过期」而 quota 端点回 401 TOKEN_INVALID。库里的到期列是弱证据,
 * 上游**当场明确拒收**时必须在同一次写里:①到期列收敛到当下;②健康降级 down。
 *
 * 本文件只锁已有实现的两处接缝(不重复测换票解析):
 * 1. markAccountAuthRejected(管理面按需查余额的拒收落点)一次写同时收敛到期列 + 降级;
 * 2. 换票成功按上游给的 expiresAt 写库(假时钟/夹具,零真实 DB/Redis);
 * 3. 调度与巡检共用 accountSchedulableCondition / healthStatusOf(禁第二份判据)。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PgDialect } from 'drizzle-orm/pg-core'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.NODE_ENV = 'test'
})

const updateSets: Array<Record<string, unknown>> = []

vi.mock('../../db/index.js', () => {
  const withSettlers = (step: Record<string, unknown>, resolver: () => unknown[]) => {
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(resolver()).then(resolve, reject)
    step.catch = (reject?: (e: unknown) => void) => Promise.resolve(resolver()).catch(reject)
    step.finally = (fn?: () => void) => Promise.resolve(resolver()).finally(fn)
    return step
  }
  const chainWrite = () => {
    const step: Record<string, unknown> = {}
    for (const m of ['from', 'where', 'returning', 'values']) step[m] = vi.fn(() => step)
    step.set = vi.fn((arg?: unknown) => {
      if (arg && typeof arg === 'object') updateSets.push(arg as Record<string, unknown>)
      return step
    })
    return withSettlers(step, () => [])
  }
  return {
    db: { update: chainWrite, insert: chainWrite, delete: chainWrite },
    dbRead: { select: chainWrite },
  }
})

vi.mock('../../utils/crypto.js', () => ({
  encryptField: (v: string) => `enc:${v}`,
  decryptField: (v: string) => (v.startsWith('enc:') ? v.slice(4) : v),
}))

vi.mock('../../config/index.js', () => ({
  config: { REDIS_URL: 'redis://127.0.0.1:1/0' },
}))

vi.mock('../relay-account-usage.js', () => ({
  purgeAccountUsage: vi.fn().mockResolvedValue(0),
}))

import {
  accountHealthyCondition,
  accountSchedulableCondition,
  healthStatusOf,
  markAccountAuthRejected,
  refreshOne,
} from '../relay-account-pool-scheduler.js'
import {
  ACCOUNT_SCHEDULABLE_HEALTH_STATES,
  isRelayAccountRowSchedulable,
} from '../relay-pool-stats-service.js'
import { registerRelayAdapter } from '../relay-upstream-adapters.js'

const UPSTREAM_EXPIRES_AT = '2026-11-15T08:00:00.000Z'
const FROZEN_NOW = new Date('2026-10-24T07:00:00.000Z')

function poolRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'acct-auth-reject',
    ownerUserId: null,
    providerCode: 'qoder',
    uid: 'uid-auth-reject',
    name: '拒收口径号',
    tokenEnc: 'enc:tok-old',
    refreshTokenEnc: 'enc:rt-old',
    cookiesEnc: null,
    secretsEnc: null,
    tokenExpiresAt: new Date('2026-12-31T00:00:00.000Z'),
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

beforeEach(() => {
  updateSets.length = 0
})

describe('上游明确拒收 ⇒ 到期列收敛 + 健康降级(同一次写)', () => {
  it('markAccountAuthRejected:单次写把 tokenExpiresAt/healthStatus/healthCheckedAt 一起收敛', async () => {
    await markAccountAuthRejected('acct-auth-reject', 'HTTP 401 code 1001', FROZEN_NOW)

    expect(updateSets).toHaveLength(1)
    const set = updateSets[0]!
    expect(set.tokenExpiresAt).toEqual(FROZEN_NOW)
    expect(set.healthStatus).toBe('down')
    expect(set.healthCheckedAt).toEqual(FROZEN_NOW)
    expect(set.updatedAt).toEqual(FROZEN_NOW)
    expect(String(set.lastErrorMessage)).toContain('1001')
    // 旧未来时刻必须被覆盖,不允许与拒收态并存
    expect((set.tokenExpiresAt as Date).getTime()).toBeLessThan(
      new Date('2026-12-31T00:00:00.000Z').getTime(),
    )
  })

  it('5xx 未判定 → healthStatusOf 保留 unknown(取不到 ≠ 失效)', () => {
    expect(healthStatusOf({ ok: false, indeterminate: true })).toBe('unknown')
    expect(healthStatusOf({ ok: false })).toBe('down')
    expect(healthStatusOf({ ok: true })).toBe('healthy')
  })
})

describe('换票成功 ⇒ 按上游 expiresAt 写库', () => {
  it('refreshOne 写入上游真实到期时刻,不写 now+N 小时兜底', async () => {
    registerRelayAdapter({
      providerCode: 'qoder',
      refreshToken: async () => ({
        token: 'tok-new',
        refreshToken: 'rt-new',
        expiresAt: new Date(UPSTREAM_EXPIRES_AT),
      }),
      buildChatRequest: () => {
        throw new Error('本用例不跑 chat')
      },
      translateStreamChunk: () => null,
      translateNonStream: (_c: unknown, body: unknown) => (body ?? {}) as Record<string, unknown>,
      isAuthFailure: () => false,
    } as never)

    expect(await refreshOne(poolRow())).toBe(true)

    const write = updateSets.find((s) => 'tokenExpiresAt' in s)
    expect(write).toBeTruthy()
    expect((write!.tokenExpiresAt as Date).toISOString()).toBe(UPSTREAM_EXPIRES_AT)
    expect(write!.refreshFailureCount).toBe(0)
    expect(write!.lastErrorMessage).toBeNull()
  })
})

describe('巡检与调度同一判据(单源)', () => {
  const render = (sql: unknown) => {
    const q = new PgDialect().sqlToQuery(sql as never)
    return { text: q.sql.toLowerCase(), params: (q.params as unknown[]).map(String) }
  }

  it('accountSchedulableCondition 排除 healthStatus=down,且仍看 isEnabled/tempUnschedulable', () => {
    const { text, params } = render(accountSchedulableCondition())
    expect(text).toContain('is_enabled')
    expect(text).toContain('temp_unschedulable')
    expect(text).toContain('health_status')
    // 白名单形态(2026-10-30):排除 down 由 ACCOUNT_SCHEDULABLE_HEALTH_STATES 表达 ——
    // 这里 import 同一个常量断言,不复制第二份词表(§0.6/§22c)。刻意不用 ne 'down':
    // 白名单对"未来新增但尚未在这里登记的健康档"是**不调度**,失效方向安全。
    expect(params).not.toContain('down')
    for (const state of ACCOUNT_SCHEDULABLE_HEALTH_STATES) expect(params).toContain(state)
  })

  it('accountSchedulableCondition 排除票已过期的号(2026-10-31:minimax 过期货仍被算可调度)', () => {
    const now = new Date('2026-10-31T03:12:00.000Z')
    const { text, params } = render(accountSchedulableCondition(now))
    // 无票面放行(cookie 型/不限期)+ 有票面必须晚于此刻 —— 两条缺一,票过期的号
    // 就会被选号选中去撞上游 401,并让大屏「可调度」分子虚高。
    expect(text).toContain('token_expires_at')
    expect(text).toContain('is null')
    expect(text).toContain('>')
    expect(params).toContain(now.toISOString())
  })

  it('accountHealthyCondition 刻意不看票面(否则过期号永远进不了刷新候选)', () => {
    const { text } = render(accountHealthyCondition())
    expect(text).toContain('is_enabled')
    expect(text).toContain('temp_unschedulable')
    expect(text).toContain('health_status')
    expect(text).not.toContain('token_expires_at')
  })

  it('调度选号引用同一函数(不另写一份「可用」判据)', () => {
    const forwarder = readFileSync(
      fileURLToPath(new URL('../relay-account-forwarder.ts', import.meta.url)),
      'utf8',
    )
    expect(forwarder).toContain('accountSchedulableCondition()')
    expect(forwarder).toContain(`from './relay-account-pool-scheduler.js'`)
  })

  it('isRelayAccountRowSchedulable 与选号同口径:宕机/摘除/票过期都不可调度', () => {
    const NOW = Date.parse('2026-10-31T03:12:00.000Z')
    const base = {
      isEnabled: true,
      tempUnschedulable: false,
      healthStatus: 'healthy' as const,
      tokenExpiresAt: new Date('2026-11-10T00:00:00.000Z'),
    }
    // 正向对照:健康 + 票未过期 = 可调度
    expect(isRelayAccountRowSchedulable(base, NOW)).toBe(true)
    // 无票面(cookie 型/不限期)放行 —— 失效只能靠上游当场拒收判 down
    expect(isRelayAccountRowSchedulable({ ...base, tokenExpiresAt: null }, NOW)).toBe(true)
    // 票已过期 = 不可调度(2026-10-31 minimax 实证:过期 70 小时仍被算进分子)
    expect(
      isRelayAccountRowSchedulable(
        { ...base, tokenExpiresAt: new Date('2026-10-28T04:59:00.000Z') },
        NOW,
      ),
    ).toBe(false)
    // 其余三档不回归
    expect(isRelayAccountRowSchedulable({ ...base, healthStatus: 'down' }, NOW)).toBe(false)
    expect(isRelayAccountRowSchedulable({ ...base, isEnabled: false }, NOW)).toBe(false)
    expect(isRelayAccountRowSchedulable({ ...base, tempUnschedulable: true }, NOW)).toBe(false)
  })

  it('告警引擎的账号容量走账号尺子(2026-10-31:此前仍用 key 尺子折账号池)', () => {
    const rules = readFileSync(
      fileURLToPath(new URL('../relay-alert-rules-service.ts', import.meta.url)),
      'utf8',
    )
    expect(rules).toContain('foldRelayAccountCapacity(accountRows)')
    // 反向牙:裸行 + key 尺子会把 down/票过期的号算成容量,归零告警永不响
    expect(rules).not.toContain('foldRelayPoolCapacity(accountRows)')
  })

  it('管理面按需查余额的拒收落点走 scheduler 单点实现', () => {
    const adminRoute = readFileSync(
      fileURLToPath(new URL('../../routes/admin/relay-account-pool.ts', import.meta.url)),
      'utf8',
    )
    expect(adminRoute).toContain('markAccountAuthRejected(')
    expect(adminRoute).toContain('outcome.authFailed')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
