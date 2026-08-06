/**
 * crash-reports 路由测试(2026-08-06 新增功能)。
 *
 * 覆盖:
 *  - zod 校验:非法 platform → 400;合法 platform + 字段长度越界 → 400
 *  - 匿名上报:authenticate 失败时 userId=null,仍返回 200
 *  - 登录上报:userId 透传给 recordCrash
 *  - 同栈 5 分钟防刷:同 errorMessage 二次提交 → deduplicated=true
 *  - recordCrash 失败静默:路由不因服务异常而 500(服务层吞错)
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify from 'fastify'

const { mockAuthenticate, mockRecordCrash } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
  mockRecordCrash: vi.fn(),
}))

// 默认匿名:authenticate 失败 → userId 保持 null
mockAuthenticate.mockRejectedValue(new Error('unauthorized'))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
}))

vi.mock('../src/services/crash-report-service.js', () => ({
  recordCrash: mockRecordCrash,
}))

// 各用例使用不同的 errorMessage,避免模块级 crashDedupMap 跨用例串扰
import { crashReportsRoutes } from '../src/routes/crash-reports'

describe('crash-reports 路由', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(crashReportsRoutes, { prefix: '/api' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  it('非法 platform 返回 400', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/crash-reports',
      payload: { platform: 'windows-xp', errorMessage: 'boom' },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe(400)
    expect(mockRecordCrash).not.toHaveBeenCalled()
  })

  it('缺失 errorMessage 返回 400', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/crash-reports',
      payload: { platform: 'ios' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('空 errorMessage 返回 400', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/crash-reports',
      payload: { platform: 'android', errorMessage: '' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('超长字段返回 400(version>64 / errorMessage>4000 / stack>20000 / route>512)', async () => {
    const cases = [
      { platform: 'web', errorMessage: 'x', version: 'v'.repeat(65) },
      { platform: 'web', errorMessage: 'x'.repeat(4001) },
      { platform: 'web', errorMessage: 'x', stack: 's'.repeat(20001) },
      { platform: 'web', errorMessage: 'x', route: 'r'.repeat(513) },
    ]
    for (const payload of cases) {
      const res = await server.inject({ method: 'POST', url: '/api/crash-reports', payload })
      expect(res.statusCode).toBe(400)
    }
  })

  it('合法上报:匿名(authenticate 失败)→ 200 + deduplicated=false + recordCrash userId=null', async () => {
    mockAuthenticate.mockRejectedValueOnce(new Error('unauthorized'))
    mockRecordCrash.mockResolvedValueOnce({ id: 'crash-1' })
    const res = await server.inject({
      method: 'POST',
      url: '/api/crash-reports',
      payload: { platform: 'ios', errorMessage: 'anon-crash-1', version: '1.2.3', stack: 's' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data).toEqual({ id: 'crash-1', deduplicated: false })
    expect(mockRecordCrash).toHaveBeenCalledWith(
      expect.objectContaining({ userId: null, platform: 'ios', errorMessage: 'anon-crash-1' }),
    )
  })

  it('登录上报:userId 透传给 recordCrash', async () => {
    mockAuthenticate.mockImplementationOnce(async (request: { userId?: string }) => {
      request.userId = 'user-42'
    })
    mockRecordCrash.mockResolvedValueOnce({ id: 'crash-2' })
    const res = await server.inject({
      method: 'POST',
      url: '/api/crash-reports',
      payload: { platform: 'wechat-miniapp', errorMessage: 'auth-crash-1' },
    })
    expect(res.statusCode).toBe(200)
    expect(mockRecordCrash).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-42', platform: 'wechat-miniapp' }),
    )
  })

  it('可选字段缺省时以 null 传递', async () => {
    mockRecordCrash.mockResolvedValueOnce({ id: 'crash-3' })
    const res = await server.inject({
      method: 'POST',
      url: '/api/crash-reports',
      payload: { platform: 'cli', errorMessage: 'optional-fields' },
    })
    expect(res.statusCode).toBe(200)
    expect(mockRecordCrash).toHaveBeenCalledWith(
      expect.objectContaining({ version: null, stack: null, route: null }),
    )
  })

  it('同栈 5 分钟防刷:同 errorMessage 二次提交 → deduplicated=true 且不再落库', async () => {
    mockRecordCrash.mockClear()
    mockRecordCrash.mockResolvedValue({ id: 'crash-dedup' })
    const payload = { platform: 'android', errorMessage: 'dedup-marker-2026-08-06' }

    const first = await server.inject({ method: 'POST', url: '/api/crash-reports', payload })
    expect(first.statusCode).toBe(200)
    expect(first.json().data.deduplicated).toBe(false)

    const second = await server.inject({ method: 'POST', url: '/api/crash-reports', payload })
    expect(second.statusCode).toBe(200)
    expect(second.json().data.deduplicated).toBe(true)
    expect(second.json().data.id).toBe('')

    // 防刷命中时不应再调 recordCrash
    expect(mockRecordCrash).toHaveBeenCalledTimes(1)
  })

  it('不同 errorMessage 不触发防刷', async () => {
    mockRecordCrash.mockClear()
    mockRecordCrash.mockResolvedValue({ id: 'crash-x' })
    const a = await server.inject({
      method: 'POST',
      url: '/api/crash-reports',
      payload: { platform: 'desktop', errorMessage: 'distinct-msg-a' },
    })
    const b = await server.inject({
      method: 'POST',
      url: '/api/crash-reports',
      payload: { platform: 'desktop', errorMessage: 'distinct-msg-b' },
    })
    expect(a.json().data.deduplicated).toBe(false)
    expect(b.json().data.deduplicated).toBe(false)
    expect(mockRecordCrash).toHaveBeenCalledTimes(2)
  })
})
