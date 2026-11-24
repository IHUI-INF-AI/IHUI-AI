// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 控制帧 `refresh_memory` 的 api 代理层落地证明(2026-10-28 立)
 *
 * 立因:本帧在 D141 正本里被判为**真缺** —— 竞品原帧语义是「宿主显式调用 + 必须回报
 * 结果」(`await this.request({type:"refresh_memory"})`),而我方记忆面此前只有
 * `memory.status`(只读聚合)与 `memory.reset`(双确认清空),缺「显式重扫 + 回报差额」
 * 这一格。真身在 ai-service 的 `memory_facade.memory_refresh()`,本文件盯的是中间那一格。
 *
 * 这一格要证明两件事(顺带也是本文件与另三帧的 api 用例分开写的理由 —— 它们走的
 * 是普通用户鉴权,这一格走 requireAdmin,桩件形状不同):
 * ① 上游的差额字段(added/removed/changed/unchanged/before/totalLessons/loadState)
 *    必须**一字不差**抵达调用方 —— 帧的判据就是「调用方拿得到差额」;
       注意 ai-service 的 memory_facade 返的是**裸 JSON**(没有 {code,message,data}
       信封),而本仓 api 侧统一是信封,所以这一格要多包一次 —— 包完之后字段一个不许少。
 * ② **读失败 ≠ 空**:上游以非 2xx 或不通回报失败时,代理层必须如实回状态码,
 *    不许包成 200 带一个"刷新成功"的空壳。
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const { mockAiServiceFetch } = vi.hoisted(() => ({
  mockAiServiceFetch: vi.fn(),
}))

const { setAdmin, getAdmin } = vi.hoisted(() => {
  let isAdmin = true
  return {
    setAdmin: (v: boolean) => {
      isAdmin = v
    },
    getAdmin: () => (isAdmin ? { userId: 'admin-test-001', roleId: 1 } : null),
  }
})

// meta-learner 是 admin 面路由,插件级 preHandler 就是 requireAdmin —— 沿用
// admin-plugin-stats 的同一套桩 done 法:夹具必须填生产会填的字段
// (requireAdmin 经 authenticate 只写 request.userId / request.jwtPayload)。
vi.mock('../../plugins/require-permission.js', () => ({
  requireAdmin: vi.fn(async (request: any, reply: any) => {
    const admin = getAdmin()
    if (!admin) {
      return reply.status(403).send({ code: 403, message: 'Admin required', data: null })
    }
    request.userId = admin.userId
    request.jwtPayload = admin
  }),
}))

vi.mock('../../utils/ai-service-fetch.js', () => ({
  aiServiceFetch: mockAiServiceFetch,
  aiServiceFetchStream: mockAiServiceFetch,
}))

import metaLearnerRoutes from '../meta-learner.js'

function upstream(payload: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json; charset=utf-8' },
    text: async () => JSON.stringify(payload),
  } as unknown as Response
}

type FetchCall = [unknown, string, { method?: string; body?: string }]

describe('refresh_memory: POST /api/admin/meta-learner/refresh', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(metaLearnerRoutes, { prefix: '/api/admin/meta-learner' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    setAdmin(true)
    mockAiServiceFetch.mockReset()
  })

  it('必须转发到 ai-service 同名路径,且把差额一字不差带回调用方', async () => {
    const diff = {
      refreshed: true,
      added: ['lesson-a'],
      removed: ['lesson-b'],
      changed: ['lesson-c'],
      unchanged: 4,
      before: 6,
      totalLessons: 6,
      loadState: 'loaded',
    }
    mockAiServiceFetch.mockResolvedValue(upstream(diff))

    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/meta-learner/refresh',
      payload: {},
    })

    expect(mockAiServiceFetch).toHaveBeenCalledTimes(1)
    const [, pathArg, initArg] = mockAiServiceFetch.mock.calls[0] as unknown as FetchCall
    expect(pathArg).toBe('/api/admin/meta-learner/refresh')
    expect(initArg.method).toBe('POST')

    expect(res.statusCode).toBe(200)
    // 差额是这一帧的全部价值所在:少了任何一格,调用方就只能"点了不知道动没动"
    expect(res.json().data).toEqual(diff)
  })

  it('上游重扫失败(refreshed:false 但仍 200)⇒ 如实透出,不许改成成功态', async () => {
    const failed = {
      refreshed: false,
      error: '读不到持久化记忆源(重扫失败),已保留刷新前的内存态',
      before: 3,
      totalLessons: 3,
      added: [],
      removed: [],
      changed: [],
      unchanged: 3,
      loadState: 'retry_backoff',
    }
    mockAiServiceFetch.mockResolvedValue(upstream(failed))

    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/meta-learner/refresh',
      payload: {},
    })

    expect(res.statusCode).toBe(200)
    const body = res.json().data
    expect(body.refreshed).toBe(false)
    // 「读失败 ≠ 空」:totalLessons 必须是刷新前的真数,不能变成 0
    expect(body.totalLessons).toBe(3)
    expect(body.error).toBeTruthy()
    expect(body.loadState).toBe('retry_backoff')
  })

  it('上游非 2xx ⇒ 原状态码透出且带上 upstream 的 detail', async () => {
    mockAiServiceFetch.mockResolvedValue(upstream({ detail: '后端炸了' }, 500))

    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/meta-learner/refresh',
      payload: {},
    })

    expect(res.statusCode).toBe(500)
    expect(res.json().message).toContain('后端炸了')
  })

  it('连不上 ai-service ⇒ 502 明示(不许回 200 静默成功)', async () => {
    mockAiServiceFetch.mockRejectedValue(new Error('connect ECONNREFUSED'))

    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/meta-learner/refresh',
      payload: {},
    })

    expect(res.statusCode).toBe(502)
  })

  it('非管理员 ⇒ 403 且一次都不转发到 ai-service', async () => {
    setAdmin(false)

    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/meta-learner/refresh',
      payload: {},
    })

    expect(res.statusCode).toBe(403)
    expect(mockAiServiceFetch).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
