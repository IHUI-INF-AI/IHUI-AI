// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * POST /admin/relay/accounts/:id/models — 可用模型清单点查(24 号路由)契约测试。
 *
 * 重 admin 插件的 import 面全 mock(与 relay-account-pool-checkin-admin 同骨架);
 * 只测路由编排形状:富契约优先/既有 listModels 回落包装/无实证通路 400/账号 404。
 * adapter 本体的解析与错误路径由 tests/relay-qoder-models.test.ts 锁。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const hoisted = vi.hoisted(() => ({
  fullRows: [] as Array<Record<string, unknown>>,
  /** getRelayAdapter 的可控假 adapter(每测覆写) */
  adapter: null as Record<string, unknown> | null,
}))

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
        where: () => ({ limit: async () => hoisted.fullRows }),
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
  getRelayAdapter: vi.fn(() => hoisted.adapter),
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
  pushPoolSync: vi.fn(async () => ({ ok: true, pushed: 0, skipped: 0, failed: 0, failedIds: [], error: null })),
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

import relayAccountPoolRoutes from '../admin/relay-account-pool.js'

let app: FastifyInstance

function poolRow(over: Record<string, unknown> = {}) {
  return {
    id: 'pool-1',
    ownerUserId: null,
    providerCode: 'qoder',
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
  hoisted.adapter = null
  app = Fastify()
  app.register(relayAccountPoolRoutes, { prefix: '/api' })
  await app.ready()
})

describe('POST /admin/relay/accounts/:id/models', () => {
  it('账号不存在 → 404', async () => {
    hoisted.fullRows.length = 0
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/relay/accounts/pool-x/models',
    })
    expect(res.statusCode).toBe(404)
  })

  it('适配器未注册 → 400', async () => {
    hoisted.fullRows.length = 0
    hoisted.fullRows.push(poolRow({ providerCode: 'ghost-platform' }))
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/relay/accounts/pool-1/models',
    })
    expect(res.statusCode).toBe(400)
  })

  it('富契约优先:listModelsDetailed 结果透传(qoder 本机 CLI 形)', async () => {
    hoisted.fullRows.length = 0
    hoisted.fullRows.push(poolRow())
    hoisted.adapter = {
      listModelsDetailed: vi.fn(async () => ({
        ok: true,
        scope: 'local-cli-login',
        models: [
          { name: 'Auto' },
          { name: 'GLM-5.3', id: 'GLM-5.3' },
          { name: 'glm-5.3-flash', id: 'qoder-custom-e2bf…', idTruncated: true },
        ],
      })),
    }
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/relay/accounts/pool-1/models',
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.ok).toBe(true)
    expect(body.data.scope).toBe('local-cli-login')
    expect(body.data.models).toHaveLength(3)
    expect(body.data.models[2].idTruncated).toBe(true)
    // 凭据只投喂适配器,响应面零凭据
    expect(res.body).not.toContain('tok-1')
    expect(res.body).not.toContain('enc:tok')
  })

  it('富契约 ok:false(如 CLI 缺失)→ 200 透传 ok:false 与 error,路由不吞不编', async () => {
    hoisted.fullRows.length = 0
    hoisted.fullRows.push(poolRow())
    hoisted.adapter = {
      listModelsDetailed: vi.fn(async () => ({ ok: false, error: 'CLI 未找到' })),
    }
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/relay/accounts/pool-1/models',
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.ok).toBe(false)
    expect(body.data.error).toBe('CLI 未找到')
    expect(body.data.models).toEqual([])
  })

  it('只有既有 listModels(string[])→ 逐名包装为 {name}', async () => {
    hoisted.fullRows.length = 0
    hoisted.fullRows.push(poolRow({ providerCode: 'trae' }))
    hoisted.adapter = {
      listModels: vi.fn(async () => ['m-a', 'm-b']),
    }
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/relay/accounts/pool-1/models',
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.scope).toBe('upstream-account')
    expect(body.data.models).toEqual([{ name: 'm-a' }, { name: 'm-b' }])
  })

  it('两条通路皆无(minimax 形,端点未实证)→ 400 未支持,绝不编造清单', async () => {
    hoisted.fullRows.length = 0
    hoisted.fullRows.push(poolRow({ providerCode: 'minimax' }))
    hoisted.adapter = {}
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/relay/accounts/pool-1/models',
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().message).toContain('未支持')
  })
})
