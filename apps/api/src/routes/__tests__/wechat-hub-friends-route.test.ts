// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 好友自动化 HTTP 边界契约测试：
 *  - POST /friends/accept 必须显式 confirmed:true，缺省/非 true 一律 400 + CONFIRM_REQUIRED；
 *  - 策略 GET 透传服务层结果；服务与桥全部桩掉，只验路由层校验与响应形状。
 */

import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => ({
  accept: vi.fn(),
  overview: vi.fn(),
  policyView: vi.fn(),
  updatePolicy: vi.fn(),
  auditExport: vi.fn(),
}))

vi.mock('../../plugins/auth.js', () => ({
  checkAuth: vi.fn(async (request: { userId?: string }) => {
    request.userId = 'user-1'
    return true
  }),
}))

vi.mock('../../db/index.js', () => ({
  dbRead: { select: vi.fn() },
  db: { update: () => ({ set: vi.fn() }) },
}))

vi.mock('../../services/wechat-hub/manager.js', () => ({
  wechatHubManager: {
    startSchedulers: vi.fn(),
    stopSchedulers: vi.fn(),
    performAction: vi.fn(),
  },
}))

vi.mock('../../services/wechat-hub/jobs.js', () => ({
  startJobScheduler: vi.fn(),
  stopJobScheduler: vi.fn(),
}))

vi.mock('../../services/wechat-hub/friends-automation.js', () => ({
  acceptFriendRequest: hoisted.accept,
  readFriendsAuditExport: hoisted.auditExport,
  readFriendsOverview: hoisted.overview,
  readFriendsPolicyView: hoisted.policyView,
  updateFriendsPolicy: hoisted.updatePolicy,
}))

import { wechatHubRoutes } from '../wechat-hub.js'

async function buildApp() {
  const app = Fastify()
  await app.register(wechatHubRoutes)
  await app.ready()
  return app
}

beforeEach(() => {
  hoisted.accept.mockReset()
  hoisted.overview.mockReset()
  hoisted.policyView.mockReset()
  hoisted.updatePolicy.mockReset()
  hoisted.auditExport.mockReset()
})

describe('POST /wechat-hub/accounts/:id/friends/accept', () => {
  it('不带 body：400 + CONFIRM_REQUIRED，不进服务层', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/wechat-hub/accounts/acc-1/friends/accept',
      payload: {},
    })
    expect(res.statusCode).toBe(400)
    const body = res.json() as { errorCode: string }
    expect(body.errorCode).toBe('CONFIRM_REQUIRED')
    expect(hoisted.accept).not.toHaveBeenCalled()
    await app.close()
  })

  it('confirmed 缺失：400 + CONFIRM_REQUIRED', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/wechat-hub/accounts/acc-1/friends/accept',
      payload: { requestId: 'r1' },
    })
    expect(res.statusCode).toBe(400)
    const body = res.json() as { errorCode: string }
    expect(body.errorCode).toBe('CONFIRM_REQUIRED')
    expect(hoisted.accept).not.toHaveBeenCalled()
    await app.close()
  })

  it('confirmed 为 false：400 + CONFIRM_REQUIRED', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/wechat-hub/accounts/acc-1/friends/accept',
      payload: { requestId: 'r1', confirmed: false },
    })
    expect(res.statusCode).toBe(400)
    const body = res.json() as { errorCode: string }
    expect(body.errorCode).toBe('CONFIRM_REQUIRED')
    expect(hoisted.accept).not.toHaveBeenCalled()
    await app.close()
  })
})

describe('GET /wechat-hub/accounts/:id/friends/audit', () => {
  const entries = [
    {
      at: 1_760_000_000_000,
      requestId: 'r1',
      nickname: '张三',
      ok: true,
      status: 'accepted',
      errorCode: null,
    },
    {
      at: 1_760_000_100_000,
      requestId: 'r2',
      nickname: '李四',
      ok: false,
      status: 'failed',
      errorCode: 'RATE_LIMITED',
    },
  ]

  it('默认返回 JSON 整包（含 count/keep）', async () => {
    hoisted.auditExport.mockResolvedValue({ entries, count: 2, keep: 200 })
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/wechat-hub/accounts/acc-1/friends/audit' })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { code: number; data: { count: number; keep: number; entries: unknown[] } }
    expect(body.code).toBe(0)
    expect(body.data.count).toBe(2)
    expect(body.data.keep).toBe(200)
    expect(body.data.entries).toHaveLength(2)
    await app.close()
  })

  it('format=csv：返回 text/csv 附件，表头与转义正确', async () => {
    hoisted.auditExport.mockResolvedValue({
      entries: [
        { ...entries[0], nickname: '带"引号"的昵称' },
        entries[1],
      ],
      count: 2,
      keep: 200,
    })
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/wechat-hub/accounts/acc-1/friends/audit?format=csv' })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('text/csv')
    expect(String(res.headers['content-disposition'])).toContain('attachment')
    const lines = res.body.split('\r\n')
    expect(lines[0]).toBe('at,ok,status,requestId,nickname,errorCode')
    expect(lines[1]).toContain('"带""引号""的昵称"')
    expect(lines[2]).toContain('RATE_LIMITED')
    await app.close()
  })
})

describe('GET /wechat-hub/accounts/:id/friends/policy', () => {
  it('透传服务层策略视图，200', async () => {
    hoisted.policyView.mockResolvedValue({ enabled: false, maxAcceptsPerHour: 3 })
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/wechat-hub/accounts/acc-1/friends/policy',
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { code: number; data: { enabled: boolean; maxAcceptsPerHour: number } }
    expect(body.code).toBe(0)
    expect(body.data).toEqual({ enabled: false, maxAcceptsPerHour: 3 })
    await app.close()
  })
})

