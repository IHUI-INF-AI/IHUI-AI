// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-102 回归锁(2026-11-08,apps/api P1 越权组)。
 *
 * 病灶:/ai/llm/chat 转发 ai-service 时构造 metadata 的顺序是
 * `{ userId: request.userId, ...客户端 metadata }` —— 客户端把 metadata.userId 写成受害者
 * UUID 即可覆盖服务端主体;ai-service 随后用该 userId 签回调票,替他人扣费/写他人会话。
 *
 * 判据:转发体里的 metadata.userId 必须恒等于认证用户,其余客户端 metadata 键原样保留。
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const ME = '00000000-0000-4000-8000-0000000000aa'
const VICTIM = '00000000-0000-4000-8000-0000000000bb'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.ADMIN_TOTP_MODE = 'off'
})

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(async (request: { headers: Record<string, unknown> }) => {
    const userId = request.headers['x-test-user'] as string
    Object.assign(request, { userId, jwtPayload: { userId, roleId: 0 } })
  }),
  requireActiveUser: vi.fn(async () => {}),
}))

vi.mock('../src/db/index.js', () => ({
  db: { select: vi.fn(), insert: vi.fn() },
  dbRead: { select: vi.fn() },
  dbClient: {},
}))

import { aiFrontendRoutes } from '../src/routes/ai-frontend-routes.js'

describe('F-102 /ai/llm/chat 不得采信客户端 metadata.userId', () => {
  let app: FastifyInstance
  const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ text: 'ok' }) }))

  beforeAll(async () => {
    vi.stubGlobal('fetch', fetchMock)
    app = Fastify()
    await app.register(aiFrontendRoutes)
    await app.ready()
  })
  afterAll(async () => {
    await app.close()
    vi.unstubAllGlobals()
  })

  it('客户端伪造 metadata.userId 被服务端主体覆盖,其余键原样透传', async () => {
    fetchMock.mockClear()
    const res = await app.inject({
      method: 'POST',
      url: '/ai/llm/chat',
      headers: { 'x-test-user': ME },
      payload: {
        messages: [{ role: 'user', content: 'hi' }],
        metadata: { userId: VICTIM, traceId: 't-1' },
      },
    })
    expect(res.statusCode).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const init = fetchMock.mock.calls[0]?.[1] as { body?: string }
    const forwarded = JSON.parse(init.body ?? '{}') as {
      metadata?: { userId?: string; traceId?: string }
    }
    expect(forwarded.metadata?.userId).toBe(ME)
    expect(forwarded.metadata?.traceId).toBe('t-1')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
