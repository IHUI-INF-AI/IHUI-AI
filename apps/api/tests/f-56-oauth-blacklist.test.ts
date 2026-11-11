// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​‌​‌‍‍​​‌‌​​‌​‍‍​​‌​‌‌​‌‍‍​​​‌‌​‌‌​⁠

/**
 * F-56 回归锁(2026-11-11):OAuth 授权面必须叠加吊销黑名单。
 *
 * HEAD 已修:routes/oauth-authorization-server.ts 的 /oauth/authorize 与 /oauth/userinfo
 * 均经 plugins/auth.ts 的 isAccessTokenRevoked() 复用 authenticate() 同一份 Redis 黑名单。
 *
 * 本用例锁行为而不是锁实现:让 introspectAccessToken 对「已吊销」与「正常」token 都返回
 * active=true(模拟"签名/过期都通过"),仅黑名单命中不同 —— 若任一入口漏查黑名单,
 * 已吊销 token 就会换到新 code 或拿到 userinfo,用例即红。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const mocks = vi.hoisted(() => {
  process.env.OAUTH_WEB_AUTHORIZE_URL = 'https://web.example.com/oauth/authorize'
  const USER_ID = '00000000-0000-4000-8000-0000000000aa'
  const GOOD_TOKEN = 'good-access-token'
  const REVOKED_TOKEN = 'revoked-access-token'
  return {
    USER_ID,
    GOOD_TOKEN,
    REVOKED_TOKEN,
    // 两枚 token 都"验签通过、未过期":差异只在黑名单
    introspectAccessToken: vi.fn(async () => ({ active: true, sub: USER_ID })),
    findOAuthAppByClientId: vi.fn(),
    createOAuthSession: vi.fn(),
    createAuditLog: vi.fn(),
    findUserById: vi.fn(),
  }
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
    // plugins/auth.ts 的唯一黑名单出口会拿这个桩;只有 REVOKED_TOKEN 命中
    createBlacklist: () => ({
      has: async (token: string) => token === mocks.REVOKED_TOKEN,
    }),
    introspectAccessToken: mocks.introspectAccessToken,
  }
})

vi.mock('../src/db/index.js', () => ({
  db: { select: vi.fn() },
  dbRead: { select: vi.fn() },
  dbClient: {},
}))

vi.mock('../src/db/oauth-queries.js', () => ({
  findOAuthAppByClientId: mocks.findOAuthAppByClientId,
  createOAuthSession: mocks.createOAuthSession,
  createAuditLog: mocks.createAuditLog,
  listActiveScopeMeta: vi.fn(async () => []),
}))

vi.mock('../src/db/queries.js', () => ({
  findUserById: mocks.findUserById,
}))

vi.mock('../src/routes/auth-extended.js', () => ({
  precheckAuthorizePkce: () => null,
}))

import { oauthAuthorizationServerRoutes } from '../src/routes/oauth-authorization-server.js'

const APP = {
  id: 'app-f56',
  clientId: 'f56-client',
  clientSecret: 'f56-secret',
  clientSecretHash: null,
  name: 'F56 Test Client',
  redirectUris: ['https://client.example.com/cb'],
  scopes: ['read'],
  isActive: 1,
}

const AUTHORIZE_QUERY = {
  client_id: APP.clientId,
  redirect_uri: APP.redirectUris[0],
  response_type: 'code',
  state: 'state-f56',
  scope: 'read',
}

describe('F-56 OAuth authorize/userinfo 拒绝已吊销 access token', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify()
    await app.register(oauthAuthorizationServerRoutes)
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    mocks.findOAuthAppByClientId.mockReset()
    mocks.findOAuthAppByClientId.mockResolvedValue(APP)
    mocks.createOAuthSession.mockReset()
    mocks.createOAuthSession.mockResolvedValue(undefined)
    mocks.createAuditLog.mockReset()
    mocks.createAuditLog.mockResolvedValue(undefined)
    mocks.findUserById.mockReset()
    mocks.findUserById.mockImplementation(async (id: string) => ({
      id,
      nickname: 'tester',
      avatar: null,
      status: 1,
    }))
    mocks.introspectAccessToken.mockClear()
  })

  it('/oauth/authorize 遇黑名单 token:不签发 code(回 web 同意页)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/oauth/authorize',
      query: AUTHORIZE_QUERY,
      headers: { authorization: `Bearer ${mocks.REVOKED_TOKEN}` },
    })

    // 与既有「Bearer 不可用」同语义:302 回 web 同意页,不向客户端回跳 code
    expect(res.statusCode).toBe(302)
    const location = new URL(res.headers.location as string)
    expect(`${location.origin}${location.pathname}`).toBe(
      'https://web.example.com/oauth/authorize',
    )
    expect(location.searchParams.has('code')).toBe(false)
    expect(mocks.createOAuthSession).not.toHaveBeenCalled()
    expect(mocks.introspectAccessToken).toHaveBeenCalledWith(mocks.REVOKED_TOKEN)
  })

  it('/oauth/authorize 正常 token:照常签发 code(闸门不误伤)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/oauth/authorize',
      query: AUTHORIZE_QUERY,
      headers: { authorization: `Bearer ${mocks.GOOD_TOKEN}` },
    })

    expect(res.statusCode).toBe(302)
    const location = new URL(res.headers.location as string)
    expect(`${location.origin}${location.pathname}`).toBe(APP.redirectUris[0])
    expect(location.searchParams.get('code')).toBeTruthy()
    expect(location.searchParams.get('state')).toBe('state-f56')
    expect(mocks.createOAuthSession).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: APP.clientId, userId: mocks.USER_ID }),
    )
  })

  it('/oauth/userinfo 遇黑名单 token:401 invalid_token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/oauth/userinfo',
      headers: { authorization: `Bearer ${mocks.REVOKED_TOKEN}` },
    })

    expect(res.statusCode).toBe(401)
    expect(res.json()).toMatchObject({ error: 'invalid_token' })
    expect(mocks.introspectAccessToken).toHaveBeenCalledWith(mocks.REVOKED_TOKEN)
  })

  it('/oauth/userinfo 正常 token:仍返回 sub', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/oauth/userinfo',
      headers: { authorization: `Bearer ${mocks.GOOD_TOKEN}` },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ sub: mocks.USER_ID })
  })
})
