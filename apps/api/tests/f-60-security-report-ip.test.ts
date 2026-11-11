// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-60:未认证 POST /api/security/report 不得采信客户端传入的 ip,类型必须命中白名单。
 *
 * 判据:
 *  - 客户端指定 ip 被忽略,坏事件与异常事件一律记到 request.ip;
 *  - 非白名单 type ⇒ 400,不产生任何事件;
 *  - 白名单 type ⇒ 成功,reason 保留 user-report 低可信来源标记;
 *  - 限流(同 IP 5 次/分钟)行为不变。
 *
 * 不连真实 DB/Redis:安全服务全部 mock,db/config 亦 mock。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const { mockRecordBadEvent, mockRecordEvent } = vi.hoisted(() => ({
  mockRecordBadEvent: vi.fn().mockResolvedValue(undefined),
  mockRecordEvent: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(),
  requireActiveUser: vi.fn(),
}))

vi.mock('../src/db/index.js', () => ({
  db: { execute: vi.fn() },
  dbRead: { execute: vi.fn() },
  dbClient: {},
}))

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgres://mock:mock@localhost:5432/mock',
    REDIS_URL: 'redis://127.0.0.1:1/0',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    AI_SERVICE_URL: 'http://localhost:8803',
  },
}))

vi.mock('../src/services/captcha-service.js', () => ({
  getCaptchaService: () => ({}),
}))

vi.mock('../src/services/ip-reputation.js', () => ({
  getIpReputationService: () => ({
    recordBadEvent: mockRecordBadEvent,
  }),
  isPrivateIp: () => false,
}))

vi.mock('../src/services/anomaly-detector.js', () => ({
  getAnomalyDetector: () => ({
    recordEvent: mockRecordEvent,
  }),
}))

import { securityRoutes } from '../src/routes/security.js'

let app: FastifyInstance

function report(payload: Record<string, unknown>, remoteAddress: string) {
  return app.inject({
    method: 'POST',
    url: '/api/security/report',
    payload,
    remoteAddress,
  })
}

describe('F-60 匿名上报不得指定被上报 IP', () => {
  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(securityRoutes, { prefix: '/api/security' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('客户端传 ip ⇒ 忽略,坏事件只记到 request.ip', async () => {
    const res = await report(
      { type: 'spam', description: '对面在刷接口', ip: '9.9.9.9' },
      '203.0.113.7',
    )
    expect(res.statusCode).toBe(200)
    expect(mockRecordBadEvent).toHaveBeenCalledTimes(1)
    expect(mockRecordBadEvent).toHaveBeenCalledWith('203.0.113.7', 'user-report:spam')
    expect(mockRecordBadEvent).not.toHaveBeenCalledWith('9.9.9.9', expect.anything())
  })

  it('不传 ip ⇒ 同样落到 request.ip,异常事件同源', async () => {
    const res = await report({ type: 'scanning', description: '端口扫描' }, '203.0.113.8')
    expect(res.statusCode).toBe(200)
    expect(mockRecordBadEvent).toHaveBeenCalledWith('203.0.113.8', 'user-report:scanning')
    expect(mockRecordEvent).toHaveBeenCalledTimes(1)
    const event = mockRecordEvent.mock.calls[0]?.[0] as {
      ip: string
      dimensions: Array<{ name: string }>
    }
    expect(event.ip).toBe('203.0.113.8')
    expect(event.dimensions[0]?.name).toBe('user-report')
  })

  it('客户端指定 ip 时,异常事件也不得采信该 ip', async () => {
    const res = await report(
      { type: 'abuse', description: '滥用', ip: '9.9.9.9' },
      '203.0.113.9',
    )
    expect(res.statusCode).toBe(200)
    const event = mockRecordEvent.mock.calls[0]?.[0] as { ip: string }
    expect(event.ip).toBe('203.0.113.9')
  })

  it('非白名单 type ⇒ 400 且不产生任何事件', async () => {
    const res = await report({ type: 'x', description: '任意类型' }, '203.0.113.10')
    expect(res.statusCode).toBe(400)
    expect(res.json().message).toContain('不支持的上报类型')
    expect(mockRecordBadEvent).not.toHaveBeenCalled()
    expect(mockRecordEvent).not.toHaveBeenCalled()
  })

  it('限流:同 IP 第 6 次 ⇒ 429(5 次/分钟不变)', async () => {
    for (let i = 0; i < 5; i += 1) {
      const ok = await report({ type: 'other', description: `第 ${i} 次` }, '203.0.113.11')
      expect(ok.statusCode).toBe(200)
    }
    const limited = await report({ type: 'other', description: '第 6 次' }, '203.0.113.11')
    expect(limited.statusCode).toBe(429)
    expect(mockRecordBadEvent).toHaveBeenCalledTimes(5)
  })
})
