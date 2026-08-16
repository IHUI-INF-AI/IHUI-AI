/**
 * admin-saas-quota 路由测试(2026-08-06 新增功能:租户配额真实聚合)。
 *
 * 覆盖:
 *  - 数据库无租户 → 404
 *  - api_logs 按租户成员计数(apiCalls.used)、files 按成员 SUM(size)→ MB(向下取整)
 *  - tenant_quotas 无记录时回退套餐默认限额(free/pro)
 *  - aiTokens 按 ai_cost_records 聚合,limits 未配置 → null(无上限)
 *  - requireAdmin 钩子生效 / 内部异常 → 500
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'

const { mockRequireAdmin, mockSelect } = vi.hoisted(() => ({
  mockRequireAdmin: vi.fn(),
  mockSelect: vi.fn(),
}))

// 默认放行 admin
mockRequireAdmin.mockImplementation(async () => {})

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdmin: mockRequireAdmin,
}))

// mock drizzle-orm 的操作符:路由中 eq/and/isNull 只用于构造条件,不真正执行 SQL
vi.mock('drizzle-orm', () => ({
  eq: vi.fn(() => ({ op: 'eq' })),
  and: vi.fn(() => ({ op: 'and' })),
  isNull: vi.fn(() => ({ op: 'isNull' })),
  sql: vi.fn((strs: TemplateStringsArray, ...vals: unknown[]) => ({
    op: 'sql',
    text: String(strs),
    vals,
  })),
}))

// mock @ihui/database:避免真实导入该 workspace 包导致 vitest 退出码非 0(仓库既有问题)
vi.mock('@ihui/database', () => ({
  tenants: { id: 'tenants.id', slug: 'tenants.slug', plan: 'tenants.plan' },
  tenantQuotas: { tenantId: 'tenantQuotas.tenantId' },
  aiCostRecords: { tenantId: 'aiCostRecords.tenantId', totalTokens: 'aiCostRecords.totalTokens' },
  apiLogs: { userId: 'apiLogs.userId' },
  files: { uploadedBy: 'files.uploadedBy', size: 'files.size', deletedAt: 'files.deletedAt' },
  tenantMembers: { userId: 'tenantMembers.userId', tenantId: 'tenantMembers.tenantId' },
}))

/** 构造 drizzle 查询 builder 的链式 thenable mock:任何方法调用都返回自身,await 后 resolve 到 result */
function makeChainable(result: unknown): Record<string, unknown> {
  const thenFn = (resolve: (v: unknown) => void) => resolve(result)
  const make = (): Record<string, unknown> => {
    const proxy = new Proxy({} as Record<string, unknown>, {
      get(_target, prop: string) {
        if (prop === 'then') return thenFn
        return vi.fn().mockReturnValue(make())
      },
    })
    return proxy
  }
  return make()
}

vi.mock('../src/db/index.js', () => ({
  dbRead: { select: mockSelect },
  db: {},
}))

import { adminSaasQuotaRoutes } from '../src/routes/admin-saas-quota'

const MB = 1024 * 1024
const API_PREFIX = '/api/admin-saas'

describe('admin-saas-quota 路由', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(adminSaasQuotaRoutes, { prefix: API_PREFIX })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAdmin.mockImplementation(async () => {})
  })

  function queueSelects(...results: unknown[]): void {
    const queue = [...results]
    mockSelect.mockImplementation(() => makeChainable(queue.shift() ?? []))
  }

  it('数据库无该租户 → 404', async () => {
    queueSelects([])
    const res = await server.inject({ method: 'GET', url: `${API_PREFIX}/customers/ghost/quota` })
    expect(res.statusCode).toBe(404)
    expect(res.json().code).toBe(404)
  })

  it('真实聚合:api_logs 成员计数 + files SUM(size) → MB + aiTokens 聚合', async () => {
    queueSelects(
      [{ id: 't1', slug: 'acme', plan: 'pro' }], // tenants
      [
        {
          apiCallsLimit: 2_000_000,
          storageLimitMb: 60_000,
          periodEnd: new Date('2026-08-31T00:00:00Z'),
          limits: {},
        },
      ], // tenant_quotas
      [{ used: 123_456 }], // ai_cost_records
      [{ used: 42 }], // api_logs × tenant_members
      [{ usedBytes: 5 * MB }], // files × tenant_members
    )
    const res = await server.inject({ method: 'GET', url: `${API_PREFIX}/customers/acme/quota` })
    expect(res.statusCode).toBe(200)
    const data = res.json().data
    expect(data.slug).toBe('acme')
    expect(data.placeholder).toBe(false)
    expect(data.apiCalls).toEqual({
      used: 42,
      limit: 2_000_000,
      window: 'month',
      resetAt: '2026-08-31T00:00:00.000Z',
    })
    expect(data.aiTokens.used).toBe(123_456)
    expect(data.storage).toEqual({ usedBytes: 5 * MB, limitBytes: 60_000 * MB })
    // 5 次聚合查询(tenants / tenant_quotas / ai_cost_records / api_logs / files)
    expect(mockSelect).toHaveBeenCalledTimes(5)
  })

  it('storage 字节→MB 向下取整', async () => {
    queueSelects(
      [{ id: 't1', slug: 'floor', plan: 'pro' }],
      [{ apiCallsLimit: 1_000_000, storageLimitMb: 51_200 }],
      [],
      [],
      [{ usedBytes: 5.7 * MB }],
    )
    const res = await server.inject({ method: 'GET', url: `${API_PREFIX}/customers/floor/quota` })
    expect(res.statusCode).toBe(200)
    // floor(5.7)=5
    expect(res.json().data.storage.usedBytes).toBe(5 * MB)
  })

  it('无 tenant_quotas / 无聚合记录 → 套餐默认限额兜底,used=0,resetAt=null', async () => {
    queueSelects([{ id: 't2', slug: 'startup', plan: 'free' }], [], [], [], [])
    const res = await server.inject({ method: 'GET', url: `${API_PREFIX}/customers/startup/quota` })
    expect(res.statusCode).toBe(200)
    const data = res.json().data
    expect(data.apiCalls).toEqual({ used: 0, limit: 100_000, window: 'month', resetAt: null })
    expect(data.aiTokens).toEqual({ used: 0, limit: null, window: 'month', resetAt: null })
    expect(data.storage).toEqual({ usedBytes: 0, limitBytes: 10_240 * MB })
  })

  it('tenant_quotas.limits 配置 aiTokensLimit 时作为 aiTokens.limit', async () => {
    queueSelects(
      [{ id: 't3', slug: 'cap', plan: 'enterprise' }],
      [{ limits: { aiTokensLimit: 500_000 }, apiCallsLimit: 10_000_000, storageLimitMb: 102_400 }],
      [{ used: 7 }],
      [{ used: 1 }],
      [{ usedBytes: 1 * MB }],
    )
    const res = await server.inject({ method: 'GET', url: `${API_PREFIX}/customers/cap/quota` })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.aiTokens.limit).toBe(500_000)
  })

  it('requireAdmin 钩子生效:被拦截时返回 401', async () => {
    mockRequireAdmin.mockImplementationOnce(
      async (_req: unknown, reply: { status: (n: number) => { send: (b: object) => unknown } }) =>
        reply.status(401).send({ code: 401, message: '需要管理员权限' }),
    )
    const res = await server.inject({ method: 'GET', url: `${API_PREFIX}/customers/x/quota` })
    expect(res.statusCode).toBe(401)
    expect(mockSelect).not.toHaveBeenCalled()
  })

  it('聚合查询异常 → 500', async () => {
    mockSelect.mockImplementation(() => {
      throw new Error('db down')
    })
    const res = await server.inject({ method: 'GET', url: `${API_PREFIX}/customers/acme/quota` })
    expect(res.statusCode).toBe(500)
    expect(res.json().code).toBe(500)
  })
})
