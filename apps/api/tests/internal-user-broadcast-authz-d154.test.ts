// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D154(2026-09-30 立)MCP 状态内部下行入口的**归属与不出声即失败**回归。
 * 权威口径:`docs/AI_CHAT_BENCHMARK_ANALYSIS_V4.md` §11.3 + §十 D154 第 3/6 栏;
 * AGENTS §5「认证不等于授权」+ §5e「失败必须响」。
 *
 * 钉住的五格,每格都是"账面绿而用户看不见/看见别人的"那一型:
 *  A 没有已验证主体 ⇒ 拒发,且**一条广播都不许出**(预检失败后继续广播 = 把状态推给全表)。
 *  B 请求体里自报 `userId` ⇒ strict schema 直接 400,而不是"自报身份赢了"。
 *  C 合法请求 ⇒ 收信人取**承载层注入的主体**;payload 里塞别的 userId 也改不动它。
 *    这一格同时是"越权用例要断言未发出查询"的镜像:这里断言的是"发给谁"。
 *  D `attempt` 与 `maxAttempts` 只给一半 ⇒ 唯一构造出口抛 ⇒ 400(文案需要两格,
 *    只推一半会让端上渲染成"第 2/ 次重连")。
 *  E 发射失败 ⇒ 响应仍是 200(投递没到不等于状态没收到),但**必须出声**(log.warn)。
 *
 * 不连库、不连真 WS:`broadcastToUser` 是装饰器,这里直接桩掉。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://localhost:8810/test',
    REDIS_URL: 'redis://localhost:8811',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
  },
}))

const { mockInternalToken, mockBroadcast } = vi.hoisted(() => ({
  // 每个用例改这两件事:① 验票成功与否(以及验票成功后注入哪个主体)② 广播有没有真发出去
  mockInternalToken: vi.fn(),
  mockBroadcast: vi.fn(),
}))

vi.mock('../src/plugins/internal-service-token.js', () => ({
  checkInternalServiceToken: mockInternalToken,
}))

/** 验票插件的真实语义:成功时自己往 request 上注入 userId,失败时已回过 reply。 */
function principalInjectedAs(userId: string | undefined) {
  mockInternalToken.mockImplementation(async (request: { userId?: string }, reply: unknown) => {
    if (userId === undefined) {
      void reply
      return false
    }
    request.userId = userId
    return true
  })
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  // 路由按装饰器调用;D153 已把这条装饰器装进真实启动链,这里给同形桩。
  type WithBroadcast = FastifyInstance & { broadcastToUser: (userId: string, event: string, data: unknown) => void }
  ;(app as WithBroadcast).broadcastToUser = mockBroadcast
  const routes = (await import('../src/routes/internal-user-broadcast.js')).default
  await app.register(routes)
  await app.ready()
  return app
}

const GOOD = { server: 'mcp-a', state: 'failed', reason: 'EOF on stdio' }

describe('D154 内部 user-broadcast 入口', () => {
  beforeEach(() => {
    mockInternalToken.mockReset()
    mockBroadcast.mockReset()
    principalInjectedAs(undefined)
  })

  it('A 无已验证主体 ⇒ 非 2xx 且一条广播都不发', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/internal/user-broadcast/mcp-status',
      payload: GOOD,
    })
    expect([401, 403]).toContain(res.statusCode)
    expect(mockBroadcast).not.toHaveBeenCalled()
    await app.close()
  })

  it('B 请求体自报 userId ⇒ strict schema 400,不发帧', async () => {
    principalInjectedAs('user-owner')
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/internal/user-broadcast/mcp-status',
      payload: { ...GOOD, userId: 'user-victim' },
    })
    expect(res.statusCode).toBe(400)
    expect(mockBroadcast).not.toHaveBeenCalled()
    await app.close()
  })

  it('C 收信人取承载层主体,而不是自报值', async () => {
    principalInjectedAs('user-owner')
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/internal/user-broadcast/mcp-status',
      payload: GOOD,
    })
    expect(res.statusCode).toBe(200)
    expect(mockBroadcast).toHaveBeenCalledTimes(1)
    const [userId, event, data] = mockBroadcast.mock.calls[0] as [string, string, Record<string, unknown>]
    expect(userId).toBe('user-owner')
    expect(event).toBe('mcp:status')
    expect(data.server).toBe('mcp-a')
    expect(data.state).toBe('failed')
    expect(data).not.toHaveProperty('userId')
    await app.close()
  })

  it('D attempt 缺 maxAttempts ⇒ 唯一构造出口拒,归 400 而不是推半帧', async () => {
    principalInjectedAs('user-owner')
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/internal/user-broadcast/mcp-status',
      payload: { ...GOOD, state: 'reconnecting', attempt: 2 },
    })
    expect(res.statusCode).toBe(400)
    expect(mockBroadcast).not.toHaveBeenCalled()
    await app.close()
  })

  it('E 发射失败仍回 200,但必须出声(不把"下行没到"演成"状态没收到")', async () => {
    principalInjectedAs('user-owner')
    mockBroadcast.mockImplementation(() => {
      throw new Error('no live connection for this user')
    })
    const app = Fastify({ logger: false })
    ;(app as FastifyInstance & { broadcastToUser: (u: string, e: string, d: unknown) => void }).broadcastToUser =
      mockBroadcast
    const spy = vi.fn()
    app.log.warn = spy
    await app.register((await import('../src/routes/internal-user-broadcast.js')).default)
    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/api/internal/user-broadcast/mcp-status',
      payload: GOOD,
    })
    expect(res.statusCode).toBe(200)
    expect(spy).toHaveBeenCalled()
    await app.close()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
