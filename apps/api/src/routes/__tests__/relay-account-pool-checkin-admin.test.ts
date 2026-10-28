// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * O64 admin 号池页签到端点单测(提交 6):checkin-resync 单条重推 /
 * checkin-status 批量点查 / checkin-run 立即签到(429 透传)。
 * 重 admin 插件的 import 面全 mock;checkin-sync 服务层已由
 * relay-account-pool-checkin-sync.test.ts 测透,这里只验 HTTP 形状与编排。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const hoisted = vi.hoisted(() => ({
  /** resync/run 的单行查询(where(eq).limit) */
  fullRows: [] as Array<Record<string, unknown>>,
  /** checkin-status 的批量查询(where(inArray) 直接 await) */
  statusRows: [] as Array<Record<string, unknown>>,
  updateCalls: [] as Array<{ values: Record<string, unknown> }>,
  pushResult: {
    ok: true,
    pushed: 1,
    skipped: 0,
    failed: 0,
    failedIds: [] as string[],
    error: null as string | null,
  },
  statusViews: {} as Record<
    string,
    {
      ok: boolean
      found: boolean
      error?: string
      accountId?: number
      name?: string
      enabled?: boolean
      pendingCred?: boolean
      cooldownUntil?: string
      lastRecord?: {
        ok: boolean
        action: string | null
        credits: number | null
        createdAt: string | null
      }
    }
  >,
  runResult: {
    ok: true,
    httpStatus: 200,
    record: { ok: true } as Record<string, unknown> | null,
    error: null as string | null,
  },
}))

vi.mock('../../plugins/require-permission.js', () => ({
  requireAdmin: async () => {},
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
        // where 既是 thenable(inArray 路径直接 await)又挂 limit(eq 路径)
        where: () => {
          const obj: Record<string, unknown> = {
            then: (res: (v: unknown) => unknown) => Promise.resolve(hoisted.statusRows).then(res),
          }
          obj.limit = async () => hoisted.fullRows
          return obj
        },
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
vi.mock('@ihui/types', () => ({
  PROVIDER_HEALTH_STATUSES: ['healthy', 'degraded', 'down', 'unknown'],
  // 2026-10-27 修复存量红:本 mock 此前只给 PROVIDER_HEALTH_STATUSES,而
  // packages/shared/src/sse/contract.ts 在**模块求值期**就解构
  // CHAT_SYNC_EVENT_NAMES(chat-sync 帧名单一真相源,2026-10-26 起)⇒
  // 整份测试文件在收集期就抛 "No CHAT_SYNC_EVENT_NAMES export",用例一个都没跑到。
  // 这里按 packages/types/src/chat-sync-contract.ts 的逐字值补齐(不得漂移)。
  CHAT_SYNC_EVENT_NAMES: {
    MESSAGE_CREATED: 'message:created',
    MESSAGE_PATCHED: 'message:patched',
    MESSAGE_TERMINAL: 'message:terminal',
  },
}))
vi.mock('../../utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('../../services/relay-account-pool-service.js', () => ({
  importAccounts: vi.fn(async () => ({})),
  decryptAccountCredentials: vi.fn(() => ({
    token: 'tok-1',
    refreshToken: 'ref-1',
    cookies: [],
    secrets: {},
  })),
}))
vi.mock('../../services/relay-account-pool-scheduler.js', () => ({
  sweepAccountPool: vi.fn(async () => ({})),
}))
vi.mock('../../services/relay-account-usage.js', () => ({
  getAccountUsage: vi.fn(async () => ({})),
  getAccountUsageSummaries: vi.fn(async () => new Map()),
  purgeAccountUsage: vi.fn(async () => 0),
}))
vi.mock('../../services/relay-upstream-adapters.js', () => ({
  getRelayAdapter: vi.fn(() => null),
}))
vi.mock('../../services/relay-proxy-pool.js', () => ({
  listProxies: vi.fn(async () => ({})),
  createProxy: vi.fn(async () => ({})),
  updateProxy: vi.fn(async () => ({})),
  deleteProxy: vi.fn(async () => ({})),
  getProxyById: vi.fn(async () => null),
  markProxyChecked: vi.fn(async () => ({})),
  // 账号级代理三件套:relay-account-pool.ts 从本模块导入它们,
  // 而 vi.mock 是**整模块替换**(不是按需合并)⇒ 少给一个导出名,调用处就是
  // "undefined is not a function" ⇒ 被 handler 的 catch 吞成 500。
  // checkin-resync 走的是 resolveAccountProxyUrl(row.proxyUrl)(真实现是解密,
  // 解不出按直连处理);本测不关心代理判据,按存储值原样返回即可。
  encryptAccountProxyUrl: vi.fn(async (v: string) => `enc:${v}`),
  resolveAccountProxyUrl: vi.fn((stored: string | null | undefined) => stored ?? null),
  maskAccountProxyUrl: vi.fn((stored: string | null | undefined) => stored ?? null),
}))
vi.mock('../../services/relay-model-catalog.js', () => ({
  listModelCatalog: vi.fn(async () => ({})),
  createModelCatalog: vi.fn(async () => ({})),
  deleteModelCatalog: vi.fn(async () => ({})),
}))
vi.mock('../../services/relay-account-pool-checkin-sync.js', () => ({
  checkinPlatformFor: (code: string) =>
    code === 'trae' || code === 'workbuddy' || code === 'qoder' ? code : null,
  buildPoolSyncAccount: vi.fn((src: unknown) => src),
  pushPoolSync: vi.fn(async () => hoisted.pushResult),
  pushPoolState: vi.fn(async () => ({ ok: true, error: null })),
  markCheckinSyncPending: vi.fn(async () => {}),
  clearCheckinSyncPending: vi.fn(async () => {}),
  extractCosy: vi.fn(() => null),
  // 设备密钥投影:本测不关心其判据(真实现由 tests/relay-account-device-key-bridge.test.ts 锁)
  pemFromSecrets: vi.fn(() => null),
  fetchPoolStatus: vi.fn(
    async (_p: string, target: { poolAccountId: string; uid: string }) =>
      hoisted.statusViews[target.uid] ?? { ok: true, found: false },
  ),
  postPoolRun: vi.fn(async () => hoisted.runResult),
  listCheckinSyncPending: vi.fn(async () => []),
  retryPendingCheckinSyncs: vi.fn(async () => ({})),
  parseCheckinSyncMeta: vi.fn(() => ({})),
}))

import relayAccountPoolRoutes from '../admin/relay-account-pool.js'
import {
  pushPoolSync,
  markCheckinSyncPending,
  clearCheckinSyncPending,
  postPoolRun,
} from '../../services/relay-account-pool-checkin-sync.js'

let app: FastifyInstance

function poolRow(over: Record<string, unknown> = {}) {
  return {
    id: 'pool-1',
    ownerUserId: null,
    providerCode: 'trae',
    uid: 'uid-1',
    name: '池号 A',
    isEnabled: true,
    credVersion: 7,
    tokenEnc: 'enc:tok',
    refreshTokenEnc: 'enc:ref',
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

beforeEach(async () => {
  hoisted.fullRows.length = 0
  hoisted.statusRows.length = 0
  hoisted.updateCalls.length = 0
  hoisted.pushResult = {
    ok: true,
    pushed: 1,
    skipped: 0,
    failed: 0,
    failedIds: [],
    error: null,
  }
  hoisted.statusViews = {}
  hoisted.runResult = { ok: true, httpStatus: 200, record: { ok: true }, error: null }
  vi.mocked(pushPoolSync).mockClear()
  vi.mocked(markCheckinSyncPending).mockClear()
  vi.mocked(clearCheckinSyncPending).mockClear()
  vi.mocked(postPoolRun).mockClear()
  app = Fastify()
  // 与 routes/index.ts 一致:插件内部路径自带 /admin 段,register 时补 /api 前缀
  app.register(relayAccountPoolRoutes, { prefix: '/api' })
  await app.ready()
})

// =============================================================================
// 21. POST /admin/relay/accounts/:id/checkin-resync
// =============================================================================

describe('POST /admin/relay/accounts/:id/checkin-resync', () => {
  it('账号不存在 → 404', async () => {
    hoisted.fullRows.length = 0
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/relay/accounts/pool-x/checkin-resync',
    })
    expect(res.statusCode).toBe(404)
    expect(pushPoolSync).not.toHaveBeenCalled()
  })

  it('无签到引擎平台(codearts)→ 400 不推送', async () => {
    hoisted.fullRows.push(poolRow({ providerCode: 'codearts' }))
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/relay/accounts/pool-1/checkin-resync',
    })
    expect(res.statusCode).toBe(400)
    expect(pushPoolSync).not.toHaveBeenCalled()
  })

  it('成功 → 200 + 清 pending', async () => {
    hoisted.fullRows.push(poolRow())
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/relay/accounts/pool-1/checkin-resync',
    })
    expect(res.statusCode).toBe(200)
    expect((res.json() as { data: { pushed: number } }).data).toMatchObject({ pushed: 1 })
    expect(pushPoolSync).toHaveBeenCalledWith('trae', [expect.objectContaining({ id: 'pool-1' })])
    expect(clearCheckinSyncPending).toHaveBeenCalledWith(['pool-1'])
    expect(markCheckinSyncPending).not.toHaveBeenCalled()
  })

  it('推送失败 → 502 + 落 pending(attempts SQL 内累积)', async () => {
    hoisted.fullRows.push(poolRow())
    hoisted.pushResult = {
      ok: false,
      pushed: 0,
      skipped: 0,
      failed: 1,
      failedIds: ['pool-1'],
      error: 'pool-sync HTTP 500: boom',
    }
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/relay/accounts/pool-1/checkin-resync',
    })
    expect(res.statusCode).toBe(502)
    expect(markCheckinSyncPending).toHaveBeenCalledWith(
      ['pool-1'],
      'cred',
      null,
      expect.stringContaining('500'),
    )
    expect(clearCheckinSyncPending).not.toHaveBeenCalled()
  })
})

// =============================================================================
// 22. POST /admin/relay/account-pool/checkin-status
// =============================================================================

describe('POST /admin/relay/account-pool/checkin-status', () => {
  it('ids 空 / 超 20 → 400', async () => {
    const empty = await app.inject({
      method: 'POST',
      url: '/api/admin/relay/account-pool/checkin-status',
      payload: { ids: [] },
    })
    expect(empty.statusCode).toBe(400)
    const tooMany = await app.inject({
      method: 'POST',
      url: '/api/admin/relay/account-pool/checkin-status',
      payload: { ids: Array.from({ length: 21 }, (_, i) => `p-${i}`) },
    })
    expect(tooMany.statusCode).toBe(400)
  })

  it('聚合三态:已同步点查 / 无引擎 noEngine / 号池行不存在', async () => {
    hoisted.statusRows.push(poolRow({ id: 'pool-1', uid: 'uid-1' }))
    hoisted.statusRows.push(poolRow({ id: 'pool-2', providerCode: 'codearts', uid: 'uid-2' }))
    hoisted.statusViews = {
      'uid-1': {
        ok: true,
        found: true,
        accountId: 12,
        name: '池号 A',
        enabled: true,
        pendingCred: true,
        cooldownUntil: '2026-10-24T01:00:00Z',
        lastRecord: {
          ok: true,
          action: 'checkin',
          credits: 120,
          createdAt: '2026-10-23T06:00:00Z',
        },
      },
    }
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/relay/account-pool/checkin-status',
      payload: { ids: ['pool-1', 'pool-2', 'pool-ghost'] },
    })
    expect(res.statusCode).toBe(200)
    const items = (
      res.json() as {
        data: {
          items: Record<
            string,
            { found: boolean; noEngine?: boolean; pendingCred?: boolean; creditsHint?: unknown }
          >
        }
      }
    ).data.items
    expect(items['pool-1']).toMatchObject({ ok: true, found: true, pendingCred: true })
    expect(items['pool-2']).toMatchObject({ found: false, noEngine: true })
    expect(items['pool-ghost']).toMatchObject({ found: false })
  })
})

// =============================================================================
// 23. POST /admin/relay/accounts/:id/checkin-run
// =============================================================================

describe('POST /admin/relay/accounts/:id/checkin-run', () => {
  it('账号不存在 → 404', async () => {
    hoisted.fullRows.length = 0
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/relay/accounts/pool-x/checkin-run',
    })
    expect(res.statusCode).toBe(404)
    expect(postPoolRun).not.toHaveBeenCalled()
  })

  it('无签到引擎平台 → 400', async () => {
    hoisted.fullRows.push(poolRow({ providerCode: 'codearts' }))
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/relay/accounts/pool-1/checkin-run',
    })
    expect(res.statusCode).toBe(400)
    expect(postPoolRun).not.toHaveBeenCalled()
  })

  it('成功 → 200 回传签到 record', async () => {
    hoisted.fullRows.push(poolRow())
    hoisted.runResult = {
      ok: true,
      httpStatus: 200,
      record: { ok: true, credits: 200 },
      error: null,
    }
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/relay/accounts/pool-1/checkin-run',
    })
    expect(res.statusCode).toBe(200)
    expect((res.json() as { data: { record: { credits: number } } }).data.record).toMatchObject({
      credits: 200,
    })
    expect(postPoolRun).toHaveBeenCalledWith('trae', {
      poolAccountId: 'pool-1',
      ownerUserId: null,
      uid: 'uid-1',
    })
  })

  it('429(冷却/限流)原样透传(admin 看到剩余时间)', async () => {
    hoisted.fullRows.push(poolRow())
    hoisted.runResult = {
      ok: false,
      httpStatus: 429,
      record: null,
      error: 'pool-run HTTP 429: 签到接口限流冷却中(120s),请稍后再试',
    }
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/relay/accounts/pool-1/checkin-run',
    })
    expect(res.statusCode).toBe(429)
    expect((res.json() as { message: string }).message).toContain('限流冷却')
  })

  it('404(未同步)透传;网络错 → 502', async () => {
    hoisted.fullRows.push(poolRow())
    hoisted.runResult = {
      ok: false,
      httpStatus: 404,
      record: null,
      error: 'pool-run HTTP 404: 签到账号不存在: trae/uid-1',
    }
    const nf = await app.inject({
      method: 'POST',
      url: '/api/admin/relay/accounts/pool-1/checkin-run',
    })
    expect(nf.statusCode).toBe(404)

    hoisted.runResult = { ok: false, httpStatus: 502, record: null, error: 'pool-run 网络错误: x' }
    const net = await app.inject({
      method: 'POST',
      url: '/api/admin/relay/accounts/pool-1/checkin-run',
    })
    expect(net.statusCode).toBe(502)
  })
})
