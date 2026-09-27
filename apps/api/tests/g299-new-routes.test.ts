// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-299 三枚待实装路由的回归锁(2026-09-28)。
 * ① GET /api/subagents/all —— 全量派单新→旧 + status/limit 透传(消费者 agent-teams 页);
 * ②③ /api/ai/n8n/workflows* —— env 未配置时 list 回 stub、写操作 503(桩成功=把没判写成判过了,绝不)。
 * 全程不连库不发网络(vi.mock 服务与鉴权;§5 测试隔离铁律)。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: async (request: { userId?: string }) => {
    request.userId = 'probe-user'
  },
  checkAuth: async () => true,
}))

const listAllMock = vi.fn()
vi.mock('../src/services/subagent-dispatch-service.js', () => ({
  subagentDispatchService: {
    setRedisClient: async () => undefined,
    listAll: () => listAllMock(),
    listActive: () => [],
  },
}))
vi.mock('../src/db/agent-queries.js', () => ({ findAgentTasksByAgentId: async () => [] }))

import { subagentDispatchRoutes } from '../src/routes/subagent-dispatch.js'
import { n8nProxyRoutes } from '../src/routes/n8n-proxy.js'

function d(id: string, status: string, createdAt: string) {
  return { id, status, createdAt }
}

describe('G-299① GET /api/subagents/all', () => {
  let app: FastifyInstance
  beforeEach(async () => {
    app = Fastify()
    await app.register(subagentDispatchRoutes, { prefix: '/api' })
    await app.ready()
  })
  afterEach(async () => {
    await app.close()
  })

  it('返回新→旧全量(含 completed/failed),active 子集不得冒充全量', async () => {
    listAllMock.mockReturnValue([
      d('a', 'pending', '2026-09-28T01:00:00Z'),
      d('b', 'completed', '2026-09-28T02:00:00Z'),
      d('c', 'failed', '2026-09-28T03:00:00Z'),
    ])
    const res = await app.inject({ method: 'GET', url: '/api/subagents/all' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.dispatches.map((x: { id: string }) => x.id)).toEqual(['c', 'b', 'a'])
  })
  it('status 与 limit 透传(客户端 agent-teams 页带 limit=200)', async () => {
    listAllMock.mockReturnValue([
      d('a', 'pending', '2026-09-28T01:00:00Z'),
      d('b', 'completed', '2026-09-28T02:00:00Z'),
      d('c', 'completed', '2026-09-28T03:00:00Z'),
    ])
    const res = await app.inject({
      method: 'GET',
      url: '/api/subagents/all?status=completed&limit=1',
    })
    const body = res.json()
    expect(body.data.dispatches).toHaveLength(1)
    expect(body.data.dispatches[0].id).toBe('c')
  })
})

describe('G-299②③ /api/ai/n8n/workflows*(N8N env 未配置档)', () => {
  const saved = { d: process.env.N8N_DOMAIN, k: process.env.N8N_API_KEY }
  let app: FastifyInstance
  beforeEach(async () => {
    delete process.env.N8N_DOMAIN
    delete process.env.N8N_API_KEY
    app = Fastify()
    await app.register(n8nProxyRoutes, { prefix: '/api' })
    await app.ready()
  })
  afterEach(async () => {
    await app.close()
    if (saved.d) process.env.N8N_DOMAIN = saved.d
    if (saved.k) process.env.N8N_API_KEY = saved.k
  })

  it('list 未配置 ⇒ 200 + notAvailable stub(消费方按空态渲染,不判失败)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/ai/n8n/workflows' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.notAvailable).toBe(true)
    expect(body.data.list).toEqual([])
    expect(body.data.source).toBe('unconfigured')
  })
  it('写操作(create/update/toggle)未配置 ⇒ 503,绝不回桩成功', async () => {
    const c = await app.inject({
      method: 'POST',
      url: '/api/ai/n8n/workflows',
      payload: { name: 'x' },
    })
    expect(c.statusCode).toBe(503)
    const u = await app.inject({
      method: 'PUT',
      url: '/api/ai/n8n/workflows/abc',
      payload: { name: 'y' },
    })
    expect(u.statusCode).toBe(503)
    const t = await app.inject({
      method: 'POST',
      url: '/api/ai/n8n/workflows/abc/toggle',
      payload: { active: true },
    })
    expect(t.statusCode).toBe(503)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
