// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// F-185 夹具:分享 Key 的总额度与受众必须真正生效。
//
// 改前:
// - authenticateShareToken 从不读 maxTotalTokens/usedTotalTokens,超额请求照常放行;
// - 从不读 sharedWithUserId,任何拿到 share token 的人都能用;
// - incrementUsage 全仓零调用,usedTotalTokens 恒 0(见 relay-billing-service.test.ts 的累加用例)。
// 改后:
// - maxTotalTokens 用尽 → 429 SHARE_QUOTA_EXCEEDED;
// - sharedWithUserId 非空时要求 X-Share-User-Token(该用户 access token)且 userId 匹配,否则 403。

import { describe, expect, it, vi, beforeEach } from 'vitest'

const fixture = vi.hoisted(() => ({
  state: {
    share: null as unknown,
    /** verifyAccessToken 的返回;null = 令牌无效 */
    audiencePayload: null as { userId: string } | null,
  },
}))

const authMock = vi.hoisted(() => ({
  verifyAccessToken: vi.fn(),
}))

function fakeKeyRow(over: Record<string, unknown> = {}) {
  return {
    id: 'key-1',
    userId: 'user-1',
    name: '测试密钥',
    key: 'ihui_test_key',
    secret: 'hashed',
    status: 'active',
    permissions: ['chat:write'],
    rateLimit: 60,
    expiresAt: null,
    allowedIps: null,
    allowedModels: null,
    maxTokensPerReq: null,
    blockedIps: null,
    rateLimit5h: null,
    rateLimit1d: null,
    rateLimit7d: null,
    perModelRpmLimit: null,
    perModelTpmLimit: null,
    ...over,
  }
}

function fakeShare(over: Record<string, unknown> = {}) {
  return {
    id: 'share-1',
    sourceApiKeyId: 'key-1',
    revokedAt: null,
    expiresAt: new Date(Date.now() + 3_600_000),
    scopeModels: null,
    scopeEndpoints: null,
    rateLimitRpm: 60,
    rateLimitTpm: 100_000,
    maxTotalTokens: null,
    usedTotalTokens: 0,
    sharedWithUserId: null,
    sourceKey: fakeKeyRow(),
    ownerStatus: 1,
    ...over,
  }
}

vi.mock('../src/db/index.js', () => ({
  db: {
    select: vi.fn(() => {
      const chain: Record<string, unknown> = {}
      chain.innerJoin = vi.fn(() => chain)
      chain.from = vi.fn(() => chain)
      chain.where = vi.fn(() => ({
        limit: vi.fn(async () => [{ key: fakeKeyRow(), userStatus: 1 }]),
      }))
      return chain
    }),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        // 鉴权里是 await ...where(...) (带 .catch),其它路径用 .where(...).returning()
        where: vi.fn(() => {
          const p = Promise.resolve(undefined) as Promise<undefined> & {
            returning: () => Promise<Array<{ id: string }>>
          }
          p.returning = vi.fn(async () => [{ id: 'key-1' }])
          return p
        }),
      })),
    })),
  },
  dbRead: { select: vi.fn() },
}))

vi.mock('@ihui/database', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return actual
})

vi.mock('@ihui/auth', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    verifyAccessToken: authMock.verifyAccessToken,
  }
})

vi.mock('../src/config/index.js', () => ({
  config: { API_KEY_REQUIRE_SECRET: true, API_KEY_RATE_LIMIT_FAIL_MODE: 'close' },
}))

vi.mock('../src/utils/logger.js', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

vi.mock('../src/utils/api-key-hash.js', () => ({ verifySecret: vi.fn(() => true) }))

vi.mock('../src/services/api-key-share-service.js', () => ({
  getShareByToken: vi.fn(async () => fixture.state.share),
  incrementUsage: vi.fn(async () => true),
}))

vi.mock('../src/services/api-key-tpm-service.js', () => ({
  checkTpmQuota: vi.fn(),
  recordTpmUsage: vi.fn(),
}))

vi.mock('ioredis', () => {
  class FakeRedis {
    async eval() {
      return [1, 0]
    }
    on() {}
  }
  return { default: FakeRedis }
})

const { authenticateApiKey } = await import('../src/plugins/api-key-auth.js')

function reqWith(header: Record<string, string>) {
  return {
    headers: header,
    ip: '127.0.0.1',
    body: {},
    log: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
  } as any
}

const SHARE_CRED = { authorization: 'Bearer share_abc' }

beforeEach(() => {
  fixture.state.share = fakeShare()
  fixture.state.audiencePayload = null
  authMock.verifyAccessToken.mockReset()
  authMock.verifyAccessToken.mockImplementation(async () => {
    if (!fixture.state.audiencePayload) throw new Error('invalid token')
    return fixture.state.audiencePayload
  })
})

describe('F-185 分享 Key 总额度', () => {
  it('maxTotalTokens=1000 且已用满 → 429 SHARE_QUOTA_EXCEEDED', async () => {
    fixture.state.share = fakeShare({ maxTotalTokens: 1000, usedTotalTokens: 1000 })

    await expect(authenticateApiKey(reqWith(SHARE_CRED))).rejects.toMatchObject({
      statusCode: 429,
      errorCode: 'SHARE_QUOTA_EXCEEDED',
    })
    // 改前该分支不存在,会返回上下文 ⇒ 本断言红。
  })

  it('未用满额度仍放行', async () => {
    fixture.state.share = fakeShare({ maxTotalTokens: 1000, usedTotalTokens: 999 })

    const ctx = await authenticateApiKey(reqWith(SHARE_CRED))
    expect(ctx.shareId).toBe('share-1')
  })
})

describe('F-185 分享 Key 受众', () => {
  it('sharedWithUserId 非空且持他人 access token → 403', async () => {
    fixture.state.share = fakeShare({ sharedWithUserId: 'user-B' })
    fixture.state.audiencePayload = { userId: 'user-C' }

    await expect(
      authenticateApiKey(reqWith({ ...SHARE_CRED, 'x-share-user-token': 'jwt-of-user-C' })),
    ).rejects.toMatchObject({ statusCode: 403 })
    // 改前完全不读 sharedWithUserId ⇒ 放行,本断言红。
  })

  it('sharedWithUserId 非空且未出示用户令牌 → 403', async () => {
    fixture.state.share = fakeShare({ sharedWithUserId: 'user-B' })

    await expect(authenticateApiKey(reqWith(SHARE_CRED))).rejects.toMatchObject({
      statusCode: 403,
    })
  })

  it('sharedWithUserId 非空且出示本人 access token → 放行', async () => {
    fixture.state.share = fakeShare({ sharedWithUserId: 'user-B' })
    fixture.state.audiencePayload = { userId: 'user-B' }

    const ctx = await authenticateApiKey(
      reqWith({ ...SHARE_CRED, 'x-share-user-token': 'jwt-of-user-B' }),
    )
    expect(ctx.shareId).toBe('share-1')
    expect(ctx.userId).toBe('user-1')
  })

  it('公开分享(sharedWithUserId=null)不需要用户令牌', async () => {
    const ctx = await authenticateApiKey(reqWith(SHARE_CRED))
    expect(ctx.shareId).toBe('share-1')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
