// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-56 回归锁(2026-11-08,apps/api P1 越权组)。
 *
 * 病灶:OAuth/OIDC 面(introspect 驱动的 /oauth/authorize Bearer 分支与 /oauth/userinfo)
 * 只做 JWT 验签,不经过 authenticate(),因此登出/踢下线写进 Redis 黑名单的 access token
 * 仍能换 code、拉 userinfo。
 *
 * 判据:同一枚「验签通过但已吊销」的 token 必须与过期 token 同档(401 invalid_token);
 * 未吊销 token 行为不变(200)。黑名单走真实 isAccessTokenRevoked → createBlacklist 桩。
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const USER_ID = '00000000-0000-4000-8000-0000000000aa'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

vi.mock('ioredis', () => ({
  default: class FakeRedis {
    on() {
      return this
    }
  },
}))

vi.mock('@ihui/auth', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    // 只把 "revoked-token" 视为命中的吊销黑名单;其余 token 未命中
    createBlacklist: () => ({ has: async (token: string) => token === 'revoked-token' }),
    introspectAccessToken: vi.fn(async (token: string) =>
      token === 'opaque-unknown' ? { active: false } : { active: true, sub: USER_ID },
    ),
  }
})

vi.mock('../src/db/index.js', () => ({
  db: { select: vi.fn() },
  dbRead: { select: vi.fn() },
  dbClient: {},
}))

vi.mock('../src/db/queries.js', () => ({
  findUserById: vi.fn(async (id: string) => ({ id, nickname: 'u', avatar: null })),
}))

import { oauthAuthorizationServerRoutes } from '../src/routes/oauth-authorization-server.js'

describe('F-56 OAuth 面必须识别已吊销 access token', () => {
  let app: FastifyInstance
  beforeAll(async () => {
    app = Fastify()
    await app.register(oauthAuthorizationServerRoutes)
    await app.ready()
  })
  afterAll(async () => {
    await app.close()
  })

  it('已吊销但验签通过的 token 拉 userinfo → 401 invalid_token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/oauth/userinfo',
      headers: { authorization: 'Bearer revoked-token' },
    })
    expect(res.statusCode).toBe(401)
    expect(res.json()).toMatchObject({ error: 'invalid_token' })
  })

  it('未吊销的 token 仍正常返回 sub(闸门不误伤)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/oauth/userinfo',
      headers: { authorization: 'Bearer good-token' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ sub: USER_ID })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
