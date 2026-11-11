// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-71(P2,越权读取/删除):`/api/callback-log` 的日志是全站维度(进程内 Map,无 userId 归属),
 * 修前读/删只走 `checkAuth` —— 任意登录用户可读全站回调请求体(手机号/订单号/第三方报文),
 * 并可删除他人的回调证据。
 *
 * 本文件钉四件事:
 *  ① 列表 / 详情 / 删除对普通用户(roleId 0)一律 403,且删除**没有发生**(日志仍可被管理员读到);
 *  ② 匿名 401;
 *  ③ 管理员正向对照:能读列表、能读到含请求体的详情、能删除(否则"整片写死 403"也算修好了);
 *  ④ 删除不存在的 id 仍返回既有 404 形状,与"先存在后删除"的 404 不再可区分(不泄露存在性)。
 *
 * 写入端点(POST /call|/sms|/payment)按票面约定保留原 `checkAuth`,不在本文件收口。
 */
import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const { mockAuthenticate, mockConfig } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
  // 档位置 off:本文件只验管理员判定,不验 TOTP 闸(由 admin-totp-gate.test.ts 覆盖)
  mockConfig: { ADMIN_TOTP_MODE: 'off' } as { ADMIN_TOTP_MODE?: string },
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
  requireActiveUser: vi.fn(),
  checkAuth: async (
    request: TestRequest,
    reply: { status: (code: number) => { send: (body: unknown) => void } },
  ): Promise<boolean> => {
    try {
      await mockAuthenticate(request)
      return true
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      reply.status(statusCode).send({ code: statusCode, message: 'Authentication required' })
      return false
    }
  },
}))

vi.mock('../src/config/index.js', () => ({ config: mockConfig }))
vi.mock('../src/db/index.js', () => ({ db: {}, dbRead: {}, dbClient: {} }))
vi.mock('../src/db/rbac-queries.js', () => ({ checkAnyPermission: vi.fn() }))
vi.mock('../src/utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { callbackLogRoutes } from '../src/routes/callback-log.js'

interface TestRequest {
  userId?: string
  jwtPayload?: { userId?: string; roleId?: number }
}

function asUser(roleId: number, userId = 'u-71'): void {
  mockAuthenticate.mockImplementation(async (request: TestRequest) => {
    request.userId = userId
    request.jwtPayload = { userId, roleId }
  })
}

function asAnonymous(): void {
  const err = new Error('Authentication required') as Error & { statusCode?: number }
  err.statusCode = 401
  mockAuthenticate.mockRejectedValue(err)
}

let app: FastifyInstance

beforeAll(async () => {
  app = Fastify({ logger: false })
  await app.register(callbackLogRoutes, { prefix: '/api/callback-log' })
  await app.ready()
})

afterAll(async () => {
  await app?.close()
})

beforeEach(() => {
  mockAuthenticate.mockReset()
})

/** 以普通登录用户身份写入一条日志(写端点保留 checkAuth),返回其 id。 */
async function createLog(payload: Record<string, unknown>): Promise<string> {
  asUser(0)
  const res = await app.inject({ method: 'POST', url: '/api/callback-log/call', payload })
  expect(res.statusCode).toBe(200)
  return (res.json() as { data: { callbackId: string } }).data.callbackId
}

describe('F-71 普通登录用户不得读/删全站回调日志', () => {
  it('GET /list → 403,且响应不带任何日志条目', async () => {
    await createLog({ biz_type: 'payment', biz_id: 'order-71' })
    asUser(0)
    const res = await app.inject({ method: 'GET', url: '/api/callback-log/list' })
    expect(res.statusCode).toBe(403)
    const body = res.json() as { code: number; data?: unknown }
    expect(body.code).toBe(403)
    expect(body.data).toBeUndefined()
  })

  it('GET /:id → 403,请求体(手机号)不外泄', async () => {
    const id = await createLog({ biz_type: 'sms', phone: '13800007171' })
    asUser(0)
    const res = await app.inject({ method: 'GET', url: `/api/callback-log/${id}` })
    expect(res.statusCode).toBe(403)
    expect(res.body).not.toContain('13800007171')
  })

  it('DELETE /:id → 403,且日志仍然存在(越权删除没有发生)', async () => {
    const id = await createLog({ biz_type: 'call', biz_id: 'biz-71-delete' })
    asUser(0)
    const del = await app.inject({ method: 'DELETE', url: `/api/callback-log/${id}` })
    expect(del.statusCode).toBe(403)

    asUser(1)
    const detail = await app.inject({ method: 'GET', url: `/api/callback-log/${id}` })
    expect(detail.statusCode).toBe(200)
    expect((detail.json() as { data: { log: { id: string } } }).data.log.id).toBe(id)
  })

  it('匿名访问列表/详情/删除 → 401', async () => {
    const id = await createLog({ biz_type: 'sms', phone: '13800007172' })
    asAnonymous()
    const routes: Array<[string, string]> = [
      ['GET', '/api/callback-log/list'],
      ['GET', `/api/callback-log/${id}`],
      ['DELETE', `/api/callback-log/${id}`],
    ]
    for (const [method, url] of routes) {
      const res = await app.inject({ method: method as 'GET' | 'DELETE', url })
      expect(res.statusCode, `${method} ${url}`).toBe(401)
    }
  })
})

describe('F-71 管理员正向对照', () => {
  it('管理员可读列表、详情(含请求体),并可删除', async () => {
    const id = await createLog({ biz_type: 'payment', biz_id: 'order-71-admin', phone: '13900007171' })

    asUser(1)
    const list = await app.inject({ method: 'GET', url: '/api/callback-log/list?limit=100' })
    expect(list.statusCode).toBe(200)
    const items = (list.json() as { data: { items: Array<{ id: string }> } }).data.items
    expect(items.some((e) => e.id === id)).toBe(true)

    const detail = await app.inject({ method: 'GET', url: `/api/callback-log/${id}` })
    expect(detail.statusCode).toBe(200)
    const log = (detail.json() as { data: { log: { requestBody: string } } }).data.log
    expect(log.requestBody).toContain('13900007171')

    const del = await app.inject({ method: 'DELETE', url: `/api/callback-log/${id}` })
    expect(del.statusCode).toBe(200)
    expect((del.json() as { data: { id: string; deleted: boolean } }).data).toEqual({
      id,
      deleted: true,
    })

    const gone = await app.inject({ method: 'GET', url: `/api/callback-log/${id}` })
    expect(gone.statusCode).toBe(404)
  })
})

describe('F-71 删除不存在的 id 不泄露存在性', () => {
  it('从未存在的 id 与刚被删除的 id 返回同一 404 形状', async () => {
    const id = await createLog({ biz_type: 'call', biz_id: 'biz-71-gone' })
    asUser(1)
    const first = await app.inject({ method: 'DELETE', url: `/api/callback-log/${id}` })
    expect(first.statusCode).toBe(200)
    const again = await app.inject({ method: 'DELETE', url: `/api/callback-log/${id}` })
    const never = await app.inject({ method: 'DELETE', url: '/api/callback-log/cbl_never_exists' })

    expect(again.statusCode).toBe(404)
    expect(never.statusCode).toBe(404)
    expect(again.json()).toEqual(never.json())
    expect(never.json()).toEqual({ code: 404, message: '日志不存在' })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
