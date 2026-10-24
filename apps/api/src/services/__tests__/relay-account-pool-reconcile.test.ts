// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * O64 对账收敛器单测:plan 纯函数四象限 / 配额截断 / fetchPoolAccounts /
 * reconcileCheckinSync 端到端(db/config/crypto/logger mock;fetch 注入)。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const hoisted = vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.NODE_ENV = 'test'
  return {
    cfg: {
      AI_CALLBACK_SECRET: 'test-internal-secret' as string | undefined,
      AI_SERVICE_URL: 'http://ai-service.test:8803',
    },
    /** loadPoolSide 的返回值 */
    poolRows: [] as Array<Record<string, unknown>>,
    /** loadFullRow 的返回值 */
    fullRows: [] as Array<Record<string, unknown>>,
    updateCalls: [] as Array<{ values: Record<string, unknown> }>,
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
vi.mock('../../db/index.js', () => {
  /** awaitable + 挂 where 的链:select().from() 直接 await → poolRows;
   *  select().from().where().limit() → fullRows(as never 收敛 drizzle builder 泛型) */
  const fromChain = () => {
    const obj: Record<string, unknown> = {
      then: (res: (v: unknown) => unknown) => Promise.resolve(hoisted.poolRows).then(res),
    }
    obj.where = () => ({ limit: async () => hoisted.fullRows })
    return obj as never
  }
  return {
    db: {
      update: () => ({
        set: (values: Record<string, unknown>) => ({
          where: async () => {
            hoisted.updateCalls.push({ values })
            return []
          },
        }),
      }),
    },
    dbRead: { select: () => ({ from: fromChain }) },
  }
})
vi.mock('@ihui/database', () => ({
  aiRelayAccountPool: new Proxy(
    {},
    { get: (_t, prop) => ({ __col: typeof prop === 'string' ? prop : String(prop) }) },
  ),
}))

import {
  fetchPoolAccounts,
  planReconciliation,
  reconcileCheckinSync,
  RECONCILE_BATCH_LIMIT,
  type CheckinSideRow,
  type PoolSideRow,
} from '../relay-account-pool-reconcile.js'

// =============================================================================
// fixtures
// =============================================================================

function poolRow(over: Partial<PoolSideRow> = {}): PoolSideRow {
  return {
    id: 'pool-1',
    ownerUserId: null,
    providerCode: 'trae',
    uid: 'uid-1',
    name: '账号一',
    isEnabled: true,
    credVersion: 7,
    ...over,
  }
}

function checkinRow(over: Partial<CheckinSideRow> = {}): CheckinSideRow {
  return {
    accountId: 101,
    poolAccountId: 'pool-1',
    ownerUserId: null,
    platform: 'trae',
    identityKey: 'uid-1',
    enabled: true,
    poolCredVersion: 7,
    poolPendingCred: null,
    ...over,
  }
}

function fullRow(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'pool-1',
    ownerUserId: null,
    providerCode: 'trae',
    uid: 'uid-1',
    name: '账号一',
    isEnabled: true,
    credVersion: 7,
    tokenEnc: 'enc:tok-1',
    refreshTokenEnc: 'enc:ref-1',
    cookiesEnc: null,
    secretsEnc: null,
    proxyUrl: null,
    deviceId: null,
    machineId: null,
    tokenExpiresAt: null,
    extraMetadata: null,
    ...over,
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** 按 URL 尾段分派的 fetch mock */
function makeFetchMock(handlers: {
  accounts?: () => Response | Promise<Response>
  sync?: (body: unknown) => Response | Promise<Response>
  state?: (body: unknown) => Response | Promise<Response>
  flush?: (body: unknown) => Response | Promise<Response>
}) {
  return vi.fn(async (input: unknown, init?: { body?: unknown }) => {
    const url = String(input)
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    if (url.endsWith('/pool-accounts')) {
      return handlers.accounts ? handlers.accounts() : jsonResponse({ accounts: [] })
    }
    if (url.endsWith('/pool-sync'))
      return handlers.sync ? handlers.sync(body) : jsonResponse({ results: [] })
    if (url.endsWith('/pool-state'))
      return handlers.state
        ? handlers.state(body)
        : jsonResponse({ results: [{ found: true, accountId: 1 }] })
    if (url.endsWith('/pool-cred-flush'))
      return handlers.flush ? handlers.flush(body) : jsonResponse({ results: [] })
    throw new Error(`unexpected fetch: ${url}`)
  })
}

beforeEach(() => {
  hoisted.poolRows.length = 0
  hoisted.fullRows.length = 0
  hoisted.updateCalls.length = 0
})

// =============================================================================
// planReconciliation 纯函数:四象限 + 边界
// =============================================================================

describe('planReconciliation', () => {
  it('号池有、签到无 → push(missing)', () => {
    const plan = planReconciliation([poolRow()], [])
    expect(plan.actions).toEqual([{ kind: 'push', pool: poolRow(), reason: 'missing' }])
    expect(plan.truncated).toBe(0)
  })

  it('号池停用 + 签到无此行 → 不补推,计 skippedDisabledMissing(停用行不自动实体化)', () => {
    const plan = planReconciliation([poolRow({ isEnabled: false })], [])
    expect(plan.actions).toEqual([])
    expect(plan.skippedDisabledMissing).toBe(1)
    expect(plan.truncated).toBe(0)
  })

  it('号池停用 + 签到有引用 → 仍产 state disabled(停用态同步载体不被新分支吞)', () => {
    const plan = planReconciliation(
      [poolRow({ isEnabled: false })],
      [checkinRow({ enabled: true })],
    )
    expect(plan.actions).toEqual([
      { kind: 'state', pool: poolRow({ isEnabled: false }), state: 'disabled' },
    ])
    expect(plan.skippedDisabledMissing).toBe(0)
  })

  it('签到有、号池无 → disable(pool_deleted,带签到侧 platform/identityKey)', () => {
    const plan = planReconciliation([], [checkinRow()])
    expect(plan.actions).toEqual([
      {
        kind: 'disable',
        platform: 'trae',
        uid: 'uid-1',
        poolAccountId: 'pool-1',
        ownerUserId: null,
      },
    ])
  })

  it('双边在、号池版本更新 → push(version_behind)', () => {
    const plan = planReconciliation(
      [poolRow({ credVersion: 9 })],
      [checkinRow({ poolCredVersion: 7 })],
    )
    expect(plan.actions).toEqual([
      { kind: 'push', pool: poolRow({ credVersion: 9 }), reason: 'version_behind' },
    ])
  })

  it('poolCredVersion 为 null(缺键旧账号)视 0 → push', () => {
    const plan = planReconciliation(
      [poolRow({ credVersion: 1 })],
      [checkinRow({ poolCredVersion: null })],
    )
    expect(plan.actions).toHaveLength(1)
    expect(plan.actions[0]).toMatchObject({ kind: 'push', reason: 'version_behind' })
  })

  it('版本相等 + enabled 不一致 → state(校准方向以号池为准)', () => {
    const plan = planReconciliation(
      [poolRow({ isEnabled: false })],
      [checkinRow({ enabled: true })],
    )
    expect(plan.actions).toEqual([
      { kind: 'state', pool: poolRow({ isEnabled: false }), state: 'disabled' },
    ])
  })

  it('pending 回写且无版本落后 → flush', () => {
    const plan = planReconciliation(
      [poolRow()],
      [checkinRow({ poolPendingCred: { attempts: 2, at: '2026-10-23T00:00:00Z' } })],
    )
    expect(plan.actions).toEqual([{ kind: 'flush', accountId: 101, poolAccountId: 'pool-1' }])
  })

  it('pending 但号池版本更新 → push 优先,不 flush(push 自带 enabled 载荷)', () => {
    const plan = planReconciliation(
      [poolRow({ credVersion: 9 })],
      [checkinRow({ poolCredVersion: 7, poolPendingCred: { attempts: 1, at: null } })],
    )
    expect(plan.actions).toEqual([
      { kind: 'push', pool: poolRow({ credVersion: 9 }), reason: 'version_behind' },
    ])
  })

  it('codearts(无签到引擎)整行忽略,计 outOfScope', () => {
    const plan = planReconciliation([poolRow({ providerCode: 'codearts' })], [])
    expect(plan.actions).toEqual([])
    expect(plan.outOfScope).toBe(1)
  })

  it('签到侧无 pool_account_id 的脏数据:不动,计 orphanNoPoolId', () => {
    const plan = planReconciliation([], [checkinRow({ poolAccountId: null })])
    expect(plan.actions).toEqual([])
    expect(plan.orphanNoPoolId).toBe(1)
  })

  it('一个号池行只产出一个动作(push 内含 enabled,不与 state/flush 叠加)', () => {
    const plan = planReconciliation(
      [poolRow({ isEnabled: false, credVersion: 9 })],
      [
        checkinRow({
          enabled: true,
          poolCredVersion: 7,
          poolPendingCred: { attempts: 1, at: null },
        }),
      ],
    )
    expect(plan.actions).toHaveLength(1)
    expect(plan.actions[0]).toMatchObject({ kind: 'push' })
  })

  it('配额截断:超量 push 截到每类上限,余量计 truncated', () => {
    const rows = Array.from({ length: 60 }, (_, i) => poolRow({ id: `pool-${i}` }))
    const plan = planReconciliation(rows, [], RECONCILE_BATCH_LIMIT)
    expect(plan.actions).toHaveLength(50)
    expect(plan.truncated).toBe(10)
    expect(plan.actions.every((a) => a.kind === 'push')).toBe(true)
  })

  it('配额均分:某一类占满不饿死其它类', () => {
    const pushes = Array.from({ length: 60 }, (_, i) => poolRow({ id: `pool-${i}` }))
    const plan = planReconciliation(pushes, [checkinRow({ poolAccountId: 'ghost' })])
    const kinds = plan.actions.map((a) => a.kind)
    expect(kinds.filter((k) => k === 'push')).toHaveLength(50)
    expect(kinds.filter((k) => k === 'disable')).toHaveLength(1)
    expect(plan.truncated).toBe(10)
  })

  it('全量一致 → 零动作', () => {
    const plan = planReconciliation([poolRow()], [checkinRow()])
    expect(plan.actions).toEqual([])
    expect(plan.truncated).toBe(0)
  })
})

// =============================================================================
// fetchPoolAccounts
// =============================================================================

describe('fetchPoolAccounts', () => {
  it('GET + X-Internal-Secret 鉴权,解析 accounts 数组', async () => {
    let seenAuth = ''
    let seenMethod = ''
    const fetchMock = vi.fn(
      async (_input: unknown, init?: { body?: unknown; headers?: unknown }) => {
        seenAuth = String(
          (init?.headers as Record<string, string> | undefined)?.['X-Internal-Secret'] ?? '',
        )
        seenMethod = 'GET'
        return jsonResponse({ accounts: [checkinRow()] })
      },
    )
    const r = await fetchPoolAccounts(fetchMock as unknown as typeof fetch)
    expect(r.ok).toBe(true)
    expect(seenAuth).toBe('test-internal-secret')
    expect(seenMethod).toBe('GET')
    expect(r.accounts).toEqual([checkinRow()])
  })

  it('pending 摘要解析;缺字段按默认值容错', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        accounts: [
          {
            accountId: 5,
            poolAccountId: 'p',
            platform: 'qoder',
            identityKey: 'u',
            enabled: true,
            poolPendingCred: { attempts: 3 },
          },
          { accountId: 6, poolAccountId: 'q', enabled: false },
        ],
      }),
    ) as unknown as typeof fetch
    const r = await fetchPoolAccounts(fetchMock)
    expect(r.ok).toBe(true)
    expect(r.accounts[0]).toMatchObject({
      accountId: 5,
      poolPendingCred: { attempts: 3, at: null },
    })
    expect(r.accounts[1]).toMatchObject({
      accountId: 6,
      enabled: false,
      platform: '',
      poolCredVersion: null,
    })
  })

  it('accountId 非数字的条目跳过', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ accounts: [{ poolAccountId: 'x' }, checkinRow()] }),
    ) as unknown as typeof fetch
    const r = await fetchPoolAccounts(fetchMock)
    expect(r.accounts).toHaveLength(1)
  })

  it('HTTP 500 → ok:false', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ detail: 'boom' }, 500),
    ) as unknown as typeof fetch
    const r = await fetchPoolAccounts(fetchMock)
    expect(r.ok).toBe(false)
    expect(r.error).toContain('500')
    expect(r.accounts).toEqual([])
  })

  it('accounts 非数组 → ok:false', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ accounts: 'nope' }),
    ) as unknown as typeof fetch
    const r = await fetchPoolAccounts(fetchMock)
    expect(r.ok).toBe(false)
    expect(r.error).toContain('accounts')
  })

  it('密钥未配置 → ok:false 不发请求', async () => {
    hoisted.cfg.AI_CALLBACK_SECRET = undefined
    const fetchMock = vi.fn() as unknown as typeof fetch
    const r = await fetchPoolAccounts(fetchMock)
    expect(r.ok).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
    hoisted.cfg.AI_CALLBACK_SECRET = 'test-internal-secret'
  })
})

// =============================================================================
// reconcileCheckinSync 端到端
// =============================================================================

describe('reconcileCheckinSync', () => {
  it('签到侧拉取失败 → 整体跳过,号池侧零动作', async () => {
    hoisted.poolRows.push(fullRow())
    const fetchMock = makeFetchMock({
      accounts: () => jsonResponse({ detail: 'boom' }, 500),
    })
    const r = await reconcileCheckinSync({ fetchImpl: fetchMock })
    expect(r.ok).toBe(false)
    expect(r.error).toContain('500')
    expect(r.pushed).toBe(0)
    expect(hoisted.updateCalls).toHaveLength(0)
  })

  it('missing 补推:按 platform 分组推送,成功清 pending', async () => {
    hoisted.poolRows.push(fullRow())
    hoisted.fullRows.push(fullRow())
    let syncBody: unknown
    const fetchMock = makeFetchMock({
      accounts: () => jsonResponse({ accounts: [] }),
      sync: (body) => {
        syncBody = body
        return jsonResponse({ results: [{ poolAccountId: 'pool-1', status: 'synced' }] })
      },
    })
    const r = await reconcileCheckinSync({ fetchImpl: fetchMock })
    expect(r.ok).toBe(true)
    expect(r.pushed).toBe(1)
    expect(r.pushFailed).toBe(0)
    expect(syncBody).toMatchObject({
      platform: 'trae',
      accounts: [
        expect.objectContaining({
          poolAccountId: 'pool-1',
          uid: 'uid-1',
          token: 'tok-1',
          credVersion: 7,
        }),
      ],
    })
    // 清 pending 落库(lastSyncedAt)
    expect(hoisted.updateCalls).toHaveLength(1)
    const meta = hoisted.updateCalls[0]?.values.extraMetadata as { __sql: string }
    expect(meta.__sql).toContain('lastSyncedAt')
  })

  it('missing 补推失败 → 按 poolAccountId 落 cred pending', async () => {
    hoisted.poolRows.push(fullRow())
    hoisted.fullRows.push(fullRow())
    const fetchMock = makeFetchMock({
      accounts: () => jsonResponse({ accounts: [] }),
      sync: () =>
        jsonResponse({
          results: [{ poolAccountId: 'pool-1', status: 'failed', reason: '引擎炸了' }],
        }),
    })
    const r = await reconcileCheckinSync({ fetchImpl: fetchMock })
    expect(r.pushFailed).toBe(1)
    expect(r.pushed).toBe(0)
    expect(hoisted.updateCalls).toHaveLength(1)
    const meta = hoisted.updateCalls[0]?.values.extraMetadata as {
      __sql: string
      __vals: unknown[]
    }
    expect(meta.__sql).toContain('pending')
    expect(meta.__vals).toContain('cred')
  })

  it('disable:签到有号池无 → pool_deleted 推送', async () => {
    hoisted.poolRows.push(fullRow({ id: 'other' }))
    let stateBody: unknown
    const fetchMock = makeFetchMock({
      accounts: () =>
        jsonResponse({ accounts: [checkinRow({ poolAccountId: 'ghost', accountId: 999 })] }),
      state: (body) => {
        stateBody = body
        return jsonResponse({ results: [{ found: true, accountId: 999 }] })
      },
    })
    const r = await reconcileCheckinSync({ fetchImpl: fetchMock })
    expect(r.disabled).toBe(1)
    expect(r.disableFailed).toBe(0)
    expect(stateBody).toMatchObject({
      platform: 'trae',
      items: [{ uid: 'uid-1', state: 'pool_deleted' }],
    })
  })

  it('disable 推送失败 → 计数 + warn,不落 pending(号池行已不存在)', async () => {
    const fetchMock = makeFetchMock({
      accounts: () => jsonResponse({ accounts: [checkinRow({ poolAccountId: 'ghost' })] }),
      state: () => jsonResponse({ results: [{ found: false, reason: '账号不存在' }] }),
    })
    const r = await reconcileCheckinSync({ fetchImpl: fetchMock })
    expect(r.disabled).toBe(0)
    expect(r.disableFailed).toBe(1)
    expect(hoisted.updateCalls).toHaveLength(0)
  })

  it('state 校准失败 → 按 id 落 state pending', async () => {
    hoisted.poolRows.push(fullRow({ isEnabled: false }))
    hoisted.fullRows.push(fullRow({ isEnabled: false }))
    const fetchMock = makeFetchMock({
      accounts: () => jsonResponse({ accounts: [checkinRow({ enabled: true })] }),
      state: () => jsonResponse({ results: [{ found: false }] }),
    })
    const r = await reconcileCheckinSync({ fetchImpl: fetchMock })
    expect(r.stateFailed).toBe(1)
    expect(r.stateCalibrated).toBe(0)
    const meta = hoisted.updateCalls[0]?.values.extraMetadata as {
      __sql: string
      __vals: unknown[]
    }
    expect(meta.__sql).toContain('pending')
    expect(meta.__vals).toContain('state')
  })

  it('flush:批量触发签到侧重试回写', async () => {
    hoisted.poolRows.push(fullRow())
    let flushBody: unknown
    const fetchMock = makeFetchMock({
      accounts: () =>
        jsonResponse({ accounts: [checkinRow({ poolPendingCred: { attempts: 1, at: null } })] }),
      flush: (body) => {
        flushBody = body
        return jsonResponse({ results: [{ status: 'flushed' }, { status: 'noop' }] })
      },
    })
    const r = await reconcileCheckinSync({ fetchImpl: fetchMock })
    expect(r.flushed).toBe(1)
    expect(r.flushFailed).toBe(1)
    expect(flushBody).toMatchObject({ accountIds: [101] })
  })

  it('flush 请求失败 → 全批计 failed', async () => {
    hoisted.poolRows.push(fullRow())
    const fetchMock = makeFetchMock({
      accounts: () =>
        jsonResponse({ accounts: [checkinRow({ poolPendingCred: { attempts: 1, at: null } })] }),
      flush: () => jsonResponse({ detail: 'boom' }, 500),
    })
    const r = await reconcileCheckinSync({ fetchImpl: fetchMock })
    expect(r.flushed).toBe(0)
    expect(r.flushFailed).toBe(1)
  })

  it('全量一致 → 零动作零写入', async () => {
    hoisted.poolRows.push(fullRow())
    const fetchMock = makeFetchMock({ accounts: () => jsonResponse({ accounts: [checkinRow()] }) })
    const r = await reconcileCheckinSync({ fetchImpl: fetchMock })
    expect(r).toMatchObject({ ok: true, pushed: 0, disabled: 0, stateCalibrated: 0, flushed: 0 })
    expect(hoisted.updateCalls).toHaveLength(0)
  })
})
