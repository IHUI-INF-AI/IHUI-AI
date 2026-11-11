// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * SDB-32:换票回写 = 「只写本次真实返回的字段 + cred_version CAS」,且 CAS 未命中
 * 必须按「已被他人刷新」回读当前值,不得当成错误。
 *
 * 立因:巡检 refreshOne / 本机重登 loginTraeLocal / 管理端 401 自愈 / 转发链路
 * refreshRowInPlace 可并发刷新同一账号;refresh token 是轮换制,迟到的旧快照一旦
 * 整列回写,就会把并发路径刚写入的新票覆盖回旧票,号池从此无法自刷新。
 *
 * 本文件锁三条判据(只测可证伪的落库形状,零真实 DB/Redis):
 * ① 上游未回传 refreshToken ⇒ SET 里**不存在** refreshTokenEnc(不写快照旧票);
 * ② CAS 命中 0 行 ⇒ 不崩:巡检按成功收敛,转发链路回读库里当前值返回;
 * ③ 正常刷新 ⇒ 新票 + 递增版本一起回写,WHERE 带刷新前读到的版本。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.NODE_ENV = 'test'
})

const updateSets: Array<Record<string, unknown>> = []
const updateWheres: unknown[] = []
/** 每次 UPDATE ... RETURNING 依次弹出:[] = CAS 命中 0 行(被他人抢先) */
let updateReturnRows: Array<Array<{ id: string }>> = []
/** dbRead.select 的返回行(「已被他人刷新」时回读到的权威值) */
let selectRows: unknown[] = []

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
    return withSettlers(step, () => selectRows)
  }
  const chainWrite = () => {
    const step: Record<string, unknown> = {}
    for (const m of ['from', 'values']) step[m] = vi.fn(() => step)
    step.set = vi.fn((arg?: unknown) => {
      if (arg && typeof arg === 'object') updateSets.push(arg as Record<string, unknown>)
      return step
    })
    step.where = vi.fn((arg?: unknown) => {
      if (arg !== undefined) updateWheres.push(arg)
      return step
    })
    // returning 之后的 await/.catch 决定「CAS 是否命中」:按队列逐次弹出
    step.returning = vi.fn(() => withSettlers(step, () => updateReturnRows.shift() ?? []))
    return step
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

// shared-state 走内存兜底档(与既有 relay-account-* 测试同口径):锁不碰真实 Redis
vi.mock('../src/config/index.js', () => ({
  config: { REDIS_URL: 'redis://127.0.0.1:1/0' },
  isProductionGuard: false,
}))

vi.mock('../src/services/relay-account-usage.js', () => ({
  purgeAccountUsage: vi.fn().mockResolvedValue(0),
  recordAccountUsage: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../src/services/relay-proxy-pool.js', () => ({
  pickProxyForAccount: vi.fn().mockResolvedValue(null),
  reportProxyFailure: vi.fn().mockResolvedValue(undefined),
  reportProxySuccess: vi.fn().mockResolvedValue(undefined),
  resolveAccountProxyUrl: (stored: string | null | undefined) => stored ?? null,
  encryptAccountProxyUrl: (plain: string | null | undefined) => plain ?? null,
  maskAccountProxyUrl: (stored: string | null | undefined) => stored ?? null,
}))

vi.mock('../src/services/relay-model-catalog.js', () => ({
  resolveModelAlias: vi.fn().mockResolvedValue(null),
}))

// 镜像腿(客户端副本 pull/push)与本用例无关,桩成 no-op 防真实文件系统访问
vi.mock('../src/services/relay-client-session-mirror.js', () => ({
  pullClientSession: vi.fn().mockResolvedValue(null),
  pushClientSession: vi.fn().mockResolvedValue(undefined),
  buildPushPayload: vi.fn(() => ({})),
  shouldAdoptClientRt: vi.fn(() => false),
  shouldPushAfterRefresh: vi.fn(() => false),
}))

vi.mock('undici', () => ({
  ProxyAgent: class {
    close(): void {}
  },
  Agent: class {
    constructor(_opts?: unknown) {}
    close(): void {}
  },
  fetch: vi.fn(),
}))

vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(async () => [{ address: '203.0.113.10', family: 4 }]),
}))

import { refreshOne } from '../src/services/relay-account-pool-scheduler.js'
import { __test__ as F } from '../src/services/relay-account-forwarder.js'
import { __test__ as sharedState } from '../src/services/relay-account-shared-state.js'
import {
  getRelayAdapter,
  registerRelayAdapter,
} from '../src/services/relay-upstream-adapters.js'

const FUTURE = new Date(Date.now() + 7 * 24 * 3600_000)

function poolRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'acct-sdb32',
    ownerUserId: null,
    providerCode: 'qoder',
    uid: 'uid-sdb32',
    name: 'SDB-32 号',
    tokenEnc: 'enc:tok-old',
    refreshTokenEnc: 'enc:rt-old',
    cookiesEnc: null,
    secretsEnc: null,
    tokenExpiresAt: FUTURE,
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
    credVersion: 1,
    ...overrides,
  } as never
}

function registerRefreshToken(refreshToken: () => Promise<unknown>): void {
  registerRelayAdapter({
    providerCode: 'qoder',
    refreshToken,
    buildChatRequest: () => {
      throw new Error('本用例不跑 chat')
    },
    translateStreamChunk: () => null,
    translateNonStream: (_c: unknown, body: unknown) => (body ?? {}) as Record<string, unknown>,
    isAuthFailure: () => false,
  } as never)
}

/** 渲染 WHERE 并取出 CAS 的版本实参(末位参数 = 刷新前读到的 cred_version) */
function renderedVersion(where: unknown): number {
  const q = new PgDialect().sqlToQuery(where as never)
  expect(q.sql.toLowerCase()).toContain('cred_version')
  const params = (q.params as unknown[]).map(String)
  return Number(params[params.length - 1])
}

beforeEach(async () => {
  updateSets.length = 0
  updateWheres.length = 0
  updateReturnRows = []
  selectRows = []
  await sharedState.reset()
})

describe('SDB-32 换票回写:只写真实返回字段 + cred_version CAS + 已被他人刷新不崩', () => {
  it('① 上游未回传 refreshToken ⇒ SET 中不存在 refreshTokenEnc(旧票绝不被覆盖)', async () => {
    registerRefreshToken(async () => ({ token: 'tok-new', expiresAt: FUTURE }))
    updateReturnRows = [[{ id: 'acct-sdb32' }]]

    expect(await refreshOne(poolRow({ credVersion: 7 }))).toBe(true)

    expect(updateSets).toHaveLength(1)
    const set = updateSets[0]!
    expect(set.tokenEnc).toBe('enc:tok-new')
    expect(Object.prototype.hasOwnProperty.call(set, 'refreshTokenEnc')).toBe(false)
    expect(renderedVersion(updateWheres[0])).toBe(7)
  })

  it('② 巡检 CAS 命中 0 行(已被他人刷新)⇒ 不崩、按成功收敛,不再写失败态', async () => {
    registerRefreshToken(async () => ({ token: 'tok-late', refreshToken: 'rt-late', expiresAt: FUTURE }))
    updateReturnRows = [[]]
    selectRows = [poolRow({ credVersion: 9, refreshTokenEnc: 'enc:rt-winner' })]

    await expect(refreshOne(poolRow({ credVersion: 4 }))).resolves.toBe(true)

    // 成功分支只发了那一笔被 CAS 拒掉的写,没有补写任何旧票/失败计数
    expect(updateSets).toHaveLength(1)
    expect(updateSets[0]!.refreshFailureCount).toBe(0)
    expect(renderedVersion(updateWheres[0])).toBe(4)
  })

  it('② 转发链路 CAS 命中 0 行 ⇒ 回读库里当前值返回(不是错误/null)', async () => {
    registerRefreshToken(async () => ({ token: 'tok-late', refreshToken: 'rt-late', expiresAt: FUTURE }))
    updateReturnRows = [[]]
    selectRows = [
      poolRow({ credVersion: 12, tokenEnc: 'enc:tok-winner', refreshTokenEnc: 'enc:rt-winner' }),
    ]
    const adapter = getRelayAdapter('qoder')!

    const out = await F.refreshRowInPlace(poolRow({ credVersion: 3 }), adapter)

    expect(out).not.toBeNull()
    expect(out!.tokenEnc).toBe('enc:tok-winner')
    expect(out!.refreshTokenEnc).toBe('enc:rt-winner')
    expect(out!.credVersion).toBe(12)
    expect(updateSets).toHaveLength(1)
    expect(renderedVersion(updateWheres[0])).toBe(3)
  })

  it('③ 正常刷新 ⇒ 新票 + 版本前进一起回写,CAS 用刷新前的版本', async () => {
    registerRefreshToken(async () => ({ token: 'tok-2', refreshToken: 'rt-2', expiresAt: FUTURE }))
    updateReturnRows = [[{ id: 'acct-sdb32' }]]

    expect(await refreshOne(poolRow({ credVersion: 2 }))).toBe(true)

    expect(updateSets).toHaveLength(1)
    const set = updateSets[0]!
    expect(set.tokenEnc).toBe('enc:tok-2')
    expect(set.refreshTokenEnc).toBe('enc:rt-2')
    expect(set.refreshFailureCount).toBe(0)
    // 版本前进是 SQL 片段(cred_version + 1),不是 JS 快照值
    expect(set.credVersion).toBeTruthy()
    expect(renderedVersion(updateWheres[0])).toBe(2)
  })
})
