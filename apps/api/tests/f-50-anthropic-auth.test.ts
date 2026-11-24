// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-50 回归锁(P2,2026-11-11)。
 *
 * 病灶:`/api/ai/anthropic/*` 两条代理路由(POST /anthropic/chat、GET /anthropic/models)
 *       拿平台 ANTHROPIC_API_KEY 直连上游,却没有任何 requireAuth 口径的 preHandler;
 *       `ensurePointsBalance` 在无 userId 时 `return true`(把鉴权交给 requireAuth),
 *       `chargePointsForCall` 在无 userId 时直接 return ⇒ 非生产档位(AUTH_DEFAULT_DENY_MODE
 *       非 enforce)下匿名即可免费调用平台 Key。
 *
 * 判据(全部走 fastify.inject,不连 DB / 不打上游):
 *  ① 匿名 POST /anthropic/chat → 401,且 callVendor 一次都不打(平台 Key 不出站);
 *  ② 匿名 GET  /anthropic/models → 401,且 callVendor 一次都不打;
 *  ③ 正向对照:已认证请求仍能走通两条路由(证明不是"整片拦死")。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const mocks = vi.hoisted(() => ({
  checkAuth: vi.fn(),
  callVendor: vi.fn(),
  recordUsage: vi.fn(),
  ensurePointsBalance: vi.fn(),
  chargePointsForCall: vi.fn(),
}))

vi.mock('../src/plugins/auth.js', () => ({
  checkAuth: mocks.checkAuth,
  authenticate: vi.fn(),
}))
vi.mock('../src/routes/ai-vendors/proxy-llm.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    ensurePointsBalance: mocks.ensurePointsBalance,
    chargePointsForCall: mocks.chargePointsForCall,
  }
})
vi.mock('../src/routes/ai-vendors/_shared.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return { ...actual, callVendor: mocks.callVendor, recordUsage: mocks.recordUsage }
})

import { aiVendorRoutes } from '../src/routes/ai-vendors.js'

function makeApp(): FastifyInstance {
  const app = Fastify()
  app.register(aiVendorRoutes, { prefix: '/api/ai' })
  return app
}

describe('F-50 /api/ai/anthropic/* 必须服务端鉴权', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    mocks.checkAuth.mockReset()
    mocks.callVendor.mockReset()
    mocks.recordUsage.mockReset()
    mocks.ensurePointsBalance.mockReset()
    mocks.chargePointsForCall.mockReset()

    // 模拟真实 checkAuth:无凭据 → 401 并返回 false;带 Bearer 测试票 → 注入 userId 放行。
    mocks.checkAuth.mockImplementation(async (request, reply) => {
      if (request.headers.authorization === 'Bearer f50-ok') {
        request.userId = 'f50-user'
        return true
      }
      reply.status(401).send({ code: 401, message: 'Authentication required' })
      return false
    })
    mocks.ensurePointsBalance.mockResolvedValue(true)
    mocks.callVendor.mockResolvedValue({ id: 'msg_f50', usage: { input_tokens: 1, output_tokens: 1 } })

    app = makeApp()
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
  })

  it('匿名 POST /anthropic/chat → 401,且不打上游', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/ai/anthropic/chat',
      payload: { model: 'claude-sonnet-4-5', messages: [{ role: 'user', content: 'hi' }] },
    })
    expect(res.statusCode).toBe(401)
    expect(mocks.callVendor).not.toHaveBeenCalled()
    expect(mocks.chargePointsForCall).not.toHaveBeenCalled()
  })

  it('匿名 GET /anthropic/models → 401,且不打上游', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/ai/anthropic/models' })
    expect(res.statusCode).toBe(401)
    expect(mocks.callVendor).not.toHaveBeenCalled()
  })

  it('伪造 Upgrade: websocket 头也不能绕过鉴权', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/ai/anthropic/chat',
      headers: { upgrade: 'websocket' },
      payload: { model: 'claude-sonnet-4-5', messages: [{ role: 'user', content: 'hi' }] },
    })
    expect(res.statusCode).toBe(401)
    expect(mocks.callVendor).not.toHaveBeenCalled()
  })

  it('正向对照:已认证请求仍可走通两条路由', async () => {
    const chat = await app.inject({
      method: 'POST',
      url: '/api/ai/anthropic/chat',
      headers: { authorization: 'Bearer f50-ok' },
      payload: { model: 'claude-sonnet-4-5', messages: [{ role: 'user', content: 'hi' }] },
    })
    expect(chat.statusCode).toBe(200)
    expect(mocks.callVendor).toHaveBeenCalledTimes(1)

    const models = await app.inject({
      method: 'GET',
      url: '/api/ai/anthropic/models',
      headers: { authorization: 'Bearer f50-ok' },
    })
    expect(models.statusCode).toBe(200)
    expect(mocks.callVendor).toHaveBeenCalledTimes(2)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
