// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 访问量写入口的"客户端不得自报业务时间键"回归锁。
 *
 * 缺陷(现读于修前):`POST /visit-tracking/visit-log` 的入参 schema 声明了 `visitDate`
 * (平铺与 `{data:{…}}` 两种形状各一份,`z.string().max(10).optional()`),处理器又把
 * `...parsed.data` 整包转给 `saveVisitLog` ⇒ **PV/UV 的分组日期由浏览器决定**。
 * 后果:任何人 POST 一个过去的日期,就能给任意一天刷访问量(统计与大屏的"今日/历史"全部可被
 * 伪造);连格式都不校验(`"abc"` 也能进,落到 date 列上变成 500)。
 * 讽刺的是同一段注释(2026-10-23)已经把 ip / userAgent 按"可整写字段"剥掉了,唯独漏了这个键。
 *
 * 断言口径:不看状态码,看**交给写入口的那一包**里到底有什么。
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:8810/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const { captured } = vi.hoisted(() => ({ captured: [] as Array<Record<string, unknown>> }))

vi.mock('../../db/visit-tracking-queries.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../db/visit-tracking-queries.js')>()
  return {
    ...actual,
    saveVisitLog: vi.fn(async (input: Record<string, unknown>) => {
      captured.push(input)
      return { id: 1, ...(input as object) } as never
    }),
  }
})

import { visitTrackingRoutes } from '../visit-tracking.js'

const URL = '/api/visit-tracking/visit-log' // 与注册前缀同形:漏前缀会得到 404,那是测了个不存在的路由而不是判据通过

describe('visit-log:业务时间键与来源字段一律取服务端观测面', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(visitTrackingRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('平铺形状里自报的 visitDate / ip / userAgent 不进写入口', async () => {
    captured.length = 0
    const res = await app.inject({
      method: 'POST',
      url: URL,
      payload: {
        url: '/some/page',
        sessionId: 's-1',
        visitDate: '2020-01-01',
        ip: '1.2.3.4',
        userAgent: '伪造 UA',
      },
    })
    expect(res.statusCode).toBe(200)
    expect(captured).toHaveLength(1)
    const input = captured[0]
    if (!input) throw new Error('写入口未被调用 —— 断言无从谈起')
    expect(input.visitDate, '业务日不得由客户端决定').toBeUndefined()
    expect(input.ip, '来源 IP 不得由客户端决定').toBeUndefined()
    expect(input.userAgent).toBeUndefined()
    // 合法字段必须仍然透传(证明不是把整包丢了换来的"通过")
    expect(input.url).toBe('/some/page')
    expect(input.sessionId).toBe('s-1')
    expect(input.observed, '服务端观测面必须在场').toBeTruthy()
  })

  it('{data:{…}} 兼容形状同样剥掉自报键', async () => {
    captured.length = 0
    const res = await app.inject({
      method: 'POST',
      url: URL,
      payload: { data: { url: '/x', visitDate: '1999-12-31' } },
    })
    expect(res.statusCode).toBe(200)
    expect(captured[0]?.visitDate).toBeUndefined()
    expect(captured[0]?.url).toBe('/x')
  })

  it('非法 visitDate 不再变成 500:键被忽略后请求按正常语义处理', async () => {
    captured.length = 0
    const res = await app.inject({ method: 'POST', url: URL, payload: { url: '/y', visitDate: 'abc' } })
    expect(res.statusCode).toBe(200)
    expect(captured[0]?.visitDate).toBeUndefined()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
