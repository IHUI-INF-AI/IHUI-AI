// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * POST /admin/relay/accounts/:id/login-local — 「登录本机」路由级契约测试(2026-10-28)。
 *
 * 背景:import shape gate 重构时本端点被误删(前端 admin 号池页仍调此路径,不恢复即 404)。
 * 本文件锁住恢复后的口径:
 * - 端点已注册且委托 relay-local-login.loginAccountLocal(库行对象原样透传,路由不裁剪);
 * - LocalLoginError.status 如实透传(409 = 平台无法离线重封,文案不吞、不冒绿);
 * - 账号不存在 → 404;服务层非 LocalLoginError 异常 → 500 兜底。
 * 服务层全 mock,绝不真写本机客户端存储。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const hoisted = vi.hoisted(() => {
  /** 与真实服务同形(message/code/status);路由的 instanceof 判定依赖 mock 提供本类 */
  class LocalLoginError extends Error {
    code: string
    status: number
    constructor(message: string, code: string, status: number) {
      super(message)
      this.name = 'LocalLoginError'
      this.code = code
      this.status = status
    }
  }
  return {
    /** login-local 的单行查询(where(eq).limit) */
    fullRows: [] as Array<Record<string, unknown>>,
    loginAccountLocal: vi.fn(async (_row: Record<string, unknown>) => ({
      ok: true,
      providerCode: 'trae',
      uid: 'uid-1',
      replacedUid: null,
      targetFile: 'C:\\Users\\test\\AppData\\Roaming\\Trae\\storage.json',
      backupFile: 'C:\\Users\\test\\AppData\\Roaming\\Trae\\storage.json.bak-2026-10-28',
      notes: [],
      tokenNearExpiry: false,
      refreshed: false,
      restartHint: '重启 Trae 客户端生效',
    })),
    LocalLoginError,
  }
})

vi.mock('../../plugins/require-permission.js', () => ({
  requireAdmin: async () => {},
}))
vi.mock('../../db/index.js', () => ({
  db: {
    update: () => ({
      set: () => ({ where: async () => [] }),
    }),
  },
  dbRead: {
    select: () => ({
      from: () => ({
        // where 既是 thenable(inArray 路径直接 await)又挂 limit(eq 路径)
        where: () => {
          const obj: Record<string, unknown> = {
            then: (res: (v: unknown) => unknown) => Promise.resolve([]).then(res),
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
  // 路由顶层经 @ihui/shared → packages/shared/src/sse/contract.ts 读取本表;
  // mock 少一个导出会在 import 期抛错(整套件 collection 失败),故按真值补齐。
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
  completeAccountPhone: vi.fn(async () => ({
    code: 'ok',
    message: null,
    id: 'row-1',
    oldName: null,
    name: null,
    changed: false,
    checkinSync: { pushed: 0, pending: false, error: null },
  })),
  matchPhoneCandidates: vi.fn(async () => ({
    scannedMasked: 0,
    matched: [],
    ambiguous: [],
    unmatched: [],
    rejected: [],
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
  encryptAccountProxyUrl: (u: string | null) => u,
  resolveAccountProxyUrl: (u: string | null) => u,
  maskAccountProxyUrl: () => null,
}))
vi.mock('../../services/relay-model-catalog.js', () => ({
  listModelCatalog: vi.fn(async () => ({})),
  createModelCatalog: vi.fn(async () => ({})),
  deleteModelCatalog: vi.fn(async () => ({})),
}))
vi.mock('../../services/relay-account-pool-checkin-sync.js', () => ({
  checkinPlatformFor: () => null,
  buildPoolSyncAccount: vi.fn((src: unknown) => src),
  pushPoolSync: vi.fn(async () => ({
    ok: true,
    pushed: 0,
    skipped: 0,
    failed: 0,
    failedIds: [],
    error: null,
  })),
  pushPoolState: vi.fn(async () => ({ ok: true, error: null })),
  markCheckinSyncPending: vi.fn(async () => {}),
  clearCheckinSyncPending: vi.fn(async () => {}),
  extractCosy: vi.fn(() => null),
  pemFromSecrets: vi.fn(() => null),
  fetchPoolStatus: vi.fn(async () => ({ ok: true, found: false })),
  postPoolRun: vi.fn(async () => ({ ok: true, httpStatus: 200, record: null, error: null })),
  listCheckinSyncPending: vi.fn(async () => []),
  retryPendingCheckinSyncs: vi.fn(async () => ({})),
  parseCheckinSyncMeta: vi.fn(() => ({})),
}))
// 本套件核心:登录本机服务层全 mock —— 绝不真 spawn 脚本写回本机客户端存储
vi.mock('../../services/relay-local-login.js', () => ({
  loginAccountLocal: hoisted.loginAccountLocal,
  LocalLoginError: hoisted.LocalLoginError,
}))

import relayAccountPoolRoutes from '../admin/relay-account-pool.js'

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

function loginOkResult() {
  return {
    ok: true,
    providerCode: 'trae',
    uid: 'uid-1',
    replacedUid: null,
    targetFile: 'C:\\Users\\test\\AppData\\Roaming\\Trae\\storage.json',
    backupFile: 'C:\\Users\\test\\AppData\\Roaming\\Trae\\storage.json.bak-2026-10-28',
    notes: [],
    tokenNearExpiry: false,
    refreshed: false,
    restartHint: '重启 Trae 客户端生效',
  }
}

beforeEach(async () => {
  hoisted.fullRows.length = 0
  hoisted.loginAccountLocal.mockReset()
  hoisted.loginAccountLocal.mockImplementation(async (_row: Record<string, unknown>) =>
    loginOkResult(),
  )
  app = Fastify()
  // 与 routes/index.ts 一致:插件内部路径自带 /admin 段,register 时补 /api 前缀
  app.register(relayAccountPoolRoutes, { prefix: '/api' })
  await app.ready()
})

describe('POST /admin/relay/accounts/:id/login-local — 登录本机(路由层)', () => {
  it('端点已注册且委托 loginAccountLocal:库行对象原样透传,服务结果进 success 信封', async () => {
    const row = poolRow()
    hoisted.fullRows.push(row)
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/relay/accounts/pool-1/login-local',
    })
    expect(res.statusCode).toBe(200)
    expect(hoisted.loginAccountLocal).toHaveBeenCalledTimes(1)
    // 路由层不得裁剪行(服务层要靠行上的加密凭证字段/会话模板重封)
    expect(hoisted.loginAccountLocal.mock.calls[0]![0]).toBe(row)
    expect((res.json() as { data: Record<string, unknown> }).data).toMatchObject({
      ok: true,
      providerCode: 'trae',
      uid: 'uid-1',
      refreshed: false,
    })
  })

  it('账号不存在 → 404,服务层不被调用', async () => {
    hoisted.fullRows.length = 0
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/relay/accounts/pool-x/login-local',
    })
    expect(res.statusCode).toBe(404)
    expect(hoisted.loginAccountLocal).not.toHaveBeenCalled()
  })

  it('LocalLoginError(409) → 状态与文案如实透传(无法离线重封的平台不冒绿)', async () => {
    hoisted.fullRows.push(poolRow({ providerCode: 'minimax' }))
    hoisted.loginAccountLocal.mockRejectedValue(
      new hoisted.LocalLoginError(
        '平台 minimax 不支持登录本机:OAuth 票绑设备指纹,无法离线重封',
        'unsupported_provider',
        409,
      ),
    )
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/relay/accounts/pool-1/login-local',
    })
    expect(res.statusCode).toBe(409)
    expect((res.json() as { message: string }).message).toContain('无法离线重封')
  })

  it('服务层抛非 LocalLoginError → 500 兜底', async () => {
    hoisted.fullRows.push(poolRow())
    hoisted.loginAccountLocal.mockRejectedValue(new Error('boom'))
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/relay/accounts/pool-1/login-local',
    })
    expect(res.statusCode).toBe(500)
  })
})
