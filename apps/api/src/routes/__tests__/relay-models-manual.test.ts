// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * POST /admin/relay/models/manual — 从零手动登记模型行(契约测试)。
 *
 * 重 admin 插件 import 面全 mock(同 relay-account-pool-models-admin 骨架);
 * 只测路由编排:未知平台 400 / 父行建 + 子行插 201 / 已存在幂等 201 / 父行建法调用。
 * ensureProviderConfigRow 的真实建行由 relay-models-sync.test.ts 锁,此处 mock。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const hoisted = vi.hoisted(() => ({
  /** ensureProviderConfigRow 的可控返回(每测覆写) */
  ensure: vi.fn<(code: string) => Promise<{ configId: number; created: boolean }>>(async () => ({
    configId: 16,
    created: true,
  })),
  /** insert().values().onConflictDoNothing().returning() 的可控返回 */
  insertedRows: [] as Array<Record<string, unknown>>,
}))

vi.mock('../../plugins/require-permission.js', () => ({
  requireAdmin: async () => {},
}))
vi.mock('../../jobs/relay-models-sync.js', () => ({
  ensureProviderConfigRow: (code: string) => hoisted.ensure(code),
}))
vi.mock('../../db/index.js', () => ({
  db: {
    insert: () => ({
      values: () => ({
        onConflictDoNothing: () => ({
          returning: async () => hoisted.insertedRows,
        }),
      }),
    }),
  },
  dbRead: {},
}))
vi.mock('@ihui/database', () => ({
  aiModelConfig: new Proxy(
    {},
    { get: (_t, prop) => ({ __col: typeof prop === 'string' ? prop : String(prop) }) },
  ),
  aiModelConfigModels: new Proxy(
    {},
    { get: (_t, prop) => ({ __col: typeof prop === 'string' ? prop : String(prop) }) },
  ),
}))
vi.mock('../../utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const buildApp = async () => {
  const app = Fastify()
  const mod = await import('../admin/relay-models.js')
  await app.register(mod.default)
  await app.ready()
  return app
}

describe('POST /admin/relay/models/manual — 从零手动登记模型行', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hoisted.ensure.mockResolvedValue({ configId: 16, created: true })
    hoisted.insertedRows = [{ id: 999 }]
  })

  it('未知中继平台 → 400', async () => {
    const app = await buildApp()
    const r = await app.inject({
      method: 'POST',
      url: '/admin/relay/models/manual',
      payload: { providerCode: 'not_a_platform', modelId: 'm-1' },
    })
    expect(r.statusCode).toBe(400)
    app.close()
  })

  it('codex 首次登记 → 建父行 + 插子行 201', async () => {
    const app = await buildApp()
    hoisted.ensure.mockResolvedValue({ configId: 50, created: true })
    hoisted.insertedRows = [{ id: 1000 }]
    const r = await app.inject({
      method: 'POST',
      url: '/admin/relay/models/manual',
      payload: { providerCode: 'codex', modelId: 'gpt-5-codex' },
    })
    expect(r.statusCode).toBe(201)
    const body = r.json()
    expect(body.data.configId).toBe(50)
    expect(body.data.configRowCreated).toBe(true)
    expect(body.data.modelRowId).toBe(1000)
    expect(body.data.inserted).toBe(true)
    expect(hoisted.ensure).toHaveBeenCalledWith('codex')
    app.close()
  })

  it('已存在(冲突未命中 returning 空)→ 幂等 201,inserted=false', async () => {
    const app = await buildApp()
    hoisted.ensure.mockResolvedValue({ configId: 16, created: false })
    hoisted.insertedRows = []
    const r = await app.inject({
      method: 'POST',
      url: '/admin/relay/models/manual',
      payload: { providerCode: 'doubao', modelId: 'doubao-2.0-pro' },
    })
    expect(r.statusCode).toBe(201)
    const body = r.json()
    expect(body.data.inserted).toBe(false)
    expect(body.data.modelRowId).toBeNull()
    app.close()
  })

  it('缺 modelId → 400(参数校验)', async () => {
    const app = await buildApp()
    const r = await app.inject({
      method: 'POST',
      url: '/admin/relay/models/manual',
      payload: { providerCode: 'codex' },
    })
    expect(r.statusCode).toBe(400)
    app.close()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
