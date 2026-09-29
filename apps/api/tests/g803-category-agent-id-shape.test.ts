// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-803:`GET /api/categories/agent/:agentId` 此前**没有形状闸**,非 uuid 段一路落到
 * `eq(agents.agentId, 'carousel')` —— `agents.agent_id` 是 uuid 列,Postgres 抛
 * `22P02 invalid input syntax for type uuid`,Fastify 兜成 **500**。
 * 同文件 `GET /agents/:agentId`(:450)早就有同一条闸并回 404,这一站是漏站。
 *
 * 三条不变量,与 `agent-detail-malformed-id.test.ts` 同口径:
 *  ① 畸形 id ⇒ **404**(读侧口径,不是写侧的 400),且**查询层一次都没被调用** ——
 *     只断状态码会放过"先查了再判 404"与"授权判定发生在查库之后"两种写法;
 *  ② 这道 404 必须与"分类真不存在"的 404 **逐字段同形**(不得在响应里区分"格式不对"与
 *     "不存在",那是一台存在性预言机);参照物取 `GET /categories/:categoryId` 真查不到
 *     时产出的 404 —— 由**另一个 handler** 产出,而不是拿本路由的实现自证;
 *  ③ 合法 uuid ⇒ 照常进查询层(正向对照,防止这道门只是把功能改坏了)。
 *
 * 关于②的如实登记:本路由对"合法 uuid 但没有分类记录"**历来回 200 + 空 list**
 * (`{list:[],total:0}`),它自己没有任何 404 分支 —— 把那一态改成 404 是对外契约变更,
 * 不在本票"唯一修法"范围内。所以②用同一资源族(分类)的真实 404 做参照,
 * 而"本路由的 not-found 态仍是 200 空表"由 `合法 uuid 无分类 ⇒ 查询层被调一次` 那条钉住。
 *
 * 测试隔离铁律(AGENTS §5):全程不连生产 PostgreSQL(8810)/ Redis(8811)
 * —— 查询层与鉴权层整体桩掉,没有任何 SQL 被发出。
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const { mockAuthenticate, q } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(async (_req: unknown, _reply: unknown, done: () => void) => done()),
  q: {
    findCategoryByAgentId: vi.fn(),
    findCategoryById: vi.fn(),
  },
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
  checkAuth: vi.fn(async () => true),
}))

// 只桩掉这两个出口,其余导出沿用真实模块 —— 路由文件从本模块引了近 40 个具名导出,
// 工厂返回缺名字对象会被 Vitest 判成 "No 'X' export is defined on the mock"。
vi.mock('../src/db/agents-queries.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return { ...actual, ...q }
})

let app: FastifyInstance

beforeAll(
  async () => {
    const { agentsRoutes } = await import('../src/routes/agents.js')
    app = Fastify()
    await app.register(agentsRoutes, { prefix: '/api' })
    await app.ready()
  },
  // 单文件冷跑时,agents.ts 整张依赖图的 transform 就要 13s+,会撞上 vitest.config.ts 的
  // 15s hookTimeout。只在**本文件**放宽,不改共享配置(那会放宽全套件的挂起容忍度)。
  120_000,
)

afterAll(async () => {
  await app?.close()
})

// isUuidString 只问"这串会不会让 uuid 列抛 22P02",不校验版本位/变体位 ——
// 所以这串在本判据下合法(而 z.uuid() 会拒它),这正是"合法 uuid"该用的夹具。
const A_UUID = '11112222-3333-4444-5555-666677778888'
const AGENT_CATEGORY_URL = `/api/categories/agent/${A_UUID}`
const MALFORMED_SEGMENTS = ['carousel', 'definitely-not-a-real-slug-9x7', '1', '%20']

describe('畸形 agentId ⇒ 404 且未发出查询', () => {
  it.each(MALFORMED_SEGMENTS)(
    'GET /api/categories/agent/%s ⇒ 404(不是 400、不是 500)',
    async (seg) => {
      q.findCategoryByAgentId.mockClear()
      const res = await app.inject({ method: 'GET', url: `/api/categories/agent/${seg}` })
      expect(res.statusCode).toBe(404)
      // 未发出查询的证法:spy 落在构造这条 SQL 的那一层(agents-queries),0 次调用 ⇒ SQL 没组起来
      expect(q.findCategoryByAgentId).not.toHaveBeenCalled()
    },
  )

  it('404 响应体不得带上"格式不对"的措辞(否则就是区分了两态)', async () => {
    q.findCategoryByAgentId.mockClear()
    const res = await app.inject({ method: 'GET', url: '/api/categories/agent/carousel' })
    const body = res.json() as { code: number; message: string }
    expect(body.message).not.toMatch(/格式|uuid|invalid input syntax|22P02/i)
  })
})

describe('两态同形的正向证明', () => {
  it('畸形段在本路由的 404,与另一 handler 真查不到分类的 404 逐字段等值', async () => {
    q.findCategoryByAgentId.mockClear()
    q.findCategoryById.mockClear().mockResolvedValue(undefined)

    const malformed = await app.inject({ method: 'GET', url: '/api/categories/agent/carousel' })
    // 参照物:合法 uuid 打进 GET /categories/:categoryId,真查不到 ⇒ 由那个 handler 产出 404
    const genuineMissing = await app.inject({ method: 'GET', url: `/api/categories/${A_UUID}` })

    expect(malformed.statusCode).toBe(404)
    expect(genuineMissing.statusCode).toBe(404)
    expect(q.findCategoryById).toHaveBeenCalledTimes(1)
    expect(q.findCategoryByAgentId).not.toHaveBeenCalled()
    // toStrictEqual:多余的键、undefined 值、原型不同都会红 —— 比 toEqual 更适合"逐字段"
    expect(malformed.json()).toStrictEqual(genuineMissing.json())
    expect(Object.keys(malformed.json() as object).sort()).toStrictEqual(
      Object.keys(genuineMissing.json() as object).sort(),
    )
  })

  it('合法 uuid 但没有分类记录 ⇒ 仍进查询层一次,并保持本路由既有的 200 空表契约', async () => {
    q.findCategoryByAgentId.mockClear().mockResolvedValue(undefined)
    const res = await app.inject({ method: 'GET', url: AGENT_CATEGORY_URL })
    expect(q.findCategoryByAgentId).toHaveBeenCalledTimes(1)
    expect(q.findCategoryByAgentId).toHaveBeenCalledWith(A_UUID)
    expect(res.statusCode).toBe(200)
    expect(res.json()).toStrictEqual({ code: 0, message: 'success', data: { list: [], total: 0 } })
  })
})

describe('正向对照 —— 闸不得把正当请求一起挡掉', () => {
  it('合法 uuid 且查到分类 ⇒ 原样返回', async () => {
    const category = { categoryId: A_UUID, name: '效率办公', status: '1' }
    q.findCategoryByAgentId.mockClear().mockResolvedValue(category)
    const res = await app.inject({ method: 'GET', url: AGENT_CATEGORY_URL })
    expect(q.findCategoryByAgentId).toHaveBeenCalledTimes(1)
    expect(res.statusCode).toBe(200)
    expect(res.json()).toStrictEqual({
      code: 0,
      message: 'success',
      data: { list: [category], total: 1 },
    })
  })
})

describe('判据只许有一份,且闸必须排在 SQL 之前', () => {
  it('agents.ts 不出现第二份 uuid 正则;本路由复用 utils/uuid 的出口', async () => {
    const { readFileSync } = await import('node:fs')
    const { fileURLToPath } = await import('node:url')
    const path = await import('node:path')
    const root = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..')
    const src = readFileSync(path.join(root, 'apps/api/src/routes/agents.ts'), 'utf8')
    expect(src).toContain("from '../utils/uuid.js'")
    expect(src).not.toMatch(/\[0-9a-f\]\{8\}/)
  })

  it('本 handler 体内 isUuidString 的位置必须早于 findCategoryByAgentId', async () => {
    const { readFileSync } = await import('node:fs')
    const { fileURLToPath } = await import('node:url')
    const path = await import('node:path')
    const root = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..')
    const src = readFileSync(path.join(root, 'apps/api/src/routes/agents.ts'), 'utf8')
    const anchor = "server.get('/categories/agent/:agentId'"
    const start = src.indexOf(anchor)
    expect(start).toBeGreaterThan(-1)
    // 截到本 handler 结束(下一个不带缩进的 `  })`),别把 cache/agent 那一站卷进来
    const body = src.slice(start, src.indexOf('\n  })', start))
    const gateAt = body.indexOf('isUuidString(agentId)')
    const queryAt = body.indexOf('findCategoryByAgentId(agentId)')
    expect(gateAt).toBeGreaterThan(-1)
    expect(queryAt).toBeGreaterThan(gateAt)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
