// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * /api/llm/models 在「身份取不到」那一档必须收紧(fail-closed,2026-10-31 立)。
 *
 * 为什么单开一份:真鉴权链 authenticate() 会先把主体钉成 uuid 形态,拿不到 uuid 直接 401,
 * 所以"通过鉴权却没有 request.userId"这条态在生产路径上构造不出来 —— 它恰恰是本缺陷
 * 历史上真实存在的那条态:`getUserUuid()` 读 `request.user`,而承载层写的是 `request.userId`,
 * 于是判定眼里"人人无身份",旧写法 `if (userUuid && ...)` 把无身份读成"不用过滤"。
 *
 * 本文件把承载层换成三种桩,正面钉住路由自己的取值与收紧方向:
 *   A 只写 request.user(旧缺陷的现场复现)⇒ 仍须过滤;摘掉新判定即翻红;
 *   B 什么都不写                      ⇒ 仍须过滤,且不得拿伪主键去查管理员表;
 *   C 写 request.userId=管理员 + 管理员位真  ⇒ 不过滤(证明 B 不是"恒过滤"的假绿)。
 *
 * 判据同源提醒:B 档"seen 为空"这条断言的意义是——若将来有人加
 * `isSystemAdminUser(userUuid || '')` 这种"空串也去查一次"的写法,查不到返回 false 恰好
 * 也得到"过滤"的对结论,但那是蒙的;本断言把"蒙对"钉成红。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify'

const ADMIN_ID = '00000000-0000-4000-8000-000000000001'

const mocks = vi.hoisted(() => ({
  checkAuth: vi.fn(),
  isSystemAdminUser: vi.fn(),
  fetch: vi.fn(),
}))

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://mock-ai-service:8803',
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(32),
  },
}))

// 路由从 plugins/auth.js 取 checkAuth;这一档要控制的是"承载层写了哪个字段",
// 所以整枚替换掉真鉴权(真鉴权链的正反例在 llm-models-restricted-filter-authorization.test.ts)
vi.mock('../src/plugins/auth.js', () => ({
  checkAuth: mocks.checkAuth,
}))

vi.mock('../src/db/queries.js', () => ({
  isSystemAdminUser: mocks.isSystemAdminUser,
}))

function createChainableMock() {
  const thenFn = (resolve: (v: unknown) => void) => Promise.resolve([]).then(resolve)
  const make = (): Record<string, unknown> =>
    new Proxy({} as Record<string, unknown>, {
      get(_target, prop: string) {
        if (prop === 'then') return thenFn
        return vi.fn().mockReturnValue(make())
      },
    })
  return make()
}

vi.mock('../src/db/index.js', () => ({
  db: { select: vi.fn(() => createChainableMock()), execute: vi.fn().mockResolvedValue([]) },
  dbRead: {},
  dbClient: {},
}))

const { llmModelsRoutes } = await import('../src/routes/llm-models.js')

const UPSTREAM_MODELS = [
  { id: 'deepseek-chat', name: 'DeepSeek Chat', provider: 'deepseek' },
  { id: 'xai/grok-4', name: 'Grok 4', provider: 'xai' },
]

/** 用给定"承载层写法"跑一次 /models,回可见模型 id 与管理员表被问到的参数 */
async function runWithCarrier(writeIdentity: (req: FastifyRequest) => void): Promise<{
  ids: string[]
  adminLookups: unknown[]
  status: number
}> {
  const server = Fastify({ logger: false })
  const adminLookups: unknown[] = []
  mocks.isSystemAdminUser.mockImplementation((id: unknown) => {
    adminLookups.push(id)
    return Promise.resolve(id === ADMIN_ID)
  })
  mocks.checkAuth.mockImplementation(async (req: FastifyRequest, reply: FastifyReply) => {
    writeIdentity(req)
    void reply
    return true
  })
  mocks.fetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ models: UPSTREAM_MODELS, default: 'x' }),
    text: async () => '',
  })
  globalThis.fetch = mocks.fetch as unknown as typeof globalThis.fetch

  await server.register(llmModelsRoutes, { prefix: '/api/llm' })
  await server.ready()
  const res = await server.inject({ method: 'GET', url: '/api/llm/models' })
  await server.close()

  const body = res.json() as { data?: { models?: Array<{ id: string }> } }
  return {
    status: res.statusCode,
    ids: (body.data?.models ?? []).map((m) => m.id),
    adminLookups,
  }
}

describe('/api/llm/models 身份缺失时收紧', () => {
  beforeEach(() => {
    mocks.checkAuth.mockReset()
    mocks.isSystemAdminUser.mockReset()
    mocks.fetch.mockReset()
  })

  it('A 承载层只写 request.user(旧缺陷现场)⇒ 仍过滤,不再把红线交回给错字段', async () => {
    const r = await runWithCarrier((req) => {
      ;(req as unknown as { user?: { id: string } }).user = { id: ADMIN_ID }
    })

    expect(r.status).toBe(200)
    expect(r.ids).toEqual(['xai/grok-4'])
  })

  it('B 承载层什么都不写 ⇒ 仍过滤,且不拿伪主键去查管理员表', async () => {
    const r = await runWithCarrier(() => {})

    expect(r.status).toBe(200)
    expect(r.ids).toEqual(['xai/grok-4'])
    expect(r.adminLookups).toEqual([])
  })

  it('C 正向对照:真写入 request.userId 且管理员位为真 ⇒ 全量透传', async () => {
    const r = await runWithCarrier((req) => {
      req.userId = ADMIN_ID
    })

    expect(r.status).toBe(200)
    expect(r.ids).toEqual(['deepseek-chat', 'xai/grok-4'])
    expect(r.adminLookups).toEqual([ADMIN_ID])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
