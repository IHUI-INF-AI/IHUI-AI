// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SDB-45 回归锁:对端「根本没有该账号」不是可重试失败。
 *
 * 对端契约(apps/ai-service/app/services/checkin_store.py:apply_pool_state):
 * 账号不存在 ⇒ {found:false, accountId:null}(不带 reason);只有端点兜底 except
 * 分支才带 reason。修复前 pushPoolState 把 found:false 一律判失败 ⇒ 从未同步过的
 * 号 pending 永不清除、attempts 到 20 误告警后无限静默重推。
 *
 * 三条断言:
 * ① found:false 且无 reason ⇒ peerMissing:清 pending、不累加 attempts、不发告警;
 * ② found:false 且带 reason(端点异常)⇒ 真实失败:保留 pending 并 attempts+1;
 * ③ 真实失败达阈值仍照常升级告警(修复不得吞掉真故障的可观测性)。
 *
 * 全程不连库:db / crypto / logger / 告警出口都是注入的假实现,fetch 经参数注入。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

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
    alertCalls: [] as Array<Record<string, unknown>>,
  }
})

vi.mock('../src/config/index.js', () => ({ config: hoisted.cfg }))
vi.mock('../src/utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('../src/utils/crypto.js', () => ({
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
vi.mock('../src/db/index.js', () => ({
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
            limit: async () => hoisted.pendingRows,
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
// 升级告警出口:只记调用,不落渠道;动态 import 按模块 id 命中此 mock
vi.mock('../src/services/alert-notification-service.js', () => ({
  pushAlertWithResult: async (n: Record<string, unknown>) => {
    hoisted.alertCalls.push(n)
    return { ok: true }
  },
  pushAlert: async (n: Record<string, unknown>) => {
    hoisted.alertCalls.push(n)
  },
}))

import {
  pushPoolState,
  retryPendingCheckinSyncs,
} from '../src/services/relay-account-pool-checkin-sync.js'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** 一条 state 类待推行(重推器只走 pushPoolState,不碰凭证解密) */
function pendingStateRow(over: Record<string, unknown> = {}) {
  return {
    id: 'pool-state-1',
    ownerUserId: null,
    providerCode: 'trae',
    uid: 'uid-1',
    name: '账号一',
    tokenEnc: 'enc:tok-1',
    refreshTokenEnc: null,
    secretsEnc: null,
    proxyUrl: null,
    deviceId: null,
    machineId: null,
    isEnabled: true,
    credVersion: 1,
    tokenExpiresAt: null,
    extraMetadata: {
      checkinSync: { pending: true, pendingKind: 'state', state: 'disabled', attempts: 1 },
    },
    ...over,
  }
}

/** pool-state 响应注入:body 即对端 results[0] 的形状 */
function stateFetch(result: Record<string, unknown> | null) {
  return vi.fn(async () => jsonResponse({ results: result ? [result] : [] }))
}

beforeEach(() => {
  hoisted.cfg.AI_CALLBACK_SECRET = 'test-internal-secret'
  hoisted.updateCalls.length = 0
  hoisted.pendingRows.length = 0
  hoisted.alertCalls.length = 0
})

describe('SDB-45 pushPoolState 不能把 found:false 一律判可重试', () => {
  const target = { poolAccountId: 'pool-state-1', ownerUserId: null, uid: 'uid-1' }

  it('found:false 无 reason(对端无此账号)⇒ peerMissing', async () => {
    const r = await pushPoolState('trae', target, 'disabled', stateFetch({ found: false, accountId: null }))
    expect(r.ok).toBe(false)
    expect(r.peerMissing).toBe(true)
  })

  it('found:false 带 reason(端点异常)⇒ 真实失败,不是 peerMissing', async () => {
    const r = await pushPoolState(
      'trae',
      target,
      'disabled',
      stateFetch({ found: false, accountId: null, reason: '数据库连接失败' }),
    )
    expect(r.ok).toBe(false)
    expect(r.peerMissing).toBeUndefined()
    expect(r.error).toContain('数据库连接失败')
  })

  it('空 results(契约违背)⇒ 真实失败,不是 peerMissing', async () => {
    const r = await pushPoolState('trae', target, 'disabled', stateFetch(null))
    expect(r.ok).toBe(false)
    expect(r.peerMissing).toBeUndefined()
  })
})

describe('SDB-45 retryPendingCheckinSyncs 对端无此账号时清 pending', () => {
  it('found:false 无 reason ⇒ 清 pending、不累加 attempts、不发告警', async () => {
    hoisted.pendingRows.push(pendingStateRow())
    const fetchMock = stateFetch({ found: false, accountId: null })

    const r = await retryPendingCheckinSyncs(10, fetchMock)

    expect(r).toMatchObject({ retried: 1, cleared: 1, stillPending: 0 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    // 只落一次 clear(pending=false),没有 mark(pending=true / attempts+1)那一腿
    expect(hoisted.updateCalls).toHaveLength(1)
    const extra = hoisted.updateCalls[0]!.values.extraMetadata as { __sql: string }
    expect(extra.__sql).toContain('lastSyncedAt')
    expect(extra.__sql).toMatch(/'pending',\s*false/)
    expect(extra.__sql).not.toMatch(/'pending',\s*true/)
    // 不触发升级告警
    expect(hoisted.alertCalls).toHaveLength(0)
  })

  it('found:false 带 reason ⇒ 真实失败保住原语义:保留 pending 且 attempts+1', async () => {
    hoisted.pendingRows.push(pendingStateRow())
    const fetchMock = stateFetch({
      found: false,
      accountId: null,
      reason: '数据库连接失败',
    })

    const r = await retryPendingCheckinSyncs(10, fetchMock)

    expect(r).toMatchObject({ retried: 1, cleared: 0, stillPending: 1 })
    expect(hoisted.updateCalls).toHaveLength(1)
    const extra = hoisted.updateCalls[0]!.values.extraMetadata as { __sql: string }
    expect(extra.__sql).toMatch(/'pending',\s*true/)
    // 原子 +1,不是清零
    expect(extra.__sql).toContain('+ 1')
    // attempts 未到阈值(1+1 < 20)不告警
    expect(hoisted.alertCalls).toHaveLength(0)
  })

  it('真实失败达阈值 ⇒ 升级告警仍照常触发(修复不吞真故障)', async () => {
    hoisted.pendingRows.push(
      pendingStateRow({
        extraMetadata: {
          checkinSync: { pending: true, pendingKind: 'state', state: 'disabled', attempts: 19 },
        },
      }),
    )
    const fetchMock = stateFetch({
      found: false,
      accountId: null,
      reason: '数据库连接失败',
    })

    const r = await retryPendingCheckinSyncs(10, fetchMock)

    expect(r).toMatchObject({ retried: 1, cleared: 0, stillPending: 1 })
    expect(hoisted.alertCalls).toHaveLength(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
