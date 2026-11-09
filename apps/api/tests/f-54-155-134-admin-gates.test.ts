// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-54 / F-155 / F-134 回归锁(2026-11-08,apps/api P1 越权组)。
 *
 * 三条共同点:路由本身只有 `authenticate`,普通登录用户即可触达
 * 本应管理员专用的跨租户读/写面。判据:非管理员请求 403,且**下游函数零调用**
 * (不是只看状态码);管理员请求能通过闸门到达下游。
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import Fastify from 'fastify'

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgres://127.0.0.1:5399/test',
    REDIS_URL: 'redis://127.0.0.1:6399',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    AI_SERVICE_URL: 'http://mock-ai-service:8803',
  },
}))
vi.mock('../src/db/index.js', () => ({ db: {}, dbRead: {} }))

// 鉴权由夹具的 onRequest 注入身份,authenticate 只需放行
vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(async () => undefined),
}))

// 真实 requireAdmin 的行为:roleId < 1 → 403
vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdmin: async (
    request: { jwtPayload?: { roleId?: number } },
    reply: { status: (n: number) => { send: (b: unknown) => unknown } },
  ) => {
    if ((request.jwtPayload?.roleId ?? 0) < 1) {
      return reply.status(403).send({ code: 403, message: '无权限' })
    }
    return undefined
  },
}))

const spies = vi.hoisted(() => ({
  findCozeChatHistory: vi.fn(),
  findMyMember: vi.fn(),
  sanitizeUgcInput: vi.fn((s: string) => s),
  recordBudgetUsage: vi.fn(),
  resetPillarDegradation: vi.fn(),
  updateBudgetConfig: vi.fn(),
  getRecentTraces: vi.fn(),
  getTraceDetail: vi.fn(),
}))

vi.mock('../src/db/coze-chat-queries.js', () => ({
  findCozeChatHistory: spies.findCozeChatHistory,
}))
vi.mock('../src/db/my-member-queries.js', () => ({ findMyMember: spies.findMyMember }))
vi.mock('../src/db/sensitive-words-queries.js', () => ({
  sanitizeUgcInput: spies.sanitizeUgcInput,
}))
vi.mock('../src/db/social-queries.js', () => ({
  countSubscribers: vi.fn(),
  findTagById: vi.fn(),
  isSubscribed: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
}))
vi.mock('../src/routes/user/_shared.js', () => ({
  parsePagination: vi.fn(() => ({ page: 1, pageSize: 20 })),
}))
vi.mock('../src/services/orchestration-service.js', () => ({
  getHubStatus: vi.fn(),
  getHubDashboard: vi.fn(),
  getEventFeed: vi.fn(),
  emitEvent: vi.fn(),
  getEventStats: vi.fn(),
  getPlaybooks: vi.fn(),
  togglePlaybook: vi.fn(),
  getDecisions: vi.fn(),
  recordBudgetUsage: spies.recordBudgetUsage,
  checkBudget: vi.fn(),
  getBudgetSummary: vi.fn(),
  getBudgetTrend: vi.fn(),
  getPillarBudget: vi.fn(),
  resetPillarDegradation: spies.resetPillarDegradation,
  updateBudgetConfig: spies.updateBudgetConfig,
  getCostBreakdown: vi.fn(),
  getMetrics: vi.fn(),
  getTelemetryHealth: vi.fn(),
  getTelemetryDashboard: vi.fn(),
  getRecentTraces: spies.getRecentTraces,
  getTraceDetail: spies.getTraceDetail,
}))

import memberRoutes from '../src/routes/user/member-routes.js'
import topicsRoutes from '../src/routes/community/topics.js'
import { orchestrationRoutes } from '../src/routes/orchestration.js'

function makeServer() {
  const server = Fastify({ logger: false })
  server.decorateRequest('userId', null)
  server.decorateRequest('jwtPayload', null)
  server.addHook('onRequest', async (request) => {
    const role = Number(request.headers['x-test-role'] ?? 0)
    request.userId = String(request.headers['x-test-user'] ?? 'user-1')
    ;(request as unknown as { jwtPayload: unknown }).jwtPayload = { roleId: role }
  })
  return server
}

describe('F-54 coze 聊天历史:端点已下线(404)', () => {
  const server = makeServer()
  beforeAll(async () => {
    await server.register(memberRoutes)
    await server.ready()
  })
  afterAll(async () => server.close())
  afterEach(() => vi.clearAllMocks())

  // F-54:表无属主列,归属无法判定 ⇒ 端点整体下线(不是按管理员放行);
  // 任何角色都拿 404,且不得触达下游查询。
  it.each([['0'], ['9']])('角色 roleId=%s 也是 404,且下游查询零调用', async (role) => {
    const res = await server.inject({
      method: 'GET',
      url: '/coze/chat/history/bot-1/conv-1',
      headers: { 'x-test-role': role },
    })
    expect(res.statusCode).toBe(404)
    expect(spies.findCozeChatHistory).toHaveBeenCalledTimes(0)
  })
})

describe('F-155 circle_dynamic 写接口:管理员闸门', () => {
  const server = makeServer()
  beforeAll(async () => {
    await server.register(topicsRoutes)
    await server.ready()
  })
  afterAll(async () => server.close())
  afterEach(() => vi.clearAllMocks())

  it('普通用户创建话题 403,且 sanitize 与落库均零调用', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/circles/topic',
      headers: { 'x-test-role': '0' },
      body: { content: '伪造', circleId: 1, memberId: 999, title: 't' },
    })
    expect(res.statusCode).toBe(403)
    expect(spies.sanitizeUgcInput).toHaveBeenCalledTimes(0)
  })

  it('普通用户改/删他人话题 403', async () => {
    const put = await server.inject({
      method: 'PUT',
      url: '/circles/topic/123',
      headers: { 'x-test-role': '0' },
      body: { content: '篡改' },
    })
    const del = await server.inject({
      method: 'DELETE',
      url: '/circles/topic/123',
      headers: { 'x-test-role': '0' },
    })
    expect(put.statusCode).toBe(403)
    expect(del.statusCode).toBe(403)
  })
})

describe('F-134 orchestration 预算/遥测:管理员闸门', () => {
  const server = makeServer()
  beforeAll(async () => {
    await server.register(orchestrationRoutes)
    await server.ready()
  })
  afterAll(async () => server.close())
  afterEach(() => vi.clearAllMocks())

  it.each([
    ['POST', '/orchestration/budget/record', { pillar: 'budget', tokens: 1 }],
    ['POST', '/orchestration/budget/pillar/budget/reset', {}],
    ['PATCH', '/orchestration/budget/config', {}],
    ['GET', '/orchestration/telemetry/traces', undefined],
    ['GET', '/orchestration/telemetry/traces/abc', undefined],
  ])('普通用户 %s %s → 403 且下游零调用', async (method, url, body) => {
    const res = await server.inject({
      method: method as 'GET',
      url,
      headers: { 'x-test-role': '0' },
      body: body as Record<string, unknown> | undefined,
    })
    expect(res.statusCode).toBe(403)
    expect(spies.recordBudgetUsage).toHaveBeenCalledTimes(0)
    expect(spies.resetPillarDegradation).toHaveBeenCalledTimes(0)
    expect(spies.updateBudgetConfig).toHaveBeenCalledTimes(0)
    expect(spies.getRecentTraces).toHaveBeenCalledTimes(0)
    expect(spies.getTraceDetail).toHaveBeenCalledTimes(0)
  })

  it('管理员读取 traces 可通过闸门', async () => {
    spies.getRecentTraces.mockResolvedValue([])
    const res = await server.inject({
      method: 'GET',
      url: '/orchestration/telemetry/traces',
      headers: { 'x-test-role': '9' },
    })
    expect(res.statusCode).toBe(200)
    expect(spies.getRecentTraces).toHaveBeenCalledTimes(1)
  })
})
