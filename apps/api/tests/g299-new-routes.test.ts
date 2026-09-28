// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-299 路由面的回归锁(2026-09-28 落地;同日按"摘除重复注册"那枚提交改判归属)。
 * ① GET /api/subagents/all —— 全量派单新→旧 + status/limit 透传(消费者 agent-teams 页);
 * ② /api/ai/n8n/workflows 的 list/create 归 ai-vendors/proxy-tools.ts —— 本面再注册会让
 *    Fastify 启动即抛 FST_ERR_DUPLICATED_ROUTE,所以钉"本面 404 ∧ proxy-tools 那两条在位";
 * ③ PUT :id 与 POST :id/toggle 归 n8n-proxy —— env 未配置 ⇒ 503(桩成功=把没判写成判过了,绝不)。
 * 全程不连库不发网络(vi.mock 服务与鉴权;§5 测试隔离铁律)。
 */
import { readFileSync } from 'node:fs'
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

describe('G-299②③ /api/ai/n8n/workflows*(路由归属 + 未配置档)', () => {
  // issue #71 之后,n8n-proxy 面的基址认两个名字(N8N_DOMAIN 主名 + N8N_BASE_URL 别名)。
  // "未配置 ⇒ 503" 这两条例子的前提因此必须是**两个名字都不在位**,只删一个就成了
  // "别名还在位却期待 503"的假红(反过来,只测一个名字也钉不出别名已生效)。
  const saved = {
    d: process.env.N8N_DOMAIN,
    b: process.env.N8N_BASE_URL,
    k: process.env.N8N_API_KEY,
  }
  let app: FastifyInstance
  beforeEach(async () => {
    delete process.env.N8N_DOMAIN
    delete process.env.N8N_BASE_URL
    delete process.env.N8N_API_KEY
    app = Fastify()
    await app.register(n8nProxyRoutes, { prefix: '/api' })
    await app.ready()
  })
  afterEach(async () => {
    await app.close()
    if (saved.d) process.env.N8N_DOMAIN = saved.d
    else delete process.env.N8N_DOMAIN
    if (saved.b) process.env.N8N_BASE_URL = saved.b
    else delete process.env.N8N_BASE_URL
    if (saved.k) process.env.N8N_API_KEY = saved.k
    else delete process.env.N8N_API_KEY
  })

  // 归属事实(2026-09-28 摘除重复注册那枚提交的现行口径):GET 与 POST
  // `/api/ai/n8n/workflows` 由 ai-vendors/proxy-tools.ts 服务,本面只提供 PUT :id
  // 与 POST :id/toggle。两处并存 ⇒ Fastify 启动即抛 FST_ERR_DUPLICATED_ROUTE
  // (实测 IHUI-API 反复退出、8802 无监听),所以"本面把 list/create 又注册回来"
  // 必须是红的 —— 用 404 钉住,而不是去断言被摘掉的那套 stub/503 语义。
  // 两侧语义并不等价(proxy-tools 的 GET 读 N8N_BASE_URL 且未配置回 503、POST 是
  // "凭据从请求体传入"的查询;本面原设计是 N8N_DOMAIN + 未配置 stub),统一哪一边
  // 属对外契约决策,归该面持有者,不由测试替它拍板。
  it('本面不得注册 list/create(与 proxy-tools 同路径并存即启动崩)', async () => {
    const g = await app.inject({ method: 'GET', url: '/api/ai/n8n/workflows' })
    expect(g.statusCode).toBe(404)
    const p = await app.inject({
      method: 'POST',
      url: '/api/ai/n8n/workflows',
      payload: { name: 'x' },
    })
    expect(p.statusCode).toBe(404)
    // 反向锁:摘除不得退化成"两边都没有"(那样消费方拿到 404 而不是任何错误语义)。
    // 数的是带引号的路径字面量 —— 叙述注释里出现的裸 /n8n/workflows 不带引号,不计。
    const proxyTools = readFileSync(
      new URL('../src/routes/ai-vendors/proxy-tools.ts', import.meta.url),
      'utf8',
    )
    expect(proxyTools.split("'/n8n/workflows'").length - 1).toBeGreaterThanOrEqual(2)
  })

  it('PUT :id 与 POST toggle 未配置 ⇒ 503,绝不回桩成功', async () => {
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
