// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

// 测试隔离铁律(AGENTS.md §5):本文件全程不发真实 SQL / SMTP ——
// db 用链式 mock;email-service.sendEmail 用 vi.fn;
// broadcast-email-service 只 mock 收件人查询(listEmailRecipients),
// broadcastDispatchEmail 保留真实实现 → 走真实"渲染→分批发送→按 result.sent 真计"链路。
const sendEmailMock = vi.hoisted(() => vi.fn())
const listEmailRecipientsMock = vi.hoisted(() => vi.fn())

vi.mock('jose', () => ({ decodeJwt: () => ({}) }))
vi.mock('@ihui/auth', () => ({
  verifyAccessToken: vi.fn().mockResolvedValue({ userId: 'mock-admin-id', roleId: 1 }),
}))
vi.mock('../src/db/usercenter-queries.js', () => ({
  getUserStatus: vi.fn().mockResolvedValue(1),
}))
vi.mock('../src/db/index.js', () => ({
  db: {
    select: vi.fn(() => []),
    execute: vi.fn().mockResolvedValue([]),
  },
  dbRead: {
    select: vi.fn(() => []),
  },
}))
vi.mock('../src/services/email-service.js', () => ({
  sendEmail: sendEmailMock,
}))
vi.mock('../src/services/broadcast-email-service.js', async (importOriginal) => {
  const actual = await importOriginal<BroadcastServiceModule>()
  return {
    ...actual,
    listEmailRecipients: listEmailRecipientsMock,
  }
})

import { adminMaintenanceNoticeRoutes } from '../src/routes/admin-maintenance-notice'
import { verifyAccessToken } from '@ihui/auth'
import type { EmailRecipient } from '../src/services/broadcast-email-service.js'
import type * as BroadcastServiceModule from '../src/services/broadcast-email-service.js'

const AUTH_HEADERS = { authorization: 'Bearer mock-access-token' }

function makeRecipients(n: number): EmailRecipient[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `u-${i + 1}`,
    email: `user${i + 1}@aizhs.top`,
    nickname: `用户${i + 1}`,
  }))
}

const VALID_BODY = {
  window: '2026-09-25 02:00–04:00',
  scope: 'API 与控制台',
  downtime: '2 小时',
}

describe('admin-maintenance-notice routes', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
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
    await server.register(adminMaintenanceNoticeRoutes, { prefix: '/api/admin' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    sendEmailMock.mockReset()
    sendEmailMock.mockResolvedValue({ sent: true, stub: false, provider: 'smtp' })
    listEmailRecipientsMock.mockReset()
    listEmailRecipientsMock.mockResolvedValue(makeRecipients(5))
    vi.mocked(verifyAccessToken).mockResolvedValue({ userId: 'mock-admin-id', roleId: 1 })
  })

  describe('鉴权面(非 admin 拿不到 200)', () => {
    it('未登录 POST /api/admin/maintenance-notice/email → 401', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/admin/maintenance-notice/email',
        body: VALID_BODY,
      })
      expect(res.statusCode).toBe(401)
      expect(sendEmailMock).not.toHaveBeenCalled()
    })

    it('普通用户(roleId=0)→ 403 且不发送', async () => {
      vi.mocked(verifyAccessToken).mockResolvedValue({ userId: 'mock-user-id', roleId: 0 })
      const res = await server.inject({
        method: 'POST',
        url: '/api/admin/maintenance-notice/email',
        headers: AUTH_HEADERS,
        body: VALID_BODY,
      })
      expect(res.statusCode).toBe(403)
      expect(sendEmailMock).not.toHaveBeenCalled()
    })
  })

  describe('参数校验', () => {
    it('缺少 scope → 400,不发送', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/admin/maintenance-notice/email',
        headers: AUTH_HEADERS,
        body: { window: 'w', downtime: 'd' },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().code).toBe(400)
      expect(sendEmailMock).not.toHaveBeenCalled()
    })

    it('limit 越界(0)→ 400', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/admin/maintenance-notice/email',
        headers: AUTH_HEADERS,
        body: { ...VALID_BODY, limit: 0 },
      })
      expect(res.statusCode).toBe(400)
    })
  })

  describe('实发(装车证明)', () => {
    it('admin 实发 → sendEmail 以 renderMaintenanceNoticeEmail 的 html 逐收件人调用,响应为统一形状', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/admin/maintenance-notice/email',
        headers: AUTH_HEADERS,
        body: VALID_BODY,
      })
      expect(res.statusCode).toBe(200)
      const json = res.json() as { code: number; message: string; data: unknown }
      expect(json.code).toBe(0)
      expect(json.message).toBe('success')
      expect(json.data).toMatchObject({ dryRun: false, total: 5 })

      // 5 个收件人 → 5 次 sendEmail;html 必含机械风横幅 tag(模板装车的直接证据)
      expect(sendEmailMock).toHaveBeenCalledTimes(5)
      const first = sendEmailMock.mock.calls[0]?.[0] as {
        to: string
        subject: string
        html: string
        text?: string
        scene?: string
        userId?: string
      }
      expect(first.to).toBe('user1@aizhs.top')
      expect(first.scene).toBe('notification')
      expect(first.userId).toBe('u-1')
      expect(first.html).toContain('NOTICE // SYSTEM_MAINTENANCE')
      expect(first.subject).toContain('例行维护通知')
      expect(first.subject).toContain(VALID_BODY.window)
      expect(first.text).toContain(VALID_BODY.scope)
    })

    it('stub 通道按真计:failed/stubbed 不虚报送达', async () => {
      sendEmailMock.mockResolvedValue({
        sent: false,
        stub: true,
        provider: 'stub',
        reasons: ['smtp_disabled'],
      })
      const res = await server.inject({
        method: 'POST',
        url: '/api/admin/maintenance-notice/email',
        headers: AUTH_HEADERS,
        body: VALID_BODY,
      })
      const json = res.json() as {
        code: number
        data: { total: number; stats: { sent: number; failed: number; stubbed: number } }
      }
      expect(json.code).toBe(0)
      expect(json.data.stats).toEqual({ sent: 0, failed: 5, stubbed: 5 })
    })
  })

  describe('dryRun / limit', () => {
    it('dryRun=true → 不发送任何邮件,回收件人池统计', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/admin/maintenance-notice/email',
        headers: AUTH_HEADERS,
        body: { ...VALID_BODY, dryRun: true },
      })
      expect(res.statusCode).toBe(200)
      const json = res.json() as {
        code: number
        data: { dryRun: boolean; total: number; pool: number; subject: string }
      }
      expect(json.code).toBe(0)
      expect(json.data.dryRun).toBe(true)
      expect(json.data.total).toBe(5)
      expect(json.data.pool).toBe(5)
      expect(json.data.subject).toContain('例行维护通知')
      expect(sendEmailMock).not.toHaveBeenCalled()
    })

    it('limit=2 → 首批只发 2 封,pool 仍报全量 5', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/admin/maintenance-notice/email',
        headers: AUTH_HEADERS,
        body: { ...VALID_BODY, limit: 2 },
      })
      expect(res.statusCode).toBe(200)
      const json = res.json() as {
        code: number
        data: { total: number; pool: number; stats: { sent: number } }
      }
      expect(json.data.total).toBe(2)
      expect(json.data.pool).toBe(5)
      expect(json.data.stats.sent).toBe(2)
      expect(sendEmailMock).toHaveBeenCalledTimes(2)
      const second = sendEmailMock.mock.calls[1]?.[0] as { to: string }
      expect(second.to).toBe('user2@aizhs.top')
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
