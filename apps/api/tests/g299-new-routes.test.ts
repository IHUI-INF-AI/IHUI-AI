// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-299 路由面的回归锁(2026-09-28 落地;同日按"摘除重复注册"那枚提交改判归属)。
 * ① GET /api/subagents/all —— 全量派单新→旧 + status/limit 透传(消费者 agent-teams 页);
 * ② /api/ai/n8n/workflows 四操作(list/create/update/toggle)全归 n8n-proxy(2026-10-02 合并收口,
 *    此前 list/create 在 proxy-tools)—— 钉"list 未配置 200 空态 + notAvailable、create 未配置 503
 *    ∧ proxy-tools 不再含该路径字面量(单实现,防回迁撞 FST_ERR_DUPLICATED_ROUTE)";
 * ③ 写操作(create/update/toggle)未配置 ⇒ 503(桩成功=把没判写成判过了,绝不)。
 * 全程不连库不发网络(vi.mock 服务与鉴权;§5 测试隔离铁律)。
 */
import { readFileSync } from 'node:fs'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

// authenticate 做成可变 mock:默认成功(n8n 面同吃本 mock,不得改坏其用例);
// G-299① 鉴权闸用例用 mockImplementationOnce 覆写一次抛 401,用完自动回默认。
const { authenticateMock } = vi.hoisted(() => ({
  authenticateMock: vi.fn(async (request: { userId?: string }) => {
    request.userId = 'probe-user'
  }),
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: authenticateMock,
  checkAuth: async () => true,
}))

// n8n 面走真实透传(safeFetch),成功路径用例在配置在位时把 safeFetch 替成可控桩,
// 验证 fetch-merge-put / activate-deactivate+回读 真的把请求发向上游且把真值回包。
const { safeFetchMock } = vi.hoisted(() => ({ safeFetchMock: vi.fn() }))
vi.mock('../src/utils/ssrf-guard.js', () => ({
  ensureSafeFetchUrl: async () => undefined,
  safeFetch: (url: string, init?: { method?: string }) => safeFetchMock(url, init),
}))

const listAllMock = vi.fn()
vi.mock('../src/services/subagent-dispatch-service.js', () => ({
  subagentDispatchService: {
    setRedisClient: async () => undefined,
    listAll: () => listAllMock(),
    listActive: () => [],
    // /all 路由逐行取 getDispatchStats/getDag(buildFleetRow 的统计输入);
    // 方法缺位 ⇒ TypeError ⇒ 500,会把"mock 烂了"写成"路由坏了"。null 档 =
    // "统计取不到 ⇒ 行不带 metrics"(buildFleetRow 契约),本票只钉列表形状,不测 metrics。
    getDispatchStats: () => null,
    getDag: () => null,
  },
}))
vi.mock('../src/db/agent-queries.js', () => ({ findAgentTasksByAgentId: async () => [] }))

import { subagentDispatchRoutes } from '../src/routes/subagent-dispatch.js'
import { n8nProxyRoutes } from '../src/routes/n8n-proxy.js'
import { toolsVendorRoutes } from '../src/routes/ai-vendors/proxy-tools.js'

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

  it('返回新→旧全量(含 completed/failed/cancelled),active 子集不得冒充全量', async () => {
    listAllMock.mockReturnValue([
      d('a', 'pending', '2026-09-28T01:00:00Z'),
      d('b', 'completed', '2026-09-28T02:00:00Z'),
      d('c', 'failed', '2026-09-28T03:00:00Z'),
      d('d', 'cancelled', '2026-09-28T04:00:00Z'),
    ])
    const res = await app.inject({ method: 'GET', url: '/api/subagents/all' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.dispatches.map((x: { id: string }) => x.id)).toEqual(['d', 'c', 'b', 'a'])
    // 消费者(agent-teams 页)按状态直读列表,四类状态必须同面返回(缺一即"页面少了历史")
    expect(body.data.dispatches.map((x: { status: string }) => x.status)).toEqual(
      expect.arrayContaining(['pending', 'completed', 'failed', 'cancelled']),
    )
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

  it('鉴权闸:未登录 ⇒ 401 且不触达 service(副作用没发生)', async () => {
    // authenticate 抛带 statusCode 的错 ⇒ requireAuth 按 401 回包;闸在 service 之前
    authenticateMock.mockImplementationOnce(async () => {
      throw Object.assign(new Error('未登录'), { statusCode: 401 })
    })
    listAllMock.mockClear()
    const res = await app.inject({ method: 'GET', url: '/api/subagents/all' })
    expect(res.statusCode).toBe(401)
    const body = res.json()
    expect(body.code).toBe(401)
    expect(listAllMock).not.toHaveBeenCalled()
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

  // 归属事实(2026-10-02 合并收口):GET list 与 POST create 已自 ai-vendors/proxy-tools.ts
  // 迁入本面,四操作(list/create/update/toggle)全在此 —— 同路径只能有一个实现,
  // 并存 ⇒ Fastify 启动即抛 FST_ERR_DUPLICATED_ROUTE(2026-09-27 实测整个后端下线)。
  // 未配置档按客户端契约定形:list 200 空态 + notAvailable(读操作不谎报"已执行",
  // 与 miniapp-compat /workflows/n8n 同语义)、create 503(写操作绝不桩成功)。
  it('list 未配置 ⇒ 200 空态 + notAvailable;create 未配置 ⇒ 503(写不桩成功)', async () => {
    const g = await app.inject({ method: 'GET', url: '/api/ai/n8n/workflows' })
    expect(g.statusCode).toBe(200)
    const body = g.json()
    expect(body.code).toBe(0)
    expect(Array.isArray(body.data?.list)).toBe(true)
    expect(body.data?.list?.length).toBe(0)
    expect(body.data?.total).toBe(0)
    expect(body.data?.notAvailable).toBe(true)
    const p = await app.inject({
      method: 'POST',
      url: '/api/ai/n8n/workflows',
      payload: { name: 'x' },
    })
    expect(p.statusCode).toBe(503)
  })

  it('反向锁:proxy-tools 不再注册 /n8n/workflows(单实现,防回迁撞车)', () => {
    // 数的是带引号的路径字面量 —— 叙述注释里出现的裸 /n8n/workflows 不带引号,不计。
    const proxyTools = readFileSync(
      new URL('../src/routes/ai-vendors/proxy-tools.ts', import.meta.url),
      'utf8',
    )
    expect(proxyTools.split("'/n8n/workflows'").length - 1).toBe(0)
  })

  it('双插件并存不得抛 FST_ERR_DUPLICATED_ROUTE(合并消除撞车源头的机器证明)', async () => {
    // 2026-09-27 事故本源:两个文件同时注册 `/api/ai/n8n/workflows` ⇒ Fastify 启动即抛、
    // 整个后端下线。合并(单实现)后两插件并存必须能 ready —— 这一条就是那次事故的反向锁。
    const combo = Fastify()
    await combo.register(n8nProxyRoutes, { prefix: '/api' })
    await combo.register(toolsVendorRoutes, { prefix: '/api/ai' })
    await expect(combo.ready()).resolves.toBeDefined()
    await combo.close()
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

describe('G-02②③ n8n 成功路径(配置在位时真透传 fetch-merge-put / activate+回读)', () => {
  // 与上一组"未配置 ⇒ 503"互补:本组把 N8N_DOMAIN+N8N_API_KEY 置位、safeFetch 替成可控桩,
  // 钉"配置成功时请求真的发向上游、且把上游真值(非请求值)回包"。n8n 面不吃用户鉴权
  // (改用 X-N8N-API-KEY + SSRF 校验),故无 401 闸 —— 既有约定如此,不补假鉴权。
  const saved = {
    d: process.env.N8N_DOMAIN,
    k: process.env.N8N_API_KEY,
  }
  let app: FastifyInstance
  beforeEach(async () => {
    process.env.N8N_DOMAIN = 'https://n8n.example.com'
    process.env.N8N_API_KEY = 'test-key'
    // url 形如 `${origin}/api/v1/workflows/abc`(或 .../abc/activate)。
    safeFetchMock.mockImplementation(async (url: string, init?: { method?: string }) => {
      const method = (init?.method ?? 'GET').toUpperCase()
      const ok = (data: unknown) => ({ ok: true, status: 200, json: async () => data })
      if (url.includes('/activate') || url.includes('/deactivate')) return ok({})
      if (url.endsWith('/api/v1/workflows/abc')) {
        if (method === 'GET') return ok({ id: 'abc', name: 'orig', active: true })
        if (method === 'PUT') return ok({ id: 'abc', name: 'new-name', active: false })
      }
      return { ok: false, status: 500, json: async () => ({}) }
    })
    app = Fastify()
    await app.register(n8nProxyRoutes, { prefix: '/api' })
    await app.ready()
  })
  afterEach(async () => {
    await app.close()
    safeFetchMock.mockReset()
    if (saved.d) process.env.N8N_DOMAIN = saved.d
    else delete process.env.N8N_DOMAIN
    if (saved.k) process.env.N8N_API_KEY = saved.k
    else delete process.env.N8N_API_KEY
  })

  it('PUT :id 成功:先 GET 现件→合并 name→PUT 回,回包用上游真值', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/ai/n8n/workflows/abc',
      payload: { name: 'new-name' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    // 回包形状与下游契约同(N8nModelScreen 读 data.id/name/active)
    expect(body.data.id).toBe('abc')
    expect(body.data.name).toBe('new-name')
    expect(body.data.active).toBe(false)
    // fetch-merge-put:PUT 真把合并后的 name 发向上游(不是部分字段 PATCH)
    const putCall = safeFetchMock.mock.calls.find(
      (c) => (c[1]?.method ?? 'GET').toUpperCase() === 'PUT',
    )
    expect(putCall).toBeTruthy()
    const sent = JSON.parse((putCall![1] as { body: string }).body)
    expect(sent.name).toBe('new-name')
  })

  it('POST toggle 成功:activate 后回读真值(active 取上游而非请求值背书)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/ai/n8n/workflows/abc/toggle',
      payload: { active: true },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.success).toBe(true)
    // 回读上游 active=true(请求值只驱动选 activate 端点,不替结果背书)
    expect(body.data.active).toBe(true)
    // activate 端点确实被命中
    const activateCall = safeFetchMock.mock.calls.find((c) =>
      (c[0] as string).includes('/activate'),
    )
    expect(activateCall).toBeTruthy()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
