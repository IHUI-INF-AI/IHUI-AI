// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, afterAll, beforeAll, vi } from 'vitest'
import Fastify from 'fastify'

// Mock config 避免导入时 env 校验触发 process.exit(1)
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
  },
}))

// Mock learn-queries 以隔离数据库依赖
vi.mock('../src/db/learn-queries.js', () => ({
  findPublishedCategories: vi.fn().mockResolvedValue([]),
  findAllCategories: vi.fn().mockResolvedValue([]),
  findLearnCategoryById: vi.fn(),
  createLearnCategory: vi.fn(),
  updateLearnCategory: vi.fn(),
  deleteLearnCategory: vi.fn(),
  findPublishedLessons: vi.fn().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
  findAllLessons: vi.fn().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
  findLessonById: vi.fn(),
  findLessonByIdAdmin: vi.fn(),
  createLesson: vi.fn(),
  updateLesson: vi.fn(),
  deleteLesson: vi.fn(),
  incrementViewCount: vi.fn().mockResolvedValue(undefined),
  findLessonChapters: vi.fn().mockResolvedValue([]),
  findChapterById: vi.fn(),
  createChapter: vi.fn(),
  updateChapter: vi.fn(),
  deleteChapter: vi.fn(),
  findLessonSections: vi.fn().mockResolvedValue([]),
  findMyLessons: vi.fn().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
  signUpLesson: vi.fn().mockResolvedValue(undefined),
  findSignUp: vi.fn(),
  updateProgress: vi.fn(),
}))

import { learnRoutes, adminLearnRoutes } from '../src/routes/learn'
// 与被测路由拿到的是**同一个替身实例**(vi.mock 的 specifier 与本行同形),
// 所以断言读的是"路由真的把哪根轴交给了查询层",不是第二个 mock。
import { findPublishedLessons } from '../src/db/learn-queries.js'

const DUMMY_UUID = '00000000-0000-4000-8000-000000000001'

describe('learn routes', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    // 与 server.ts 保持一致的错误处理器：将验证错误格式化为 { code, message }
    server.setErrorHandler((error, _request, reply) => {
      const statusCode =
        error.statusCode && error.statusCode >= 400 && error.statusCode < 600
          ? error.statusCode
          : 500
      reply.status(statusCode).send({
        code: statusCode,
        message: statusCode >= 500 ? '服务器错误' : error.message,
      })
    })
    await server.register(learnRoutes, { prefix: '/api' })
    await server.register(adminLearnRoutes, { prefix: '/api/admin' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  // ----- 公共浏览端点（匿名可访问，返回 200） -----

  it('GET /api/learn/categories 未登录返回 200（公开）', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/learn/categories' })
    expect(res.statusCode).toBe(200)
  })

  it('GET /api/learn/lessons 未登录返回 200（公开）', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/learn/lessons' })
    expect(res.statusCode).toBe(200)
  })

  it('GET /api/learn/lessons/:id 未登录返回 404（公开，课程不存在）', async () => {
    const res = await server.inject({ method: 'GET', url: `/api/learn/lessons/${DUMMY_UUID}` })
    expect(res.statusCode).toBe(404)
  })

  // ----- 需登录端点（未登录返回 401） -----

  it('GET /api/learn/my-lessons 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/learn/my-lessons' })
    expect(res.statusCode).toBe(401)
  })

  it('POST /api/learn/lessons/:id/sign-up 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/api/learn/lessons/${DUMMY_UUID}/sign-up`,
    })
    expect(res.statusCode).toBe(401)
  })

  // ----- admin 端点（需管理员，未登录返回 401） -----

  it('GET /api/admin/learn/categories 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/admin/learn/categories' })
    expect(res.statusCode).toBe(401)
  })

  it('POST /api/admin/learn/lessons 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/learn/lessons',
      body: { title: '测试课程' },
    })
    expect(res.statusCode).toBe(401)
  })

  // ----- 课程列表筛选轴(2026-09-28 补:difficulty / price 首次成为服务端真支持的轴) -----
  // 判据问的是"这根轴有没有被交给查询层",不是"响应是不是 200"。
  // 后者在扩轴之前就已经成立,所以它对本次改动零判别力。
  describe('GET /api/learn/lessons 与 admin 列表的筛选轴', () => {
    const query = (qs: string) => server.inject({ method: 'GET', url: `/api/learn/lessons${qs}` })

    it('合法 difficulty / price 原样下传查询层(不再是"前端传了、服务端剥掉")', async () => {
      vi.clearAllMocks()
      const res = await query('?difficulty=beginner&price=free&page=2&pageSize=5')
      expect(res.statusCode).toBe(200)
      expect(findPublishedLessons).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 2,
          pageSize: 5,
          difficulty: 'beginner',
          price: 'free',
        }),
      )
    })

    it('paid 档同样下传(两档都得真的走到 SQL)', async () => {
      vi.clearAllMocks()
      const res = await query('?price=paid')
      expect(res.statusCode).toBe(200)
      expect(findPublishedLessons).toHaveBeenCalledWith(expect.objectContaining({ price: 'paid' }))
    })

    it('非法 difficulty → 400 并点名文案(不是静默忽略那根轴)', async () => {
      vi.clearAllMocks()
      const res = await query('?difficulty=genius')
      expect(res.statusCode).toBe(400)
      expect(res.json().message).toBe('无效的难度')
      expect(findPublishedLessons, '校验失败不得仍然查库').not.toHaveBeenCalled()
    })

    it('非法 price → 400(取值域只认 free/paid)', async () => {
      vi.clearAllMocks()
      const res = await query('?price=cheap')
      expect(res.statusCode).toBe(400)
      expect(res.json().message).toBe('无效的价格筛选')
      expect(findPublishedLessons).not.toHaveBeenCalled()
    })

    it('空串按"未选这根轴"处理(与既有 categoryId 的归一形态同形,不新增第二套空值语义)', async () => {
      vi.clearAllMocks()
      const res = await query('?difficulty=&price=&categoryId=')
      expect(res.statusCode).toBe(200)
      expect(findPublishedLessons).toHaveBeenCalledWith(
        expect.objectContaining({ difficulty: undefined, price: undefined, categoryId: undefined }),
      )
    })

    it('一根轴都没选时不得凭空多出筛选谓词(默认参数即"全部")', async () => {
      vi.clearAllMocks()
      const res = await query('')
      expect(res.statusCode).toBe(200)
      const opts = vi.mocked(findPublishedLessons).mock.calls[0]?.[0]
      expect(opts?.difficulty).toBeUndefined()
      expect(opts?.price).toBeUndefined()
    })

    // admin 列表的下传不在此断言:未登录先到 401,拿不到查询层(此处写一条
    // "not.toHaveBeenCalled"只会永远绿)。同一份实现在 SQL 层由
    // tests/learn/published-lessons-filter-axes.test.ts 的 F7 判据覆盖。
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
