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
    db: {
      update: chainWrite,
      insert: chainWrite,
      delete: chainWrite,
      execute: vi.fn(async () => []),
    },
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
  accountSchedulableCondition,
  healthStatusOf,
  markAccountAuthRejected,
  refreshOne,
} from '../relay-account-pool-scheduler.js'
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
    expect(text).toContain('<>')
    expect(params).toContain('down')
  })

  it('调度选号引用同一函数(不另写一份「可用」判据)', () => {
    const forwarder = readFileSync(
      fileURLToPath(new URL('../relay-account-forwarder.ts', import.meta.url)),
      'utf8',
    )
    expect(forwarder).toContain('accountSchedulableCondition()')
    expect(forwarder).toContain(`from './relay-account-pool-scheduler.js'`)
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
