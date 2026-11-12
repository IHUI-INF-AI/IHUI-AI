// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SDB-32:refresh token 轮换回写必须是「写入侧 CAS」,且不得回写快照旧票。
 *
 * 立因(2026-11-08 静态取证):巡检 / 本机重登 / 管理面自愈 / 转发链路可并发刷新同一号,
 * 旧实现两处都在 `refreshToken` 缺省时把**快照旧值**写回,且 `WHERE id` 没有 cred_version
 * 条件 —— 迟到的旧票会覆盖并发路径刚写入的新票,号池从此无法自刷新。
 *
 * 本文件锁两条只有真正 CAS 才成立的判据:
 * 1. 上游未回传 refreshToken 时,整笔 SET 里**不存在** refreshTokenEnc 键(不写旧票);
 * 2. 成功与失败两条写入的 WHERE 都带 cred_version;并用一个按条件执行的存根,
 *    证明「后来者按更旧的版本回放」会被拒,新票留在库里。
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
    for (const m of ['from', 'returning', 'values']) step[m] = vi.fn(() => step)
    step.set = vi.fn((arg?: unknown) => {
      if (arg && typeof arg === 'object') updateSets.push(arg as Record<string, unknown>)
      return step
    })
    // where 之后调用方会 await / .catch:必须回传 thenable 并记录条件供 CAS 断言。
    step.where = vi.fn((arg?: unknown) => {
      if (arg !== undefined) updateWheres.push(arg)
      return withSettlers(step, () => [])
    })
    return step
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
  isProductionGuard: false,
}))

vi.mock('../relay-account-usage.js', () => ({
  purgeAccountUsage: vi.fn().mockResolvedValue(0),
}))

vi.mock('../relay-proxy-pool.js', () => ({
  pickProxyForAccount: vi.fn().mockResolvedValue(null),
}))

// 客户端会话镜像单独隔离:本文件 providerCode=qoder 在镜像注册面内,refreshOne 会
// pullClientSession/pushClientSession ⇒ 真实实现 spawn scripts/client-session-mirror-bridge.mjs
// (Windows 经 run-as-user.ps1,内部 60s 上限),用例偶发超时。只换掉两个会落进程的 IO 函数:
// pull 恒「未匹配」(null ⇒ 调用方走「客户端不在位」分支),push 恒不写;其余纯函数保留真实实现。
vi.mock('../relay-client-session-mirror.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../relay-client-session-mirror.js')>()),
  pullClientSession: vi.fn(async () => null),
  pushClientSession: vi.fn(async () => false),
}))

import { refreshOne } from '../relay-account-pool-scheduler.js'
import { registerRelayAdapter } from '../relay-upstream-adapters.js'

const FUTURE = new Date(Date.now() + 7 * 24 * 3600_000)

function poolRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'acct-cas',
    ownerUserId: null,
    providerCode: 'qoder',
    uid: 'uid-cas',
    name: 'CAS 号',
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

function renderedWhere(where: unknown): { text: string; version: number } {
  const q = new PgDialect().sqlToQuery(where as never)
  const params = (q.params as unknown[]).map(String)
  expect(q.sql.toLowerCase()).toContain('cred_version')
  return { text: q.sql.toLowerCase(), version: Number(params[params.length - 1]) }
}

/** 按 WHERE 里的 cred_version 做条件执行的存根:版本不匹配 ⇒ 整笔不落库。 */
function applyIfVersionMatches(
  store: { credVersion: number; refreshTokenEnc: string },
  set: Record<string, unknown>,
  where: unknown,
): boolean {
  const { version } = renderedWhere(where)
  if (version !== store.credVersion) return false
  store.credVersion += 1
  if ('refreshTokenEnc' in set) store.refreshTokenEnc = String(set.refreshTokenEnc)
  return true
}

beforeEach(() => {
  updateSets.length = 0
  updateWheres.length = 0
})

describe('SDB-32 换票回写:只写真实返回字段 + cred_version CAS', () => {
  it('上游未回传 refreshToken ⇒ SET 中不存在 refreshTokenEnc(不回写快照旧票)', async () => {
    registerRefreshToken(async () => ({ token: 'tok-new', expiresAt: FUTURE }))

    expect(await refreshOne(poolRow({ credVersion: 7 }))).toBe(true)

    expect(updateSets).toHaveLength(1)
    const set = updateSets[0]!
    expect(set.tokenEnc).toBe('enc:tok-new')
    expect(Object.prototype.hasOwnProperty.call(set, 'refreshTokenEnc')).toBe(false)
    expect(renderedWhere(updateWheres[0]).version).toBe(7)
  })

  it('失败路径同样按 cred_version CAS 落账(不无条件覆盖)', async () => {
    registerRefreshToken(async () => {
      throw new Error('upstream 500')
    })

    expect(await refreshOne(poolRow({ credVersion: 9 }))).toBe(false)

    expect(updateSets).toHaveLength(1)
    const set = updateSets[0]!
    expect(set.refreshFailureCount).toBe(1)
    expect(Object.prototype.hasOwnProperty.call(set, 'tokenEnc')).toBe(false)
    expect(renderedWhere(updateWheres[0]).version).toBe(9)
  })

  it('两个并发写者取同一旧快照:迟到的一笔被 CAS 拒,新票不被旧票覆盖', async () => {
    let call = 0
    registerRefreshToken(async () => {
      call += 1
      return call === 1
        ? { token: 'tok-1', refreshToken: 'rt-1', expiresAt: FUTURE }
        : { token: 'tok-2', refreshToken: 'rt-2', expiresAt: FUTURE }
    })

    // 两路都在版本 3 时读快照(真正的并发场景),各自换票后先后回写。
    expect(await refreshOne(poolRow({ credVersion: 3 }))).toBe(true)
    expect(await refreshOne(poolRow({ credVersion: 3 }))).toBe(true)

    expect(updateSets).toHaveLength(2)
    const store = { credVersion: 3, refreshTokenEnc: 'enc:rt-old' }
    expect(applyIfVersionMatches(store, updateSets[0]!, updateWheres[0])).toBe(true)
    expect(store.refreshTokenEnc).toBe('enc:rt-1')
    // 第二笔按旧版本回放:被拒,库里仍是第一笔写的新票
    expect(applyIfVersionMatches(store, updateSets[1]!, updateWheres[1])).toBe(false)
    expect(store.refreshTokenEnc).toBe('enc:rt-1')
    expect(store.credVersion).toBe(4)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
