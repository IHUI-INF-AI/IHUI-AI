// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * GET /api/chat/templates 服务端最小闭环用例(2026-10-18 立)。
 *
 * 零 DB:数据源是 `src/routes/chat-templates.ts` 下半部的内置目录,mock 测试档
 * (vitest.config.ts 默认 include tests/**,不连真实 PG/Redis —— AGENTS §5 测试隔离铁律)。
 * 七组断言各自守一件事,缺任何一条都是这票立项理由里的原样分叉:
 *  ① 端点存在(不 404) ② 信封 { code, message, data } 逐字 ③ 分页键只认 list(不得同时发 items)
 *  ④ 分页切片与 total 口径 ⑤ 未发布行读不到 + 内部字段(运营备注/创建人)不得出现在响应里
 *  ⑥ 投影字段闭集(白名单之外零字段) ⑦ 入参严格(未知键 / 非法页码 → 400)
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'

// Mock config:路由链未直接取 config,但同包其它测试同形处理,避免导入期 env 校验 exit(1)
vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'info',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
    COZE_API_KEY: '',
  },
}))

const { mockAuthenticate } = vi.hoisted(() => ({ mockAuthenticate: vi.fn() }))

vi.mock('../src/plugins/auth.js', () => ({ authenticate: mockAuthenticate }))

import {
  chatTemplateRoutes,
  CHAT_TEMPLATE_CATEGORIES,
  CHAT_TEMPLATE_RECORDS,
  __test__ as catalogTest,
} from '../src/routes/chat-templates.js'

const URL = '/api/chat/templates'
const PUBLIC_FIELDS = catalogTest.PUBLIC_TEMPLATE_FIELDS as readonly string[]

const publishedIds = CHAT_TEMPLATE_RECORDS.filter((r) => r.status === 'published').map((r) => r.id)
const draftIds = CHAT_TEMPLATE_RECORDS.filter((r) => r.status === 'draft').map((r) => r.id)
/** 内部字段的真实取值:响应的原始文本里出现任何一个 ⇒ 脱敏失守 */
const internalValues = CHAT_TEMPLATE_RECORDS.flatMap((r) =>
  [r.ownerNote, r.createdBy].filter((v): v is string => typeof v === 'string' && v.length > 0),
)

const loggedIn = () => mockAuthenticate.mockResolvedValue({ userId: 'user-1', roleId: 0 })
const loggedOut = () =>
  mockAuthenticate.mockRejectedValue(
    Object.assign(new Error('Authentication required'), { statusCode: 401 }),
  )

describe('GET /api/chat/templates', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(chatTemplateRoutes, { prefix: '/api/chat' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('端点存在:已登录时不回 404(此前该路径在全仓零注册)', async () => {
    loggedIn()
    const res = await server.inject({ method: 'GET', url: URL })
    expect(res.statusCode).toBe(200)
  })

  it('未登录一律 401,且走统一错误信封(本段不是公开面)', async () => {
    loggedOut()
    const res = await server.inject({ method: 'GET', url: URL })
    expect(res.statusCode).toBe(401)
    const body = res.json()
    expect(body.code).toBe(401)
    expect(typeof body.message).toBe('string')
    expect('data' in body).toBe(false)
  })

  it('信封逐字为 { code:0, message:"success", data },data 是分页壳', async () => {
    loggedIn()
    const body = (await server.inject({ method: 'GET', url: URL })).json()
    expect(Object.keys(body)).toEqual(['code', 'message', 'data'])
    expect(body.code).toBe(0)
    expect(body.message).toBe('success')
    expect(Object.keys(body.data).sort()).toEqual(
      ['categories', 'list', 'page', 'pageSize', 'total'].sort(),
    )
  })

  it('分页键只有一个 list:全仓 PageData 的真相,不得同时发 items 顶键蒙混', async () => {
    loggedIn()
    const body = (await server.inject({ method: 'GET', url: URL })).json()
    expect(Array.isArray(body.data.list)).toBe(true)
    expect('items' in body.data).toBe(false)
  })

  it('默认档 page=1/pageSize=20 下 published 全给,行数与目录现读的非草稿行数一致', async () => {
    loggedIn()
    const data = (await server.inject({ method: 'GET', url: URL })).json().data
    expect(data.page).toBe(1)
    expect(data.pageSize).toBe(20)
    expect(data.total).toBe(publishedIds.length)
    expect(data.list.map((t: { id: string }) => t.id)).toEqual(publishedIds)
  })

  it('page/pageSize 切片:页内条数、越界空页与 total 口径三处都要自洽', async () => {
    loggedIn()
    const first = (await server.inject({ method: 'GET', url: `${URL}?page=1&pageSize=3` })).json()
      .data
    expect(first.list).toHaveLength(3)
    expect(first.total).toBe(publishedIds.length)
    expect(first.page).toBe(1)
    expect(first.pageSize).toBe(3)

    const lastPage = Math.ceil(publishedIds.length / 3)
    const tail = (
      await server.inject({ method: 'GET', url: `${URL}?page=${lastPage}&pageSize=3` })
    ).json().data
    expect(tail.list.map((t: { id: string }) => t.id)).toEqual(
      publishedIds.slice((lastPage - 1) * 3, lastPage * 3),
    )

    const beyond = (
      await server.inject({ method: 'GET', url: `${URL}?page=${lastPage + 5}&pageSize=3` })
    ).json().data
    expect(beyond.list).toEqual([])
    // 越界页的 total 仍是**筛选集**的条数,不得被读成"一条都没有"
    expect(beyond.total).toBe(publishedIds.length)
  })

  it('游客只见 published:逐页收集全部行,draft 行一条都不出现', async () => {
    loggedIn()
    expect(draftIds.length).toBeGreaterThan(0)
    const collected: string[] = []
    for (let page = 1; page <= Math.ceil(publishedIds.length / 2) + 2; page += 1) {
      const data = (
        await server.inject({ method: 'GET', url: `${URL}?page=${page}&pageSize=2` })
      ).json().data
      for (const t of data.list) collected.push(t.id)
    }
    expect(collected.sort()).toEqual([...publishedIds].sort())
    for (const draftId of draftIds) expect(collected).not.toContain(draftId)
  })

  it('脱敏:内部字段既不在投影里,其取值也不得出现在响应原文', async () => {
    loggedIn()
    expect(internalValues.length).toBeGreaterThan(0)
    for (const row of CHAT_TEMPLATE_RECORDS.filter((r) => r.status === 'published')) {
      const publicRow = catalogTest.toPublicTemplate(row)
      expect(Object.keys(publicRow).sort()).toEqual([...PUBLIC_FIELDS].sort())
      expect(publicRow).not.toHaveProperty('ownerNote')
      expect(publicRow).not.toHaveProperty('createdBy')
    }
    const raw = (await server.inject({ method: 'GET', url: `${URL}?pageSize=50` })).body
    for (const value of internalValues) expect(raw).not.toContain(value)
    expect(raw).not.toContain('ownerNote')
    expect(raw).not.toContain('createdBy')
  })

  it('每行字段闭集恰为白名单六项,不多不少', async () => {
    loggedIn()
    const data = (await server.inject({ method: 'GET', url: `${URL}?pageSize=50` })).json().data
    expect(data.list.length).toBeGreaterThan(0)
    for (const t of data.list) expect(Object.keys(t).sort()).toEqual([...PUBLIC_FIELDS].sort())
  })

  it('category 过滤生效;拼错的分类名回空集而不是静默变全量', async () => {
    loggedIn()
    const categoryId = CHAT_TEMPLATE_CATEGORIES[0]!.id
    const expected = publishedIds.filter(
      (id) => CHAT_TEMPLATE_RECORDS.find((r) => r.id === id)!.categoryId === categoryId,
    )
    const scoped = (
      await server.inject({ method: 'GET', url: `${URL}?category=${categoryId}` })
    ).json().data
    expect(scoped.list.map((t: { id: string }) => t.id)).toEqual(expected)
    expect(scoped.total).toBe(expected.length)

    const bogus = (
      await server.inject({ method: 'GET', url: `${URL}?category=no-such-cat` })
    ).json().data
    expect(bogus.list).toEqual([])
    expect(bogus.total).toBe(0)
  })

  it('入参严格:未知键与非法页码都 400(Zod .strict() 显式表态)', async () => {
    loggedIn()
    const unknownKey = (await server.inject({ method: 'GET', url: `${URL}?foo=1` })).json()
    expect(unknownKey.code).toBe(400)
    expect(unknownKey.message).toBeTruthy()

    for (const bad of ['page=0', 'page=-1', 'page=1.5', 'pageSize=0', 'pageSize=51']) {
      const body = (await server.inject({ method: 'GET', url: `${URL}?${bad}` })).json()
      expect(body.code, bad).toBe(400)
    }
  })

  it('同一请求跑两次响应逐字节相同(内置目录无随机序、无副作用)', async () => {
    loggedIn()
    const a = await server.inject({ method: 'GET', url: `${URL}?page=1&pageSize=5` })
    const b = await server.inject({ method: 'GET', url: `${URL}?page=1&pageSize=5` })
    expect(b.body).toBe(a.body)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
