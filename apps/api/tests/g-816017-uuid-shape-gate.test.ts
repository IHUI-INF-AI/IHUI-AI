// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-816017:uuid 形状闸的四处同型漏站(与刚落地的 G-803 同族同病)。
 *
 * 病灶:`agents.agent_id` / `agent_categories.category_id` 是 uuid 列,畸形段喂给 `eq()`
 * 会让 Postgres 抛 22P02,Fastify 兜成 **500** —— "不存在"与"服务坏了"在响应上同形。
 * 本票收口的四处(行号按修复前 HEAD):
 *  ① GET /categories/:categoryId      — findCategoryById 前无闸 ⇒ 补 404 '分类不存在'
 *     (照读本 handler 自己的 not-found 文案,读侧口径,G-803 同款)。
 *  ② GET /categories/cache/agent/:agentId — 票面曾写"走 Redis 不碰 SQL 所以不算",已实测
 *     推翻:缓存未命中时照样裸调 findCategoryByAgentId。本路由**没有** not-found 分支
 *     (合法 uuid 查不到回 200 {category:undefined}),改 404 属对外契约变更需另拍 ⇒
 *     畸形按本文件既有 400 文案回 400。
 *  ③ GET /categories/cache/category/:categoryId — 同上未命中裸调 findCategoryById;
 *     本 handler 自带 not-found 404 ⇒ 畸形照读回 404,与 ①/真查不到的 404 同形。
 *  ④ GET /:agentId/details — agentIdParam 是 z.string()(:346),safeParse 对任意非空串
 *     必过 ⇒ 畸形照打 findAgentById;照读本 handler :2436 的 404 '智能体不存在'。
 *
 * 两处 cache 闸必须排在 `if (!redis) ⇒ 503` **之前**(票面口径):形状是否合法与基础设施
 * 在不在无关,放后面会让同一畸形请求的答案取决于 Redis 状态,而且本机没 redis 时那条分支
 * 永远测不到。本文件用 with-redis / without-redis 两台 app 成对钉住该次序。
 *
 * 三条不变量(沿 g803-category-agent-id-shape.test.ts 同口径):
 *  ① 畸形 ⇒ 预期码且**查询层一次都没被调用**(只断状态码会放过"先查了再判");
 *  ② 有 not-found 分支的站点(①③④),畸形 404 与"真不存在"404 逐字段同形(不得做存在性预言机);
 *     ②无 not-found 可照读 ⇒ 正向对照只断"不进 404 且查询层被调一次"。
 *  ③ 合法 uuid ⇒ 照常进查询层(正向对照,防止闸把功能一起改坏)。
 *
 * 已知覆盖边界(如实登记):④ 的"合法且查到 ⇒ 200"路径在 detail 之后还接一段 stats 聚合查询
 * (第二查询层),不在本票闸的范围,正向对照取"合法 ⇒ 抵达查询层一次"即钉住闸不误伤;
 * 真库 22P02 的端到端取证未在本文件做(测试隔离铁律禁止连生产库)。
 *
 * 测试隔离铁律(AGENTS §5):全程不连生产 PostgreSQL(8810)/ Redis(8811)—— 查询层与鉴权层
 * 整体桩掉,没有任何 SQL 被发出;redis 是 vi.fn 假对象,没有任何网络访问。
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const { mockAuthenticate, q, svc, makeRedis } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(async (_req: unknown, _reply: unknown, done: () => void) => done()),
  q: {
    findCategoryById: vi.fn(),
    findCategoryByAgentId: vi.fn(),
  },
  svc: {
    getAgentDetail: vi.fn(),
  },
  makeRedis: (raw: string | null = null) => ({
    get: vi.fn(async () => raw),
    set: vi.fn(async () => 'OK'),
  }),
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
  checkAuth: vi.fn(async () => true),
}))

// 只桩掉这几个出口,其余导出沿用真实模块 —— 路由文件从 agents-queries 引了近 40 个具名导出,
// 工厂返回缺名字对象会被 Vitest 判成 "No 'X' export is defined on the mock"(g803 同课)。
vi.mock('../src/db/agents-queries.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return { ...actual, ...q }
})

// ④ 的正向/畸形对照都只看闸是否放行到服务层;服务层之下才是组 SQL 的那一层,
// 而真跑它会连带 stats 聚合查询(需要 DB)—— 所以 spy 落在 handler 直接调用的边界上,
// "getAgentDetail 未被调用"即证明没有任何 SQL 组起来。
vi.mock('../src/services/agent-service.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return { ...actual, ...svc }
})

let appRedis: FastifyInstance
let appNoRedis: FastifyInstance

beforeAll(
  async () => {
    const { agentsRoutes } = await import('../src/routes/agents.js')
    // with-redis:在 register **之前** decorate(封装上下文按创建链继承根装饰,request.server 指根)
    appRedis = Fastify()
    appRedis.decorate('redis', makeRedis())
    await appRedis.register(agentsRoutes, { prefix: '/api' })
    await appRedis.ready()
    // without-redis:不装饰 ⇒ request.server.redis 为 undefined,路由走 503 分支
    appNoRedis = Fastify()
    await appNoRedis.register(agentsRoutes, { prefix: '/api' })
    await appNoRedis.ready()
  },
  // 冷跑时 agents.ts 整张依赖图的 transform 就要 13s+,会撞上 vitest.config.ts 的 15s hookTimeout。
  // 只在**本文件**放宽,不改共享配置(g803 同口径)。
  120_000,
)

afterAll(async () => {
  await appRedis?.close()
  await appNoRedis?.close()
})

// isUuidString 只问"会不会让 uuid 列抛 22P02",不校验版本位 —— 这串在本判据下合法(而 z.uuid() 会拒)。
const A_UUID = '11112222-3333-4444-5555-666677778888'
const MALFORMED = ['carousel', 'definitely-not-a-real-slug-9x7', '1', '%20']

function clearAll() {
  q.findCategoryById.mockReset().mockResolvedValue(undefined)
  q.findCategoryByAgentId.mockReset().mockResolvedValue(undefined)
  svc.getAgentDetail.mockReset().mockResolvedValue(null)
}

describe('① GET /categories/:categoryId —— 畸形 ⇒ 404 且未发出查询', () => {
  it.each(MALFORMED)('畸形段 %s ⇒ 404(不是 500)', async (seg) => {
    clearAll()
    const res = await appRedis.inject({ method: 'GET', url: `/api/categories/${seg}` })
    expect(res.statusCode).toBe(404)
    expect(q.findCategoryById).not.toHaveBeenCalled()
  })

  it('空串:路由层就进不了参数段 ⇒ 404、绝不 500、查询层未被调用;体内空串路径由判据钉', async () => {
    clearAll()
    const res = await appRedis.inject({ method: 'GET', url: '/api/categories/' })
    expect(res.statusCode).toBe(404)
    expect(res.statusCode).toBeLessThan(500)
    expect(q.findCategoryById).not.toHaveBeenCalled()
    // 空串若真抵达 handler(如内部复用),isUuidString('')===false 保证同一道闸仍拦得住。
    const { isUuidString } = await import('../src/utils/uuid.js')
    expect(isUuidString('')).toBe(false)
  })

  it('两态同形:畸形 404 与"合法 uuid 真查不到"的 404 逐字段等值', async () => {
    clearAll()
    q.findCategoryById.mockResolvedValue(undefined)
    const malformed = await appRedis.inject({ method: 'GET', url: '/api/categories/carousel' })
    const missing = await appRedis.inject({ method: 'GET', url: `/api/categories/${A_UUID}` })
    expect(missing.statusCode).toBe(404)
    expect(q.findCategoryById).toHaveBeenCalledTimes(1)
    expect(malformed.json()).toStrictEqual(missing.json())
  })

  it('正向对照:合法 uuid 且查到 ⇒ 原契约不变(200 透传分类)', async () => {
    clearAll()
    const category = { categoryId: A_UUID, name: '效率办公', status: '1' }
    q.findCategoryById.mockResolvedValue(category)
    const res = await appRedis.inject({ method: 'GET', url: `/api/categories/${A_UUID}` })
    expect(q.findCategoryById).toHaveBeenCalledWith(A_UUID)
    expect(res.statusCode).toBe(200)
    expect(res.json()).toStrictEqual({ code: 0, message: 'success', data: category })
  })
})

describe('② GET /categories/cache/agent/:agentId —— 畸形 ⇒ 400 且 Redis/查询层都未被触碰', () => {
  it.each(MALFORMED)('有 Redis 时畸形段 %s ⇒ 400,redis.get 与查询层都零调用', async (seg) => {
    clearAll()
    const redis = makeRedis()
    ;(appRedis as unknown as { redis: unknown }).redis = redis
    const res = await appRedis.inject({ method: 'GET', url: `/api/categories/cache/agent/${seg}` })
    expect(res.statusCode).toBe(400)
    expect(redis.get).not.toHaveBeenCalled()
    expect(q.findCategoryByAgentId).not.toHaveBeenCalled()
  })

  it('闸排在 Redis 判断之前:无 Redis 时畸形段仍 400(而不是 503),答案不随基础设施漂移', async () => {
    clearAll()
    const res = await appNoRedis.inject({ method: 'GET', url: '/api/categories/cache/agent/carousel' })
    expect(res.statusCode).toBe(400)
    expect(q.findCategoryByAgentId).not.toHaveBeenCalled()
  })

  it('无 Redis 时合法 uuid 仍 503(既有基础设施契约不被闸吞掉)', async () => {
    clearAll()
    const res = await appNoRedis.inject({
      method: 'GET',
      url: `/api/categories/cache/agent/${A_UUID}`,
    })
    expect(res.statusCode).toBe(503)
  })

  it('票面口径的正向对照:有 Redis、合法 uuid、未命中 ⇒ 不进 404 且查询层被调一次', async () => {
    clearAll()
    const redis = makeRedis(null)
    ;(appRedis as unknown as { redis: unknown }).redis = redis
    q.findCategoryByAgentId.mockResolvedValue(undefined)
    const res = await appRedis.inject({ method: 'GET', url: `/api/categories/cache/agent/${A_UUID}` })
    expect(res.statusCode).toBe(200)
    expect(q.findCategoryByAgentId).toHaveBeenCalledTimes(1)
    expect(q.findCategoryByAgentId).toHaveBeenCalledWith(A_UUID)
    const body = res.json() as { code: number; data: { cached: boolean } }
    expect(body.data.cached).toBe(false)
  })

  it('命中缓存 ⇒ cached:true 且查询层零调用(原缓存短路契约不变)', async () => {
    clearAll()
    const category = { categoryId: A_UUID, name: 'AI 绘画', status: '1' }
    const redis = makeRedis(JSON.stringify(category))
    ;(appRedis as unknown as { redis: unknown }).redis = redis
    const res = await appRedis.inject({ method: 'GET', url: `/api/categories/cache/agent/${A_UUID}` })
    expect(res.statusCode).toBe(200)
    expect((res.json() as { data: { cached: unknown } }).data.cached).toBe(true)
    expect(q.findCategoryByAgentId).not.toHaveBeenCalled()
  })
})

describe('③ GET /categories/cache/category/:categoryId —— 畸形 ⇒ 404,闸先于 Redis', () => {
  it.each(MALFORMED)('有 Redis 时畸形段 %s ⇒ 404,redis.get 与查询层都零调用', async (seg) => {
    clearAll()
    const redis = makeRedis()
    ;(appRedis as unknown as { redis: unknown }).redis = redis
    const res = await appRedis.inject({ method: 'GET', url: `/api/categories/cache/category/${seg}` })
    expect(res.statusCode).toBe(404)
    expect(redis.get).not.toHaveBeenCalled()
    expect(q.findCategoryById).not.toHaveBeenCalled()
    expect((res.json() as { message: string }).message).toBe('分类不存在')
  })

  it('闸排在 Redis 判断之前:无 Redis 时畸形段仍 404(而不是 503)', async () => {
    clearAll()
    const res = await appNoRedis.inject({
      method: 'GET',
      url: '/api/categories/cache/category/carousel',
    })
    expect(res.statusCode).toBe(404)
    expect(q.findCategoryById).not.toHaveBeenCalled()
  })

  it('无 Redis 时合法 uuid 仍 503(既有基础设施契约不变)', async () => {
    clearAll()
    const res = await appNoRedis.inject({
      method: 'GET',
      url: `/api/categories/cache/category/${A_UUID}`,
    })
    expect(res.statusCode).toBe(503)
  })

  it('两态同形:畸形 404 与"合法 uuid 未命中且真不存在"的 404 逐字段等值', async () => {
    clearAll()
    const redis = makeRedis(null)
    ;(appRedis as unknown as { redis: unknown }).redis = redis
    q.findCategoryById.mockResolvedValue(undefined)
    const malformed = await appRedis.inject({
      method: 'GET',
      url: '/api/categories/cache/category/carousel',
    })
    const missing = await appRedis.inject({
      method: 'GET',
      url: `/api/categories/cache/category/${A_UUID}`,
    })
    expect(missing.statusCode).toBe(404)
    expect(q.findCategoryById).toHaveBeenCalledTimes(1)
    expect(malformed.json()).toStrictEqual(missing.json())
  })

  it('正向对照:合法 uuid 未命中且查到 ⇒ 200 cached:false 并回写缓存', async () => {
    clearAll()
    const redis = makeRedis(null)
    ;(appRedis as unknown as { redis: unknown }).redis = redis
    const category = { categoryId: A_UUID, name: '效率办公', status: '1' }
    q.findCategoryById.mockResolvedValue(category)
    const res = await appRedis.inject({
      method: 'GET',
      url: `/api/categories/cache/category/${A_UUID}`,
    })
    expect(res.statusCode).toBe(200)
    expect((res.json() as { data: { cached: unknown } }).data.cached).toBe(false)
    expect(redis.set).toHaveBeenCalled()
  })
})

describe('④ GET /:agentId/details —— z.string() 必过 safeParse 的同型漏站', () => {
  it.each(MALFORMED)('畸形段 %s ⇒ 404 且服务层(组 SQL 的那一层)零调用', async (seg) => {
    clearAll()
    const res = await appRedis.inject({ method: 'GET', url: `/api/${seg}/details` })
    expect(res.statusCode).toBe(404)
    expect(svc.getAgentDetail).not.toHaveBeenCalled()
    expect((res.json() as { message: string }).message).toBe('智能体不存在')
  })

  it('空串:路由层进不了参数段 ⇒ 绝不 500、服务层未被调用;判据对空串仍为 false', async () => {
    clearAll()
    const res = await appRedis.inject({ method: 'GET', url: '/api//details' })
    expect(res.statusCode).toBeLessThan(500)
    expect(svc.getAgentDetail).not.toHaveBeenCalled()
    const { isUuidString } = await import('../src/utils/uuid.js')
    expect(isUuidString('')).toBe(false)
  })

  it('两态同形:畸形 404 与"合法 uuid 真查不到"的 404 逐字段等值(同一 handler 产出)', async () => {
    clearAll()
    svc.getAgentDetail.mockResolvedValue(null)
    const malformed = await appRedis.inject({ method: 'GET', url: '/api/carousel/details' })
    const missing = await appRedis.inject({ method: 'GET', url: `/api/${A_UUID}/details` })
    expect(missing.statusCode).toBe(404)
    expect(svc.getAgentDetail).toHaveBeenCalledTimes(1)
    expect(malformed.json()).toStrictEqual(missing.json())
  })

  it('正向对照:合法 uuid ⇒ 闸不误伤,抵达查询层一次', async () => {
    clearAll()
    svc.getAgentDetail.mockResolvedValue(null)
    await appRedis.inject({ method: 'GET', url: `/api/${A_UUID}/details` })
    expect(svc.getAgentDetail).toHaveBeenCalledWith(A_UUID)
  })
})

describe('判据只许有一份,且 cache 两处的闸必须排在 Redis 判断之前(源码级锁)', () => {
  async function routeSource(): Promise<string> {
    const { readFileSync } = await import('node:fs')
    const { fileURLToPath } = await import('node:url')
    const path = await import('node:path')
    const root = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..')
    return readFileSync(path.join(root, 'apps/api/src/routes/agents.ts'), 'utf8')
  }

  function handlerSlice(src: string, marker: string): string {
    const start = src.indexOf(marker)
    expect(start, `路由定义未找到: ${marker}`).toBeGreaterThan(-1)
    const rest = src.slice(start + marker.length)
    const next = rest.search(/\n {2}server\.(get|post|put|delete)\(/)
    return next === -1 ? rest : rest.slice(0, next)
  }

  it('agents.ts 不出现第二份 uuid 正则,四处都复用 utils/uuid 的出口', async () => {
    const src = await routeSource()
    expect(src).toContain("from '../utils/uuid.js'")
    expect(src).not.toMatch(/\[0-9a-f\]\{8\}/)
    const gates =
      src.match(/isUuidString/g)?.length ?? 0
    expect(gates).toBeGreaterThanOrEqual(6) // 本票四处 + 既有 /agents/:agentId、/categories/agent/:agentId
  })

  it('cache/agent 与 cache/category:闸的字符位置早于 request.server.redis 与 503 文案', async () => {
    const src = await routeSource()
    for (const marker of [
      "server.get('/categories/cache/agent/:agentId'",
      "server.get('/categories/cache/category/:categoryId'",
    ]) {
      const body = handlerSlice(src, marker)
      const gate = body.indexOf('isUuidString')
      const redisUse = body.indexOf('request.server.redis')
      const unavailable = body.indexOf('Redis 不可用')
      expect(gate, `${marker} 缺形状闸`).toBeGreaterThan(-1)
      expect(gate).toBeLessThan(redisUse)
      expect(gate).toBeLessThan(unavailable)
    }
  })

  it('①④:闸早于各自查询层调用(量"await 调用式"而非裸标识符 —— 注释里的照读口径会先提到服务层名,裸 indexOf 会把注释读成代码)', async () => {
    const src = await routeSource()
    const s1 = handlerSlice(src, "server.get('/categories/:categoryId'")
    expect(s1.indexOf('isUuidString')).toBeLessThan(s1.indexOf('await findCategoryById('))
    const s4 = handlerSlice(src, "server.get('/:agentId/details'")
    expect(s4.indexOf('isUuidString')).toBeLessThan(s4.indexOf('await getAgentDetail('))
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
