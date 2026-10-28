// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * O64 号池↔签到同步推送侧单测(映射 / 载荷 / HTTP 推送 / pending / 重推)。
 * db/config/crypto/logger 全 mock;fetch 经 fetchImpl 参数注入,不污染全局。
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
    updateCalls: [] as Array<{ values: Record<string, unknown> }>,
    pendingRows: [] as Array<Record<string, unknown>>,
    limitUsed: [] as number[],
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
// drizzle-orm 只用到 sql/inArray:替换为可断言的轻量结构(真实 SQL 正确性由集成环境保证)
vi.mock('drizzle-orm', () => ({
  sql: (strings: TemplateStringsArray, ...vals: unknown[]) => ({
    __sql: strings.join('?'),
    __vals: vals,
  }),
  inArray: (_col: unknown, vals: unknown[]) => ({ __in: vals }),
}))
vi.mock('../../db/index.js', () => ({
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
  dbRead: {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: async (n: number) => {
              hoisted.limitUsed.push(n)
              return hoisted.pendingRows
            },
          }),
        }),
      }),
    }),
  },
}))
vi.mock('@ihui/database', () => ({
  aiRelayAccountPool: new Proxy(
    {},
    { get: (_t, prop) => ({ __col: typeof prop === 'string' ? prop : String(prop) }) },
  ),
}))

import {
  buildPoolSyncAccount,
  checkinPlatformFor,
  clearCheckinSyncPending,
  extractCosy,
  listCheckinSyncPending,
  markCheckinSyncPending,
  parseCheckinSyncMeta,
  pushPoolState,
  fetchPoolStatus,
  postPoolRun,
  pushPoolSync,
  retryPendingCheckinSyncs,
  type PoolSyncAccount,
} from '../relay-account-pool-checkin-sync.js'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function makeAccount(over: Partial<PoolSyncAccount> = {}): PoolSyncAccount {
  return {
    poolAccountId: 'pool-1',
    ownerUserId: null,
    uid: 'uid-1',
    name: '账号一',
    token: 'tok-1',
    refreshToken: 'ref-1',
    credVersion: 7,
    enabled: true,
    proxyUrl: null,
    deviceId: null,
    machineId: null,
    cosy: null,
    expiresAt: null,
    ...over,
  }
}

/** 按 URL 尾段分派的 fetch mock(pool-sync / pool-state 各自可覆写) */
function makeFetchMock(handlers: {
  sync?: (body: unknown) => Response | Promise<Response>
  state?: (body: unknown) => Response | Promise<Response>
}) {
  return vi.fn(async (input: unknown, init?: { body?: unknown }) => {
    const url = String(input)
    const body = init?.body ? JSON.parse(String(init.body)) : {}
    if (url.endsWith('/internal/checkin/pool-sync'))
      return handlers.sync ? handlers.sync(body) : jsonResponse({ results: [] })
    if (url.endsWith('/internal/checkin/pool-state'))
      return handlers.state ? handlers.state(body) : jsonResponse({ results: [] })
    return jsonResponse({ error: 'unexpected url' }, 404)
  })
}

beforeEach(() => {
  hoisted.cfg.AI_CALLBACK_SECRET = 'test-internal-secret'
  hoisted.updateCalls.length = 0
  hoisted.pendingRows.length = 0
  hoisted.limitUsed.length = 0
})

// =============================================================================
// 平台映射(D5 单一真相源)
// =============================================================================

describe('checkinPlatformFor(平台映射单一真相源)', () => {
  it('trae/workbuddy/qoder → 同名签到平台', () => {
    expect(checkinPlatformFor('trae')).toBe('trae')
    expect(checkinPlatformFor('workbuddy')).toBe('workbuddy')
    expect(checkinPlatformFor('qoder')).toBe('qoder')
  })

  it('codearts → null(无签到引擎,映射即拦截)', () => {
    expect(checkinPlatformFor('codearts')).toBeNull()
  })

  it('未知平台(号池尚未启用的 minimax/杂串)→ null', () => {
    expect(checkinPlatformFor('minimax')).toBeNull()
    expect(checkinPlatformFor('')).toBeNull()
    expect(checkinPlatformFor('unknown-provider')).toBeNull()
  })
})

// =============================================================================
// 载荷构造 / Cosy 抽取
// =============================================================================

describe('buildPoolSyncAccount', () => {
  it('tokenExpiresAt → ISO 字符串;无效日期按 null(不抛)', () => {
    const acc = buildPoolSyncAccount({
      id: 'p1',
      ownerUserId: null,
      uid: 'u1',
      name: 'n',
      token: 't',
      refreshToken: null,
      credVersion: 3,
      enabled: false,
      proxyUrl: 'http://proxy:1080',
      deviceId: 'd1',
      machineId: 'm1',
      cosy: { machine_token: 'x' },
      tokenExpiresAt: new Date('2026-10-23T12:00:00.000Z'),
    })
    expect(acc).toEqual({
      poolAccountId: 'p1',
      ownerUserId: null,
      uid: 'u1',
      name: 'n',
      token: 't',
      refreshToken: null,
      credVersion: 3,
      enabled: false,
      proxyUrl: 'http://proxy:1080',
      deviceId: 'd1',
      machineId: 'm1',
      cosy: { machine_token: 'x' },
      expiresAt: '2026-10-23T12:00:00.000Z',
    })
    const bad = buildPoolSyncAccount({
      id: 'p2',
      ownerUserId: null,
      uid: 'u2',
      name: 'n',
      token: 't',
      refreshToken: null,
      credVersion: 1,
      enabled: true,
      proxyUrl: null,
      deviceId: null,
      machineId: null,
      cosy: null,
      tokenExpiresAt: new Date(Number.NaN),
    })
    expect(bad.expiresAt).toBeNull()
  })
})

describe('extractCosy', () => {
  it('对象形态:蛇形键原样返回,非 string 值过滤', () => {
    expect(extractCosy({ cosy: { machine_token: 'x', version: '1', bad: 2 } })).toEqual({
      machine_token: 'x',
      version: '1',
    })
  })
  it('JSON 字符串形态可解析;坏 JSON / 非对象 / 空 → null', () => {
    expect(extractCosy(JSON.stringify({ cosy: { machine_code: 'c' } }))).toEqual({
      machine_code: 'c',
    })
    expect(extractCosy('{bad json')).toBeNull()
    expect(extractCosy(undefined)).toBeNull()
    expect(extractCosy({ cosy: 'str' })).toBeNull()
    expect(extractCosy({ cosy: [] })).toBeNull()
    expect(extractCosy({ cosy: {} })).toBeNull()
  })
})

// =============================================================================
// parseCheckinSyncMeta(纯函数,坏形状容错)
// =============================================================================

describe('parseCheckinSyncMeta', () => {
  it.each([
    ['undefined', undefined],
    ['坏 JSON 字符串', '{not json'],
    ['数组', []],
    ['无 checkinSync 键', { other: 1 }],
    ['checkinSync 非对象', { checkinSync: 'str' }],
  ])('坏形状 → 无待推(%s)', (_label, input) => {
    expect(parseCheckinSyncMeta(input)).toEqual({
      pending: false,
      pendingKind: null,
      pendingAt: null,
      attempts: 0,
      state: null,
    })
  })

  it('完整 pending 态:kind/state/attempts/pendingAt 全解析', () => {
    expect(
      parseCheckinSyncMeta({
        checkinSync: {
          pending: true,
          pendingKind: 'state',
          pendingAt: '2026-10-23T00:00:00Z',
          attempts: 3,
          state: 'disabled',
        },
      }),
    ).toEqual({
      pending: true,
      pendingKind: 'state',
      pendingAt: '2026-10-23T00:00:00Z',
      attempts: 3,
      state: 'disabled',
    })
  })

  it('枚举外值/坏 attempts → 逐字段兜底(attempts 负数归零、小数 floor)', () => {
    expect(
      parseCheckinSyncMeta({
        checkinSync: { pending: true, pendingKind: 'bogus', state: 'bogus', attempts: 'x' },
      }),
    ).toEqual({ pending: true, pendingKind: null, pendingAt: null, attempts: 0, state: null })
    expect(parseCheckinSyncMeta({ checkinSync: { pending: false, attempts: -5 } })).toEqual({
      pending: false,
      pendingKind: null,
      pendingAt: null,
      attempts: 0,
      state: null,
    })
    expect(parseCheckinSyncMeta({ checkinSync: { attempts: 2.7 } }).attempts).toBe(2)
  })
})

// =============================================================================
// pushPoolSync
// =============================================================================

describe('pushPoolSync', () => {
  it('成功:URL/方法/内网头/载荷断言;pushed 统计', async () => {
    const fetchMock = makeFetchMock({
      sync: (body) => {
        expect(body).toEqual({
          platform: 'trae',
          accounts: [
            expect.objectContaining({ poolAccountId: 'pool-1', credVersion: 7 }),
            expect.objectContaining({ poolAccountId: 'pool-2', credVersion: 7 }),
          ],
        })
        return jsonResponse({
          results: [
            { poolAccountId: 'pool-1', status: 'synced', checkinAccountId: 'ca-1' },
            { poolAccountId: 'pool-2', status: 'synced', checkinAccountId: 'ca-2' },
          ],
        })
      },
    })
    const r = await pushPoolSync(
      'trae',
      [makeAccount(), makeAccount({ poolAccountId: 'pool-2' })],
      fetchMock,
    )
    expect(r).toEqual({ ok: true, pushed: 2, skipped: 0, failed: 0, failedIds: [], error: null })
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('http://ai-service.test:8803/internal/checkin/pool-sync')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>)['X-Internal-Secret']).toBe(
      'test-internal-secret',
    )
  })

  it('skipped 统计(接收侧白名单兜底语义透传)', async () => {
    const fetchMock = makeFetchMock({
      sync: () => jsonResponse({ results: [{ poolAccountId: 'pool-1', status: 'skipped' }] }),
    })
    const r = await pushPoolSync('trae', [makeAccount()], fetchMock)
    expect(r.ok).toBe(true)
    expect(r).toMatchObject({ pushed: 0, skipped: 1, failed: 0 })
  })

  it('部分失败:failedIds 反查供 pending 精确定位;ok=false', async () => {
    const fetchMock = makeFetchMock({
      sync: () =>
        jsonResponse({
          results: [
            { poolAccountId: 'pool-1', status: 'synced' },
            { poolAccountId: 'pool-2', status: 'failed', reason: 'boom' },
          ],
        }),
    })
    const r = await pushPoolSync(
      'qoder',
      [makeAccount(), makeAccount({ poolAccountId: 'pool-2' })],
      fetchMock,
    )
    expect(r.ok).toBe(false)
    expect(r.failedIds).toEqual(['pool-2'])
    expect(r.error).toContain('1 条签到同步失败')
  })

  it('响应条数不符 → ok=false(防半截响应被当成功)', async () => {
    const fetchMock = makeFetchMock({ sync: () => jsonResponse({ results: [] }) })
    const r = await pushPoolSync('trae', [makeAccount()], fetchMock)
    expect(r.ok).toBe(false)
    expect(r.error).toContain('响应条数不符')
  })

  it('HTTP 500 → ok=false 且带状态码', async () => {
    const fetchMock = makeFetchMock({ sync: () => jsonResponse({ detail: '内部错误' }, 500) })
    const r = await pushPoolSync('trae', [makeAccount()], fetchMock)
    expect(r.ok).toBe(false)
    expect(r.error).toContain('HTTP 500')
  })

  it('网络异常 → ok=false 不抛', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('ECONNREFUSED')
    })
    const r = await pushPoolSync('trae', [makeAccount()], fetchMock)
    expect(r.ok).toBe(false)
    expect(r.error).toContain('网络错误')
  })

  it('AI_CALLBACK_SECRET 未配置 → 不发请求,ok=false(不裸奔)', async () => {
    hoisted.cfg.AI_CALLBACK_SECRET = undefined
    const fetchMock = vi.fn()
    const r = await pushPoolSync('trae', [makeAccount()], fetchMock)
    expect(r.ok).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('空 accounts → 不发请求,ok=true', async () => {
    const fetchMock = vi.fn()
    const r = await pushPoolSync('trae', [], fetchMock)
    expect(r.ok).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

// =============================================================================
// pushPoolState
// =============================================================================

describe('pushPoolState', () => {
  it('成功:体断言 poolAccountId 寻址 + owner;found=true → ok', async () => {
    const fetchMock = makeFetchMock({
      state: (body) => {
        expect(body).toEqual({
          platform: 'qoder',
          items: [
            {
              poolAccountId: 'pool-1',
              ownerUserId: null,
              uid: 'uid-1',
              state: 'disabled',
            },
          ],
        })
        return jsonResponse({ results: [{ uid: 'uid-1', found: true, accountId: 'ca-1' }] })
      },
    })
    const r = await pushPoolState(
      'qoder',
      { poolAccountId: 'pool-1', ownerUserId: null, uid: 'uid-1' },
      'disabled',
      fetchMock,
    )
    expect(r).toEqual({ ok: true, error: null })
  })

  it('found=false(签到侧无此账号)→ ok=false', async () => {
    const fetchMock = makeFetchMock({
      state: () => jsonResponse({ results: [{ uid: 'uid-1', found: false }] }),
    })
    const r = await pushPoolState(
      'trae',
      { poolAccountId: 'pool-1', ownerUserId: null, uid: 'uid-1' },
      'pool_deleted',
      fetchMock,
    )
    expect(r.ok).toBe(false)
    expect(r.error).toContain('未命中')
  })

  it('HTTP 401(内网密钥错)→ ok=false', async () => {
    const fetchMock = makeFetchMock({ state: () => jsonResponse({ detail: '密钥不匹配' }, 401) })
    const r = await pushPoolState(
      'trae',
      { poolAccountId: 'pool-1', ownerUserId: null, uid: 'uid-1' },
      'enabled',
      fetchMock,
    )
    expect(r.ok).toBe(false)
    expect(r.error).toContain('HTTP 401')
  })
})

// =============================================================================
// pending 落盘 / 清除(jsonb 合并,attempts 原子 +1)
// =============================================================================

describe('markCheckinSyncPending / clearCheckinSyncPending', () => {
  it('空 ids → 不产生任何 update', async () => {
    await markCheckinSyncPending([], 'cred', null, 'x')
    await clearCheckinSyncPending([])
    expect(hoisted.updateCalls).toHaveLength(0)
  })

  it('mark cred:values 含 extraMetadata(jsonb 合并)+updatedAt;SQL 文本含 attempts+1 与 kind', async () => {
    await markCheckinSyncPending(['p1', 'p2'], 'cred', null, '网络错误: boom')
    expect(hoisted.updateCalls).toHaveLength(1)
    const { values } = hoisted.updateCalls[0]!
    expect(values.updatedAt).toBeInstanceOf(Date)
    const extra = values.extraMetadata as { __sql: string; __vals: unknown[] }
    expect(extra.__sql).toContain('jsonb_build_object')
    expect(extra.__sql).toContain("'checkinSync'")
    expect(extra.__sql).toContain('attempts')
    expect(extra.__vals).toContain('cred')
    expect(extra.__vals).toContain('网络错误: boom')
    expect(extra.__vals).toContain(null)
  })

  it('mark state:state 值进 SQL 参数', async () => {
    await markCheckinSyncPending(['p1'], 'state', 'disabled', '推送失败')
    const { values } = hoisted.updateCalls[0]!
    const extra = values.extraMetadata as { __vals: unknown[] }
    expect(extra.__vals).toContain('state')
    expect(extra.__vals).toContain('disabled')
  })

  it('clear:pending=false + lastSyncedAt,attempts 归零', async () => {
    await clearCheckinSyncPending(['p1'])
    const { values } = hoisted.updateCalls[0]!
    const extra = values.extraMetadata as { __sql: string; __vals: unknown[] }
    expect(extra.__sql).toContain('lastSyncedAt')
    // pending=false 是 SQL 字面量(非插值),断言落在模板文本
    expect(extra.__sql).toMatch(/'pending',\s*false/)
    expect(extra.__sql).toContain('attempts')
  })
})

// =============================================================================
// retryPendingCheckinSyncs(断链重推)
// =============================================================================

function pendingCredRow(over: Record<string, unknown> = {}) {
  return {
    id: 'pool-1',
    ownerUserId: null,
    providerCode: 'trae',
    uid: 'uid-1',
    name: '账号一',
    tokenEnc: 'enc:tok-1',
    refreshTokenEnc: 'enc:ref-1',
    proxyUrl: null,
    deviceId: null,
    machineId: null,
    isEnabled: true,
    credVersion: 9,
    tokenExpiresAt: null,
    extraMetadata: {
      checkinSync: { pending: true, pendingKind: 'cred', attempts: 2 },
    },
    ...over,
  }
}

describe('retryPendingCheckinSyncs', () => {
  it('cred 行重推成功 → cleared,并清 pending(lastSyncedAt)', async () => {
    hoisted.pendingRows.push(pendingCredRow())
    const fetchMock = makeFetchMock({
      sync: () => jsonResponse({ results: [{ poolAccountId: 'pool-1', status: 'synced' }] }),
    })
    const r = await retryPendingCheckinSyncs(50, fetchMock)
    expect(r).toEqual({ retried: 1, cleared: 1, stillPending: 0, droppedNoEngine: 0 })
    expect(hoisted.updateCalls).toHaveLength(1) // 仅 clear
    expect(hoisted.limitUsed).toEqual([50])
    // 解密重建载荷:明文 token 经 mock decrypt 还原后进 body
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    const body = JSON.parse(String(init.body)) as { accounts: Array<Record<string, unknown>> }
    expect(body.accounts[0]).toMatchObject({
      poolAccountId: 'pool-1',
      token: 'tok-1',
      refreshToken: 'ref-1',
      credVersion: 9,
    })
  })

  it('cred 行重推失败 → stillPending,并重标记(attempts 继续 +1)', async () => {
    hoisted.pendingRows.push(pendingCredRow())
    const fetchMock = makeFetchMock({ sync: () => jsonResponse({ detail: 'x' }, 502) })
    const r = await retryPendingCheckinSyncs(10, fetchMock)
    expect(r).toMatchObject({ retried: 1, cleared: 0, stillPending: 1 })
    expect(hoisted.updateCalls).toHaveLength(1)
    const extra = hoisted.updateCalls[0]!.values.extraMetadata as { __vals: unknown[] }
    expect(extra.__vals).toContain('cred')
  })

  it('停用行的 cred pending → 直接清腿:零 fetch、零 retried(停用不占重推位)', async () => {
    hoisted.pendingRows.push(pendingCredRow({ isEnabled: false }))
    const fetchMock = makeFetchMock({})
    const r = await retryPendingCheckinSyncs(10, fetchMock)
    expect(r).toEqual({ retried: 0, cleared: 1, stillPending: 0, droppedNoEngine: 0 })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(hoisted.updateCalls).toHaveLength(1) // 仅 clear
  })

  it('停用行的 state pending → 照常重推(停用/删除态载体绝不随停用清腿)', async () => {
    hoisted.pendingRows.push(
      pendingCredRow({
        isEnabled: false,
        extraMetadata: {
          checkinSync: { pending: true, pendingKind: 'state', state: 'disabled', attempts: 1 },
        },
      }),
    )
    const fetchMock = makeFetchMock({
      state: () => jsonResponse({ results: [{ uid: 'uid-1', found: true }] }),
    })
    const r = await retryPendingCheckinSyncs(10, fetchMock)
    expect(r).toMatchObject({ retried: 1, cleared: 1, stillPending: 0 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('state 行按 meta.state 原样重推(pool_deleted 也认)', async () => {
    hoisted.pendingRows.push(
      pendingCredRow({
        id: 'pool-2',
        providerCode: 'qoder',
        extraMetadata: {
          checkinSync: { pending: true, pendingKind: 'state', state: 'pool_deleted', attempts: 1 },
        },
      }),
    )
    let seen: unknown = null
    const fetchMock = makeFetchMock({
      state: (body) => {
        seen = body
        return jsonResponse({ results: [{ uid: 'uid-1', found: true }] })
      },
    })
    const r = await retryPendingCheckinSyncs(10, fetchMock)
    expect(r.cleared).toBe(1)
    expect(seen).toEqual({
      platform: 'qoder',
      items: [
        {
          poolAccountId: 'pool-2',
          ownerUserId: null,
          uid: 'uid-1',
          state: 'pool_deleted',
        },
      ],
    })
  })

  it('state 行 meta.state 缺失 → 按 enabled 兜底重推', async () => {
    hoisted.pendingRows.push(
      pendingCredRow({
        extraMetadata: { checkinSync: { pending: true, pendingKind: 'state', attempts: 0 } },
      }),
    )
    let seen: unknown = null
    const fetchMock = makeFetchMock({
      state: (body) => {
        seen = body
        return jsonResponse({ results: [{ uid: 'uid-1', found: true }] })
      },
    })
    await retryPendingCheckinSyncs(10, fetchMock)
    expect(seen).toEqual({
      platform: 'trae',
      items: [
        {
          poolAccountId: 'pool-1',
          ownerUserId: null,
          uid: 'uid-1',
          state: 'enabled',
        },
      ],
    })
  })

  it('无签到引擎平台(codearts)→ 不发请求,直接清并计 droppedNoEngine', async () => {
    hoisted.pendingRows.push(pendingCredRow({ providerCode: 'codearts' }))
    const fetchMock = vi.fn()
    const r = await retryPendingCheckinSyncs(10, fetchMock)
    expect(r).toEqual({ retried: 0, cleared: 0, stillPending: 0, droppedNoEngine: 1 })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(hoisted.updateCalls).toHaveLength(1) // 仅 clear
  })

  it('解密抛错 → stillPending + 重标记(不拖垮整轮)', async () => {
    hoisted.pendingRows.push(pendingCredRow({ tokenEnc: 123 as unknown as string }))
    const fetchMock = vi.fn()
    const r = await retryPendingCheckinSyncs(10, fetchMock)
    expect(r).toMatchObject({ retried: 1, cleared: 0, stillPending: 1 })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(hoisted.updateCalls).toHaveLength(1)
    const extra = hoisted.updateCalls[0]!.values.extraMetadata as { __vals: unknown[] }
    expect(extra.__vals).toContain('cred')
  })

  it('混合批次:各象限独立计数,互不拖垮', async () => {
    hoisted.pendingRows.push(
      pendingCredRow({ id: 'a1' }),
      pendingCredRow({ id: 'a2', providerCode: 'codearts' }),
      pendingCredRow({
        id: 'a3',
        extraMetadata: {
          checkinSync: { pending: true, pendingKind: 'state', state: 'enabled', attempts: 1 },
        },
      }),
    )
    const fetchMock = makeFetchMock({
      sync: () => jsonResponse({ results: [{ poolAccountId: 'a1', status: 'synced' }] }),
      state: () => jsonResponse({ results: [{ uid: 'uid-1', found: true }] }),
    })
    const r = await retryPendingCheckinSyncs(10, fetchMock)
    expect(r).toEqual({ retried: 2, cleared: 2, stillPending: 0, droppedNoEngine: 1 })
  })

  it('listCheckinSyncPending 透传 limit', async () => {
    hoisted.pendingRows.push(pendingCredRow())
    const rows = await listCheckinSyncPending(42)
    expect(hoisted.limitUsed).toEqual([42])
    expect(rows).toHaveLength(1)
  })
})

// =============================================================================
// admin 点查与手动触发(O64 提交 6:号池页签到列数据源与行操作)
// =============================================================================

describe('fetchPoolStatus(端点 4 点查)', () => {
  it('GET + 鉴权 + 查询串;解析 found/冷却/最近记录', async () => {
    let seenUrl = ''
    let seenAuth = ''
    const fetchMock = vi.fn(
      async (input: unknown, init?: { body?: unknown; headers?: unknown }) => {
        seenUrl = String(input)
        seenAuth = String(
          (init?.headers as Record<string, string> | undefined)?.['X-Internal-Secret'] ?? '',
        )
        return jsonResponse({
          found: true,
          accountId: 12,
          name: '池号 A',
          enabled: true,
          poolAccountId: 'pool-1',
          poolCredVersion: 5,
          poolSyncedAt: '2026-10-23T00:00:00Z',
          poolDeletedAt: null,
          pendingCred: true,
          cooldownUntil: '2026-10-24T01:00:00Z',
          lastRecord: {
            ok: true,
            action: 'checkin',
            credits: 120,
            createdAt: '2026-10-23T06:00:00Z',
          },
        })
      },
    )
    const r = await fetchPoolStatus(
      'qoder',
      { poolAccountId: 'pool-1', uid: 'u-9001' },
      fetchMock as unknown as typeof fetch,
    )
    expect(r.ok).toBe(true)
    expect(seenAuth).toBe('test-internal-secret')
    expect(seenUrl).toContain(
      '/internal/checkin/pool-status?platform=qoder&poolAccountId=pool-1&uid=u-9001',
    )
    expect(r.found).toBe(true)
    expect(r.accountId).toBe(12)
    expect(r.pendingCred).toBe(true)
    expect(r.cooldownUntil).toBe('2026-10-24T01:00:00Z')
    expect(r.lastRecord).toMatchObject({ ok: true, credits: 120 })
  })

  it('found:false(未同步)原样回传,不当作错误', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ found: false }))
    const r = await fetchPoolStatus(
      'trae',
      { poolAccountId: 'pool-1', uid: 'u-1' },
      fetchMock as unknown as typeof fetch,
    )
    expect(r).toMatchObject({ ok: true, found: false, error: null })
  })

  it('HTTP 500 / 网络错 → ok:false', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ detail: 'boom' }, 500))
    const r = await fetchPoolStatus(
      'trae',
      { poolAccountId: 'pool-1', uid: 'u-1' },
      fetchMock as unknown as typeof fetch,
    )
    expect(r.ok).toBe(false)
    expect(r.error).toContain('500')
  })

  it('密钥未配置 → ok:false 不发请求', async () => {
    hoisted.cfg.AI_CALLBACK_SECRET = undefined
    const fetchMock = vi.fn()
    const r = await fetchPoolStatus(
      'trae',
      { poolAccountId: 'pool-1', uid: 'u-1' },
      fetchMock as unknown as typeof fetch,
    )
    expect(r.ok).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('postPoolRun(立即签到转发)', () => {
  it('成功 → 回传 record', async () => {
    let seenBody: unknown
    const fetchMock = vi.fn(async (_input: unknown, init?: { body?: unknown }) => {
      seenBody = JSON.parse(String(init?.body))
      return jsonResponse({ ok: true, credits: 200 })
    })
    const r = await postPoolRun(
      'qoder',
      { poolAccountId: 'pool-1', ownerUserId: null, uid: 'u-9001' },
      fetchMock as unknown as typeof fetch,
    )
    expect(r.ok).toBe(true)
    expect(r.httpStatus).toBe(200)
    expect(r.record).toMatchObject({ credits: 200 })
    expect(seenBody).toEqual({
      platform: 'qoder',
      poolAccountId: 'pool-1',
      ownerUserId: null,
      uid: 'u-9001',
    })
  })

  it('429(冷却/限流)透传 httpStatus 与 detail', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ detail: '签到接口限流冷却中(120s),请稍后再试' }, 429),
    )
    const r = await postPoolRun(
      'qoder',
      { poolAccountId: 'pool-1', ownerUserId: null, uid: 'u-9001' },
      fetchMock as unknown as typeof fetch,
    )
    expect(r.ok).toBe(false)
    expect(r.httpStatus).toBe(429)
    expect(r.error).toContain('429')
    expect(r.error).toContain('限流冷却')
  })

  it('404(未同步)透传', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ detail: '签到账号不存在: qoder/u-9' }, 404))
    const r = await postPoolRun(
      'qoder',
      { poolAccountId: 'pool-1', ownerUserId: null, uid: 'u-9' },
      fetchMock as unknown as typeof fetch,
    )
    expect(r).toMatchObject({ ok: false, httpStatus: 404 })
  })

  it('网络错 → httpStatus 502', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('connect ECONNREFUSED')
    })
    const r = await postPoolRun(
      'qoder',
      { poolAccountId: 'pool-1', ownerUserId: null, uid: 'u-1' },
      fetchMock as unknown as typeof fetch,
    )
    expect(r).toMatchObject({ ok: false, httpStatus: 502 })
    expect(r.error).toContain('网络错误')
  })
})
