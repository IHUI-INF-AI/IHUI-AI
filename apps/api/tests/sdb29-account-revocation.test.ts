// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SDB-29 夹具:账号注销/禁用后开发者凭据必须立即失效。
 *
 * 两条根因:
 * 1. 鉴权只查 developer_api_keys.status,不 join users.status ⇒ 注销(status=3)
 *    用户手里的 Key / 分享 token 仍可调用付费接口(注销 = 未吊销)。
 * 2. 注销清理(purgeUserPii)从未删 developer_api_keys / api_key_shares。
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'

const fixture = vi.hoisted(() => ({
  state: {
    /** 联表返回的 users.status;null = 用户行不存在(INNER JOIN 空) */
    userStatus: null as number | null,
    keyRow: null as unknown,
    share: null as unknown,
    deleted: [] as unknown[],
  },
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

vi.mock('../src/db/index.js', () => ({
  db: {
    // 鉴权:developer_api_keys INNER JOIN users → { key, userStatus }
    select: vi.fn(() => {
      const chain: Record<string, unknown> = {}
      chain.innerJoin = vi.fn(() => chain)
      chain.from = vi.fn(() => chain)
      chain.where = vi.fn(() => ({
        limit: vi.fn(async () => {
          if (fixture.state.userStatus === null || fixture.state.keyRow === null) return []
          return [{ key: fixture.state.keyRow, userStatus: fixture.state.userStatus }]
        }),
      }))
      return chain
    }),
    delete: vi.fn((table: unknown) => {
      fixture.state.deleted.push(table)
      return { where: vi.fn(async () => undefined) }
    }),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({ returning: vi.fn(async () => [{ id: 'user-1' }]) })),
      })),
    })),
  },
  dbRead: { select: vi.fn() },
}))

vi.mock('@ihui/database', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return actual
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
}))

vi.mock('../src/services/api-key-tpm-service.js', () => ({
  checkTpmQuota: vi.fn(),
  recordTpmUsage: vi.fn(),
}))

vi.mock('../src/db/queries.js', () => ({ revokeAllUserRefreshTokens: vi.fn(async () => {}) }))

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
const { purgeUserPii } = await import('../src/services/purge-user-pii.js')
const { apiKeyShares, developerApiKeys } = await import('@ihui/database')

function reqWith(header: Record<string, string>) {
  return { headers: header, ip: '127.0.0.1' } as any
}

beforeEach(() => {
  fixture.state.userStatus = 1
  fixture.state.keyRow = fakeKeyRow()
  fixture.state.share = null
  fixture.state.deleted.length = 0
})

describe('SDB-29 鉴权必须 join 账号状态', () => {
  it('账号注销(status=3)后普通 API Key 立即 401', async () => {
    fixture.state.userStatus = 3
    await expect(
      authenticateApiKey(reqWith({ authorization: 'Bearer ihui_test_key' })),
    ).rejects.toMatchObject({ statusCode: 401 })
  })

  it('账号禁用(status=0)后普通 API Key 立即 401', async () => {
    fixture.state.userStatus = 0
    await expect(
      authenticateApiKey(reqWith({ 'x-api-key': 'ihui_test_key' })),
    ).rejects.toMatchObject({ statusCode: 401 })
  })

  it('users 行不存在(INNER JOIN 无结果)时 401,不得放行孤儿 Key', async () => {
    fixture.state.userStatus = null
    await expect(
      authenticateApiKey(reqWith({ authorization: 'Bearer ihui_test_key' })),
    ).rejects.toMatchObject({ statusCode: 401 })
  })

  it('分享 token 也继承源 Key 持有者账号状态:注销后 401', async () => {
    fixture.state.share = {
      id: 'share-1',
      sourceApiKeyId: 'key-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 3_600_000),
      scopeModels: null,
      scopeEndpoints: null,
      rateLimitRpm: 60,
      rateLimitTpm: 100_000,
      sourceKey: fakeKeyRow(),
      ownerStatus: 3,
    }
    await expect(
      authenticateApiKey(reqWith({ authorization: 'Bearer share_abc' })),
    ).rejects.toMatchObject({ statusCode: 401 })
  })
})

describe('SDB-29 注销清理必须吊销开发者凭据', () => {
  it('purgeUserPii 删除 api_key_shares 与 developer_api_keys', async () => {
    const result = await purgeUserPii('user-1')
    expect(result.userRowAnonymized).toBe(true)
    expect(fixture.state.deleted).toContain(apiKeyShares)
    expect(fixture.state.deleted).toContain(developerApiKeys)
    // 分享先于 Key 删除(share.created_by 为 RESTRICT)
    const shareIdx = fixture.state.deleted.indexOf(apiKeyShares)
    const keyIdx = fixture.state.deleted.indexOf(developerApiKeys)
    expect(shareIdx).toBeLessThan(keyIdx)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
