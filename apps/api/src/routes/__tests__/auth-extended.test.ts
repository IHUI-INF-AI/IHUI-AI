import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { createHash } from 'node:crypto'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:8810/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.REDIS_URL ??= 'redis://localhost:8811/0'
})

const pkceMocks = vi.hoisted(() => ({
  findSessionByCode: vi.fn(),
  markSessionUsed: vi.fn(),
  createAuditLog: vi.fn(),
  findUserById: vi.fn(),
  saveRefreshToken: vi.fn(),
  signAccessToken: vi.fn(),
  signRefreshToken: vi.fn(),
}))

vi.mock('../../db/oauth-queries.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    findSessionByCode: pkceMocks.findSessionByCode,
    markSessionUsed: pkceMocks.markSessionUsed,
    createAuditLog: pkceMocks.createAuditLog,
  }
})

vi.mock('../../db/queries.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    findUserById: pkceMocks.findUserById,
    saveRefreshToken: pkceMocks.saveRefreshToken,
  }
})

vi.mock('@ihui/auth', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    signAccessToken: pkceMocks.signAccessToken,
    signRefreshToken: pkceMocks.signRefreshToken,
  }
})

import { authExtendedRoutes } from '../auth-extended.js'

describe('Auth Extended API', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(authExtendedRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  describe('Route registration', () => {
    it('should register the route plugin without throwing', () => {
      expect(app).toBeDefined()
    })
  })

  describe('公开端点（不依赖 db 的配置查询）', () => {
    it('GET /api/auth/google/config 返回 200 与 configured 字段', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/auth/google/config' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data).toHaveProperty('configured')
    })

    it('GET /api/sms-proxy/config 返回 200 与 provider 字段（dev 模式）', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/sms-proxy/config' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data).toHaveProperty('configured')
      expect(body.data).toHaveProperty('provider')
    })

    it('GET /api/oauth/sms-config 返回 200 与 provider 字段', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/oauth/sms-config' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data).toHaveProperty('provider')
    })

    it('GET /api/oauth/sms-login 返回 200 与页面配置', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/oauth/sms-login' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.page).toBe('sms-login')
      expect(body.data).toHaveProperty('smsConfigured')
      expect(body.data).toHaveProperty('sendCodeEndpoint')
      expect(body.data).toHaveProperty('verifyEndpoint')
    })

    it('GET /api/oauth/token/test 无 Bearer token 返回 401', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/oauth/token/test' })
      expect(res.statusCode).toBe(401)
    })

    it('GET /api/oauth/token/test 无效 token 返回 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/oauth/token/test',
        headers: { authorization: 'Bearer invalid-token' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('POST /api/auth/pat 无 body 返回 400 参数错误', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/auth/pat' })
      expect(res.statusCode).toBe(400)
    })

    it('POST /api/auth/pat/async 无 body 返回 400 参数错误', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/auth/pat/async' })
      expect(res.statusCode).toBe(400)
    })

    it('POST /api/auth/pat 空 token 返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/pat',
        payload: { token: '' },
      })
      expect(res.statusCode).toBe(400)
    })
  })

  describe('Endpoints (401 without auth)', () => {
    const protectedEndpoints: Array<{
      method: 'GET' | 'POST' | 'PUT' | 'DELETE'
      url: string
      payload?: Record<string, unknown>
    }> = [
      { method: 'GET', url: '/api/auth/info' },
      { method: 'PUT', url: '/api/auth/profile', payload: {} },
      { method: 'PUT', url: '/api/auth/profile/password', payload: {} },
      { method: 'DELETE', url: '/api/auth/cancel' },
      {
        method: 'POST',
        url: '/api/auth/wechat/mini/phone?code=mock',
        payload: {},
      },
      {
        method: 'POST',
        url: '/api/auth/wechat/mini/rebind?code=mock',
        payload: {},
      },
      {
        method: 'GET',
        url: '/api/auth/oauth/authorize?client_id=mock&redirect_uri=http://localhost&state=s&scope=openid',
      },
      { method: 'POST', url: '/api/auth/oauth/apps/create', payload: {} },
      { method: 'GET', url: '/api/auth/oauth/apps/list' },
      { method: 'DELETE', url: '/api/auth/oauth/apps/mock-client-id' },
      { method: 'GET', url: '/api/auth/oauth/my-authorized' },
      { method: 'DELETE', url: '/api/auth/oauth/my-authorized/mock-session-id' },
      { method: 'GET', url: '/api/auth/bindings' },
      { method: 'DELETE', url: '/api/auth/bindings/mock-id' },
      { method: 'POST', url: '/api/auth/bindings/remove', payload: { uuid: 'u', platform: 'p' } },
      { method: 'POST', url: '/api/auth/user-sk/create', payload: {} },
      { method: 'GET', url: '/api/auth/user-sk/list' },
      { method: 'PUT', url: '/api/auth/user-sk/mock-sk-id', payload: {} },
      { method: 'DELETE', url: '/api/auth/user-sk/mock-sk-id' },
      {
        method: 'POST',
        url: '/api/oauth/debug/create-test-session',
        payload: {},
      },
    ]

    for (const { method, url, payload } of protectedEndpoints) {
      it(`${method} ${url}`, async () => {
        const res = await app.inject({ method, url, payload })
        expect(res.statusCode).toBe(401)
      })
    }
  })

  describe('PKCE 安全校验', () => {
    const VALID_VERIFIER = 'valid-verifier'
    const VALID_CHALLENGE = createHash('sha256').update(VALID_VERIFIER).digest('base64url')
    const mockSession = {
      id: 'sess-1',
      code: 'test-code',
      isUsed: false,
      expiresAt: new Date(Date.now() + 60000),
      codeChallenge: VALID_CHALLENGE,
      codeChallengeMethod: 'S256',
      clientId: 'zhs_test_client',
      userId: 'user-1',
    }
    const mockUser = {
      id: 'user-1',
      phone: '13800000000',
      roleId: 0,
      familyId: 'fam-1',
    }

    beforeEach(() => {
      pkceMocks.findSessionByCode.mockResolvedValue({ ...mockSession })
      pkceMocks.markSessionUsed.mockResolvedValue(undefined)
      pkceMocks.createAuditLog.mockResolvedValue(undefined)
      pkceMocks.findUserById.mockResolvedValue({ ...mockUser })
      pkceMocks.saveRefreshToken.mockResolvedValue(undefined)
      pkceMocks.signAccessToken.mockResolvedValue('mock-access-token')
      pkceMocks.signRefreshToken.mockResolvedValue('mock-refresh-token')
    })

    it('client_id 不匹配返回 400(消息含 client_id)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/oauth/pkce/token',
        payload: {
          code: 'test-code',
          client_id: 'wrong-client',
          code_verifier: VALID_VERIFIER,
        },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().message).toContain('client_id')
    })

    it('code_verifier 错误返回 400(消息含 code_verifier)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/oauth/pkce/token',
        payload: {
          code: 'test-code',
          client_id: 'zhs_test_client',
          code_verifier: 'invalid-verifier',
        },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().message).toContain('code_verifier')
    })

    it('code_verifier 正确返回 200(timingSafeEqual 路径正常)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/oauth/pkce/token',
        payload: {
          code: 'test-code',
          client_id: 'zhs_test_client',
          code_verifier: VALID_VERIFIER,
        },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.access_token).toBe('mock-access-token')
      expect(body.data.refresh_token).toBe('mock-refresh-token')
      expect(body.data.token_type).toBe('Bearer')
    })

    it('codeChallenge 长度不等时返回 400(不抛异常)', async () => {
      pkceMocks.findSessionByCode.mockResolvedValue({
        ...mockSession,
        codeChallenge: 'short',
      })
      const res = await app.inject({
        method: 'POST',
        url: '/api/oauth/pkce/token',
        payload: {
          code: 'test-code',
          client_id: 'zhs_test_client',
          code_verifier: VALID_VERIFIER,
        },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().message).toContain('code_verifier')
    })
  })

  // ============================================================================
  // 第三方登录统一回调 POST /api/auth/:platform/callback
  // 验证 4 扫码平台(微信/企业微信/钉钉/飞书)+ github + alipay 路由注册 + 参数校验 +
  // 未配置场景 + 平台枚举校验。承接上一 agent "下一步建议 — OAuthCallbackHandler 4 平台
  // code 交换联调",补全 /auth/:platform/callback 路由的测试覆盖。
  // ============================================================================
  describe('POST /api/auth/:platform/callback — 第三方登录统一回调', () => {
    const supportedPlatforms = [
      'wechat',
      'enterpriseWechat',
      'dingtalk',
      'feishu',
      'google',
      'github',
      'apple',
      'alipay',
    ] as const

    it('路由注册:8 平台均返回非 404(参数缺失时 400,未配置时 400)', async () => {
      for (const platform of supportedPlatforms) {
        const res = await app.inject({
          method: 'POST',
          url: `/api/auth/${platform}/callback`,
          payload: {},
        })
        expect(res.statusCode, `${platform} should not 404`).not.toBe(404)
      }
    })

    it('参数校验:缺 code 返回 400 + 参数错误', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/wechat/callback',
        payload: {},
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.code).toBe(400)
    })

    it('参数校验:缺 state 返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/wechat/callback',
        payload: { code: 'fake-code' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('平台枚举:不支持的 platform 返回 400 + "不支持的平台"', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/unknown_platform/callback',
        payload: { code: 'fake', state: 'fake' },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().message).toContain('不支持的平台')
    })

    it('微信未配置:返回 400 + "微信 OAuth 未配置"', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/wechat/callback',
        payload: { code: 'fake', state: 'fake' },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().message).toContain('微信')
    })

    it('企业微信未配置:返回 400 + "企业微信未配置"', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/enterpriseWechat/callback',
        payload: { code: 'fake', state: 'fake' },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().message).toContain('企业微信')
    })

    it('钉钉未配置:返回 400 + "钉钉 OAuth 未配置"', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/dingtalk/callback',
        payload: { code: 'fake', state: 'fake' },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().message).toContain('钉钉')
    })

    it('飞书未配置:返回 400 + "飞书 OAuth 未配置"', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/feishu/callback',
        payload: { code: 'fake', state: 'fake' },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().message).toContain('飞书')
    })

    it('GET 兼容版本:GET /api/auth/wechat/callback?code=fake&state=fake 同样可路由(转发到 POST)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/wechat/callback?code=fake&state=fake',
      })
      // GET 版本内部转发到 POST handler,应返回相同结果(400 微信未配置)
      expect(res.statusCode).toBe(400)
      expect(res.json().message).toContain('微信')
    })
  })
})
