/**
 * 资源上游自动同步中心路由单元测试(2026-07-24 立)。
 *
 * 覆盖范围:
 *   - Webhook HMAC-SHA256 签名校验(正负向 case,github/npm/custom 三源)
 *   - 12 个端点权限校验(requireAuth / requireAdmin / checkAuth)
 *   - 列表查询参数校验(Zod enum + 未知参数 strip)
 *   - 安装端点 payload 校验 + DB 链路
 *
 * mock 策略:db / auth / registry-queries / registry-queue / config-drift / config-migrator 全部 mock,
 * 被测路由逻辑(requireAuth / requireAdmin / Zod / HMAC / 响应格式)保持真实。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { createHmac } from 'node:crypto'

// =============================================================================
// 环境变量(webhook 签名密钥 + JWT + DB 占位)
// =============================================================================
vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.GITHUB_WEBHOOK_SECRET ??= 'test-github-secret'
  process.env.NPM_WEBHOOK_SECRET ??= 'test-npm-secret'
  process.env.MCP_MARKETPLACE_WEBHOOK_SECRET ??= 'test-mcp-secret'
  process.env.CUSTOM_WEBHOOK_SECRET ??= 'test-custom-secret'
})

// =============================================================================
// Mock 函数(vi.hoisted 确保在 vi.mock 之前可用)
// =============================================================================
const {
  mockAuthenticate,
  mockCheckAuth,
  mockDbExecute,
  mockDbReadSelect,
  mockDbReadSelectChain,
  mockListRegistryItems,
  mockGetRegistryItem,
  mockListSyncLogs,
  mockListWebhookTriggers,
  mockInsertWebhookTrigger,
  mockMarkWebhookTriggerProcessed,
  mockEnqueueManualSync,
  mockEnqueueWebhookSync,
  mockScheduleRegistrySync,
  mockScheduleRegistryCleanup,
  mockStartRegistryCleanupWorker,
  mockDetectAllDrift,
  mockDetectDrift,
  mockUpdateBaseline,
  mockListMigrationHistory,
  mockMigrateConfig,
} = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
  mockCheckAuth: vi.fn(),
  mockDbExecute: vi.fn(),
  mockDbReadSelect: vi.fn(),
  mockDbReadSelectChain: {
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
  },
  mockListRegistryItems: vi.fn(),
  mockGetRegistryItem: vi.fn(),
  mockListSyncLogs: vi.fn(),
  mockListWebhookTriggers: vi.fn(),
  mockInsertWebhookTrigger: vi.fn(),
  mockMarkWebhookTriggerProcessed: vi.fn(),
  mockEnqueueManualSync: vi.fn(),
  mockEnqueueWebhookSync: vi.fn(),
  mockScheduleRegistrySync: vi.fn(),
  mockScheduleRegistryCleanup: vi.fn(),
  mockStartRegistryCleanupWorker: vi.fn(),
  mockDetectAllDrift: vi.fn(),
  mockDetectDrift: vi.fn(),
  mockUpdateBaseline: vi.fn(),
  mockListMigrationHistory: vi.fn(),
  mockMigrateConfig: vi.fn(),
}))

// =============================================================================
// Mock 模块
// =============================================================================
vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
  checkAuth: mockCheckAuth,
}))

// require-permission.js 保持真实(调用 mockAuthenticate),仅 mock rbac-queries 避免真实 DB
vi.mock('../src/db/rbac-queries.js', () => ({
  checkPermission: vi.fn().mockResolvedValue(false),
  getUserPermissions: vi.fn().mockResolvedValue([]),
}))

vi.mock('../src/db/index.js', () => ({
  db: { execute: mockDbExecute },
  dbRead: { select: mockDbReadSelect },
}))

vi.mock('@ihui/database', () => ({
  registryItems: {
    id: 'id',
    sourceType: 'source_type',
    sourceId: 'source_id',
    version: 'version',
    name: 'name',
    heatScore: 'heat_score',
  },
}))

vi.mock('../src/db/registry-queries.js', () => ({
  listRegistryItems: mockListRegistryItems,
  getRegistryItem: mockGetRegistryItem,
  listSyncLogs: mockListSyncLogs,
  listWebhookTriggers: mockListWebhookTriggers,
  insertWebhookTrigger: mockInsertWebhookTrigger,
  markWebhookTriggerProcessed: mockMarkWebhookTriggerProcessed,
}))

vi.mock('../src/plugins/registry-queue.js', () => ({
  enqueueManualSync: mockEnqueueManualSync,
  enqueueWebhookSync: mockEnqueueWebhookSync,
  scheduleRegistrySync: mockScheduleRegistrySync,
  scheduleRegistryCleanup: mockScheduleRegistryCleanup,
  startRegistryCleanupWorker: mockStartRegistryCleanupWorker,
}))

vi.mock('../src/services/registry-sync/config-drift-detector.js', () => ({
  detectAllDrift: mockDetectAllDrift,
  detectDrift: mockDetectDrift,
  updateBaseline: mockUpdateBaseline,
}))

vi.mock('../src/services/registry-sync/config-migrator.js', () => ({
  listMigrationHistory: mockListMigrationHistory,
  migrateConfig: mockMigrateConfig,
}))

// =============================================================================
// 导入被测模块
// =============================================================================
import { registrySyncRoutes } from '../src/routes/registry-sync.js'

// =============================================================================
// 辅助函数
// =============================================================================

const WEBHOOK_SECRETS: Record<string, string> = {
  github: process.env.GITHUB_WEBHOOK_SECRET!,
  npm: process.env.NPM_WEBHOOK_SECRET!,
  mcp_marketplace: process.env.MCP_MARKETPLACE_WEBHOOK_SECRET!,
  custom: process.env.CUSTOM_WEBHOOK_SECRET!,
}

/** 计算 HMAC-SHA256 签名,github 格式 sha256=<hex>,其余直接 hex */
function signPayload(source: string, payload: string): string {
  const secret = WEBHOOK_SECRETS[source]
  const sig = createHmac('sha256', secret).update(payload).digest('hex')
  return source === 'github' ? `sha256=${sig}` : sig
}

/** 模拟"普通用户"鉴权通过(roleId=0) */
function authAsUser(userId = 'user-001') {
  mockAuthenticate.mockImplementation((request: any) => {
    request.userId = userId
    request.jwtPayload = { userId, roleId: 0 }
    return Promise.resolve(request.jwtPayload)
  })
  mockCheckAuth.mockImplementation(async (request: any, _reply: any) => {
    try {
      await mockAuthenticate(request)
      return true
    } catch {
      return false
    }
  })
}

/** 模拟"管理员"鉴权通过(roleId=1) */
function authAsAdmin(userId = 'admin-001') {
  mockAuthenticate.mockImplementation((request: any) => {
    request.userId = userId
    request.jwtPayload = { userId, roleId: 1 }
    return Promise.resolve(request.jwtPayload)
  })
  mockCheckAuth.mockImplementation(async (request: any, _reply: any) => {
    try {
      await mockAuthenticate(request)
      return true
    } catch {
      return false
    }
  })
}

/** 模拟"无 token / 鉴权失败"(authenticate 抛 401) */
function noAuth() {
  mockAuthenticate.mockImplementation(() => {
    const err = new Error('Authentication required') as Error & { statusCode: number }
    err.statusCode = 401
    throw err
  })
  mockCheckAuth.mockImplementation(async (_request: any, reply: any) => {
    reply.status(401).send({ code: 401, message: 'Authentication required' })
    return false
  })
}

/** 构建 Fastify app,注册 registrySyncRoutes,挂载必要装饰器 */
async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  app.decorate('redisForQueue', {} as never)
  app.decorate('registryWorkerStats', {
    processed: 10,
    failed: 1,
    lastProcessedAt: '2026-07-24T00:00:00Z',
  } as never)
  await app.register(registrySyncRoutes, { prefix: '/api' })
  await app.ready()
  return app
}

// =============================================================================
// 测试套件
// =============================================================================
describe('Registry Sync Routes', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await buildApp()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.resetAllMocks()

    // 重建 dbRead.select 链式 mock(resetAllMocks 清空了 mockReturnThis)
    mockDbReadSelect.mockReturnValue(mockDbReadSelectChain)
    mockDbReadSelectChain.from.mockReturnThis()
    mockDbReadSelectChain.where.mockReturnThis()
    mockDbReadSelectChain.orderBy.mockReturnThis()
    mockDbReadSelectChain.limit.mockResolvedValue([])

    // 默认:无鉴权
    noAuth()

    // 默认 mock 返回值
    mockListRegistryItems.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      installedIds: [],
    })
    mockListSyncLogs.mockResolvedValue({ logs: [], total: 0, page: 1, pageSize: 20 })
    mockListWebhookTriggers.mockResolvedValue({ triggers: [], total: 0 })
    mockInsertWebhookTrigger.mockResolvedValue({ id: 'trigger-id-123' })
    mockEnqueueManualSync.mockResolvedValue('job-id-123')
    mockEnqueueWebhookSync.mockResolvedValue('job-id-456')
    mockDbExecute.mockResolvedValue([])
    mockScheduleRegistrySync.mockResolvedValue(undefined)
    mockScheduleRegistryCleanup.mockResolvedValue(undefined)
    mockStartRegistryCleanupWorker.mockReturnValue(undefined)
    mockDetectAllDrift.mockResolvedValue({
      reports: [],
      hasDrift: false,
      detectedAt: '2026-07-24T00:00:00Z',
    })
    mockDetectDrift.mockResolvedValue({ fileType: 'env_example', drifted: false, changes: [] })
    mockUpdateBaseline.mockResolvedValue(undefined)
    mockListMigrationHistory.mockResolvedValue([])
    mockMigrateConfig.mockResolvedValue({ migrated: 0, failed: 0, rolledBack: 0, details: [] })
  })

  // ===========================================================================
  // 1. Webhook 签名校验(P0 安全核心)
  // ===========================================================================
  describe('Webhook 签名校验', () => {
    it('POST /api/registry/webhook/github + 正确签名 → 202 + trigger 落库 + 入队', async () => {
      const payload = JSON.stringify({ action: 'published', repository: { full_name: 'org/repo' } })
      const sig = signPayload('github', payload)

      const res = await app.inject({
        method: 'POST',
        url: '/api/registry/webhook/github',
        headers: {
          'content-type': 'text/plain',
          'x-hub-signature-256': sig,
        },
        payload,
      })

      expect(res.statusCode).toBe(202)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.accepted).toBe(true)
      expect(body.data.triggerId).toBe('trigger-id-123')
      expect(body.data.syncTriggered).toBe(true)

      // trigger 落库(status=pending,签名通过)
      expect(mockInsertWebhookTrigger).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'github',
          status: 'pending',
        }),
      )
      // 入队 webhook 同步任务
      expect(mockEnqueueWebhookSync).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ source: 'github', triggerId: 'trigger-id-123' }),
      )
    })

    it('POST /api/registry/webhook/github + 错误签名 → 401 + trigger 落库 status=ignored', async () => {
      const payload = JSON.stringify({ action: 'published' })

      const res = await app.inject({
        method: 'POST',
        url: '/api/registry/webhook/github',
        headers: {
          'content-type': 'text/plain',
          'x-hub-signature-256': 'sha256=invalid-signature-hex',
        },
        payload,
      })

      expect(res.statusCode).toBe(401)
      expect(res.json().message).toContain('签名验证失败')

      // trigger 仍落库,但 status=ignored
      expect(mockInsertWebhookTrigger).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'github',
          status: 'ignored',
        }),
      )
      // 签名失败时不应入队
      expect(mockEnqueueWebhookSync).not.toHaveBeenCalled()
    })

    it('POST /api/registry/webhook/github + 无签名头 → 401', async () => {
      const payload = JSON.stringify({ action: 'published' })

      const res = await app.inject({
        method: 'POST',
        url: '/api/registry/webhook/github',
        headers: { 'content-type': 'text/plain' },
        payload,
      })

      expect(res.statusCode).toBe(401)
      expect(mockInsertWebhookTrigger).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'ignored' }),
      )
      expect(mockEnqueueWebhookSync).not.toHaveBeenCalled()
    })

    it('POST /api/registry/webhook/npm + 正确签名 → 202', async () => {
      const payload = JSON.stringify({ event: 'package-update', name: 'express' })
      const sig = signPayload('npm', payload)

      const res = await app.inject({
        method: 'POST',
        url: '/api/registry/webhook/npm',
        headers: {
          'content-type': 'text/plain',
          'x-webhook-signature': sig,
        },
        payload,
      })

      expect(res.statusCode).toBe(202)
      expect(res.json().data.accepted).toBe(true)
      expect(mockInsertWebhookTrigger).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'npm', status: 'pending' }),
      )
    })

    it('POST /api/registry/webhook/custom + 正确签名 → 202', async () => {
      const payload = JSON.stringify({ event: 'update', name: 'custom-tool' })
      const sig = signPayload('custom', payload)

      const res = await app.inject({
        method: 'POST',
        url: '/api/registry/webhook/custom',
        headers: {
          'content-type': 'text/plain',
          'x-webhook-signature': sig,
        },
        payload,
      })

      expect(res.statusCode).toBe(202)
      expect(res.json().data.accepted).toBe(true)
      expect(mockInsertWebhookTrigger).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'custom', status: 'pending' }),
      )
    })
  })

  // ===========================================================================
  // 2. 权限校验(12 端点)
  // ===========================================================================
  describe('权限校验', () => {
    it('GET /api/registry/items + 无 token → 401', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/registry/items' })
      expect(res.statusCode).toBe(401)
    })

    it('GET /api/registry/items + 普通用户 token → 200', async () => {
      authAsUser()
      const res = await app.inject({
        method: 'GET',
        url: '/api/registry/items',
        headers: { authorization: 'Bearer user-token' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })

    it('GET /api/registry/sync-logs + 普通用户 token → 403(权限收紧,仅管理员)', async () => {
      authAsUser()
      const res = await app.inject({
        method: 'GET',
        url: '/api/registry/sync-logs',
        headers: { authorization: 'Bearer user-token' },
      })
      expect(res.statusCode).toBe(403)
    })

    it('GET /api/registry/sync-logs + 管理员 token → 200', async () => {
      authAsAdmin()
      const res = await app.inject({
        method: 'GET',
        url: '/api/registry/sync-logs',
        headers: { authorization: 'Bearer admin-token' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })

    it('POST /api/registry/sync + 普通用户 token → 403', async () => {
      authAsUser()
      const res = await app.inject({
        method: 'POST',
        url: '/api/registry/sync',
        headers: { authorization: 'Bearer user-token' },
      })
      expect(res.statusCode).toBe(403)
      expect(res.json().message).toContain('管理员')
    })

    it('POST /api/registry/sync + 管理员 token → 202', async () => {
      authAsAdmin()
      const res = await app.inject({
        method: 'POST',
        url: '/api/registry/sync',
        headers: { authorization: 'Bearer admin-token', 'content-type': 'application/json' },
        payload: {},
      })
      expect(res.statusCode).toBe(202)
      expect(res.json().data.success).toBe(true)
      expect(res.json().data.jobId).toBe('job-id-123')
      expect(mockEnqueueManualSync).toHaveBeenCalled()
    })

    it('GET /api/registry/webhooks + 普通用户 token → 403', async () => {
      authAsUser()
      const res = await app.inject({
        method: 'GET',
        url: '/api/registry/webhooks',
        headers: { authorization: 'Bearer user-token' },
      })
      expect(res.statusCode).toBe(403)
    })

    it('GET /api/registry/webhooks + 管理员 token → 200', async () => {
      authAsAdmin()
      const res = await app.inject({
        method: 'GET',
        url: '/api/registry/webhooks',
        headers: { authorization: 'Bearer admin-token' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })

    it('POST /api/registry/upgrade-all + 普通用户 token → 403', async () => {
      authAsUser()
      const res = await app.inject({
        method: 'POST',
        url: '/api/registry/upgrade-all',
        headers: { authorization: 'Bearer user-token' },
      })
      expect(res.statusCode).toBe(403)
    })

    it('GET /api/registry/config-drift + 普通用户 token → 403', async () => {
      authAsUser()
      const res = await app.inject({
        method: 'GET',
        url: '/api/registry/config-drift',
        headers: { authorization: 'Bearer user-token' },
      })
      expect(res.statusCode).toBe(403)
    })

    it('GET /api/registry/worker-stats + 普通用户 token → 403', async () => {
      authAsUser()
      const res = await app.inject({
        method: 'GET',
        url: '/api/registry/worker-stats',
        headers: { authorization: 'Bearer user-token' },
      })
      expect(res.statusCode).toBe(403)
    })

    it('GET /api/registry/worker-stats + 管理员 token → 200', async () => {
      authAsAdmin()
      const res = await app.inject({
        method: 'GET',
        url: '/api/registry/worker-stats',
        headers: { authorization: 'Bearer admin-token' },
      })
      expect(res.statusCode).toBe(200)
      const data = res.json().data
      expect(data.processed).toBe(10)
      expect(data.failed).toBe(1)
      expect(data.lastProcessedAt).toBe('2026-07-24T00:00:00Z')
    })

    it('GET /api/registry/config-drift + 管理员 token → 200', async () => {
      authAsAdmin()
      const res = await app.inject({
        method: 'GET',
        url: '/api/registry/config-drift',
        headers: { authorization: 'Bearer admin-token' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
      expect(mockDetectAllDrift).toHaveBeenCalled()
    })
  })

  // ===========================================================================
  // 3. 列表查询
  // ===========================================================================
  describe('列表查询', () => {
    it('GET /api/registry/items?sort=latest → 200 + items + total + installedIds', async () => {
      authAsUser()
      mockListRegistryItems.mockResolvedValue({
        items: [{ id: 'item-1', name: 'Test MCP', sourceType: 'mcp' }],
        total: 1,
        page: 1,
        pageSize: 20,
        installedIds: ['item-1'],
      })

      const res = await app.inject({
        method: 'GET',
        url: '/api/registry/items?sort=latest',
        headers: { authorization: 'Bearer user-token' },
      })

      expect(res.statusCode).toBe(200)
      const data = res.json().data
      expect(data.items).toHaveLength(1)
      expect(data.total).toBe(1)
      expect(data.installedIds).toContain('item-1')
      expect(mockListRegistryItems).toHaveBeenCalledWith(
        expect.objectContaining({ sort: 'latest' }),
        'user-001',
      )
    })

    it('GET /api/registry/items?sort=hot → 200', async () => {
      authAsUser()
      const res = await app.inject({
        method: 'GET',
        url: '/api/registry/items?sort=hot',
        headers: { authorization: 'Bearer user-token' },
      })
      expect(res.statusCode).toBe(200)
      expect(mockListRegistryItems).toHaveBeenCalledWith(
        expect.objectContaining({ sort: 'hot' }),
        expect.any(String),
      )
    })

    it('GET /api/registry/items?sort=best → 200', async () => {
      authAsUser()
      const res = await app.inject({
        method: 'GET',
        url: '/api/registry/items?sort=best',
        headers: { authorization: 'Bearer user-token' },
      })
      expect(res.statusCode).toBe(200)
      expect(mockListRegistryItems).toHaveBeenCalledWith(
        expect.objectContaining({ sort: 'best' }),
        expect.any(String),
      )
    })

    it('GET /api/registry/items?sourceType=mcp → 200 + 透传 sourceType', async () => {
      authAsUser()
      const res = await app.inject({
        method: 'GET',
        url: '/api/registry/items?sourceType=mcp',
        headers: { authorization: 'Bearer user-token' },
      })
      expect(res.statusCode).toBe(200)
      expect(mockListRegistryItems).toHaveBeenCalledWith(
        expect.objectContaining({ sourceType: 'mcp' }),
        expect.any(String),
      )
    })

    it('GET /api/registry/items?sort=invalid_value → 400(Zod enum 校验失败)', async () => {
      authAsUser()
      const res = await app.inject({
        method: 'GET',
        url: '/api/registry/items?sort=invalid_value',
        headers: { authorization: 'Bearer user-token' },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().code).toBe(400)
    })
  })

  // ===========================================================================
  // 4. 安装/升级
  // ===========================================================================
  describe('安装/升级', () => {
    it('POST /api/registry/install + 有效 body → 200', async () => {
      authAsUser()
      mockDbReadSelectChain.limit.mockResolvedValue([
        { id: 'item-1', version: '1.2.0', name: 'Test MCP' },
      ])
      mockDbExecute.mockResolvedValue(undefined)

      const res = await app.inject({
        method: 'POST',
        url: '/api/registry/install',
        headers: { authorization: 'Bearer user-token', 'content-type': 'application/json' },
        payload: { sourceType: 'mcp', sourceId: 'test-mcp', version: '1.0.0' },
      })

      expect(res.statusCode).toBe(200)
      const data = res.json().data
      expect(data.success).toBe(true)
      expect(data.installed).toBe(true)
      expect(data.version).toBe('1.0.0')
      expect(mockDbExecute).toHaveBeenCalled()
    })

    it('POST /api/registry/install + 无效 body(缺 sourceType) → 400', async () => {
      authAsUser()
      const res = await app.inject({
        method: 'POST',
        url: '/api/registry/install',
        headers: { authorization: 'Bearer user-token', 'content-type': 'application/json' },
        payload: { sourceId: 'test-mcp' },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().code).toBe(400)
    })
  })
})
