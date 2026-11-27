// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 路由契约测试:遥测 v2 的 4 个静态端点不能被 `/ai-model-config/:id` 吃掉,
 * 且 window / configId / limit 的校验必须发生在 service 之前。service 全部 mock,
 * 不触数据库,不依赖管理员登录。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@127.0.0.1:5399/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const { serviceCalls } = vi.hoisted(() => ({
  serviceCalls: {
    telemetry: [] as unknown[],
    models: [] as unknown[],
    calls: [] as unknown[],
    governance: 0,
  },
}))

vi.mock('../../plugins/require-permission.js', () => ({
  requireAdmin: vi.fn(async () => undefined),
}))

vi.mock('../../db/index.js', () => ({ db: {}, dbRead: {} }))

vi.mock('../../services/ai-model-telemetry-v2.js', () => ({
  resolveTelemetryWindow: (value: unknown) => (value === '24h' || value === '7d' ? value : '1h'),
  collectAiModelTelemetryV2: vi.fn(async (_window: unknown) => {
    serviceCalls.telemetry.push(_window)
    return {
      window: '24h',
      totals: {
        calls: 3,
        tokens: 1234,
        promptTokens: 900,
        completionTokens: 334,
      },
      byConfig: {},
    }
  }),
  collectAiModelModelsTelemetryV2: vi.fn(async (configId: unknown, window: unknown) => {
    serviceCalls.models.push([configId, window])
    return { configId, window, models: [] }
  }),
  collectRecentAiModelCalls: vi.fn(
    async (configId: unknown, model: unknown, window: unknown, limit: unknown) => {
      serviceCalls.calls.push([configId, model, window, limit])
      return []
    },
  ),
}))

vi.mock('../../services/ai-model-governance.js', () => ({
  collectAiModelGovernance: vi.fn(async () => {
    serviceCalls.governance += 1
    return { summary: { configs: 0 }, issues: [], byConfig: {}, byProvider: {} }
  }),
}))

import { adminMonitoringRoutes } from '../admin-monitoring-routes'
import responseSanitizer from '../../plugins/response-sanitizer'

describe('admin ai-model telemetry routes', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify()
    // 与生产装配一致:先挂响应脱敏,再挂路由。计费聚合字段必须原样返回,
    // 不能被字段名含 "token" 的规则打成 "***"(否则前端 formatCompact 得到 NaN)。
    await app.register(responseSanitizer)
    await app.register(adminMonitoringRoutes, { prefix: '/api/admin' })
    // 模拟 stats.ts 的参数路由:静态段必须优先,不能被这里吃掉。
    app.get('/api/admin/ai-model-config/:id', async () => ({ code: 0, data: { shadowed: true } }))
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    serviceCalls.telemetry.length = 0
    serviceCalls.models.length = 0
    serviceCalls.calls.length = 0
    serviceCalls.governance = 0
  })

  it('telemetry 接受 24h 并把窗口透传给 service', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/ai-model-config/telemetry?window=24h',
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({
      code: 0,
      data: {
        totals: { calls: 3, tokens: 1234, promptTokens: 900, completionTokens: 334 },
      },
    })
    expect(serviceCalls.telemetry).toEqual(['24h'])
  })

  it('非法窗口在路由层拒绝,不透传到 service', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/ai-model-config/telemetry?window=5m',
    })
    expect(res.statusCode).toBe(400)
    expect(serviceCalls.telemetry).toHaveLength(0)
  })

  it('models 缺 configId 返回 400;合法请求把 configId/window 透传', async () => {
    const bad = await app.inject({
      method: 'GET',
      url: '/api/admin/ai-model-config/telemetry/models?window=7d',
    })
    expect(bad.statusCode).toBe(400)
    expect(serviceCalls.models).toHaveLength(0)

    const ok = await app.inject({
      method: 'GET',
      url: '/api/admin/ai-model-config/telemetry/models?configId=59&window=7d',
    })
    expect(ok.statusCode).toBe(200)
    expect(serviceCalls.models).toEqual([[59, '7d']])
  })

  it('calls 透传 model / limit,且 limit 上限 100', async () => {
    const ok = await app.inject({
      method: 'GET',
      url: '/api/admin/ai-model-config/telemetry/calls?configId=59&window=1h&model=qoder%2Fauto&limit=3',
    })
    expect(ok.statusCode).toBe(200)
    expect(serviceCalls.calls).toEqual([[59, 'qoder/auto', '1h', 3]])

    const bad = await app.inject({
      method: 'GET',
      url: '/api/admin/ai-model-config/telemetry/calls?configId=59&limit=101',
    })
    expect(bad.statusCode).toBe(400)
  })

  it('health 静态段不会被 /:id 参数路由吃掉', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/ai-model-config/health' })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { data?: { shadowed?: boolean } }
    expect(body.data?.shadowed).toBeUndefined()
    expect(serviceCalls.governance).toBe(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
