// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi } from 'vitest'
import type IORedis from 'ioredis'
import {
  generateAuthorizationCode,
  generatePkceVerifier,
  generatePkceChallenge,
  validatePkce,
  InMemoryAuthorizationCodeStore,
  RedisAuthorizationCodeStore,
  createAndStoreAuthorizationCode,
  validateAuthorizationCode,
  OAuth2Error,
  type OAuth2Client,
  type PkcePolicy,
  type StoredAuthorizationCode,
} from '../src/oauth2'

describe('oauth2', () => {
  describe('generateAuthorizationCode', () => {
    it('返回非空字符串', () => {
      const code = generateAuthorizationCode('cli1', 'u1', 'openid', 'https://example.com/cb')
      expect(typeof code).toBe('string')
      expect(code.length).toBeGreaterThan(0)
    })

    it('使用 base64url 字符集', () => {
      const code = generateAuthorizationCode('cli1', 'u1', 'openid', 'https://example.com/cb')
      expect(code).toMatch(/^[A-Za-z0-9_-]+$/)
    })
  })

  describe('PKCE generatePkceVerifier', () => {
    it('默认长度处于 43-128 区间', () => {
      const v = generatePkceVerifier()
      expect(v.length).toBeGreaterThanOrEqual(43)
      expect(v.length).toBeLessThanOrEqual(128)
    })

    it('字符集合法 [A-Za-z0-9-._~]', () => {
      expect(generatePkceVerifier()).toMatch(/^[A-Za-z0-9-._~]+$/)
    })

    it('非法长度抛错', () => {
      expect(() => generatePkceVerifier(10)).toThrow()
      expect(() => generatePkceVerifier(200)).toThrow()
    })
  })

  describe('validatePkce', () => {
    it('S256: 正确配对通过', () => {
      const verifier = generatePkceVerifier()
      const challenge = generatePkceChallenge(verifier, 'S256')
      expect(validatePkce(verifier, challenge, 'S256')).toBe(true)
    })

    it('S256: 错误配对拒绝', () => {
      const verifier = generatePkceVerifier()
      const wrongChallenge = generatePkceChallenge(generatePkceVerifier(), 'S256')
      expect(validatePkce(verifier, wrongChallenge, 'S256')).toBe(false)
    })

    it('plain: 正确配对通过', () => {
      const verifier = generatePkceVerifier()
      expect(validatePkce(verifier, verifier, 'plain')).toBe(true)
    })

    it('空值拒绝', () => {
      expect(validatePkce('', 'anything', 'S256')).toBe(false)
    })
  })
})

// ---------------------------------------------------------------------------
// G-998084: 授权码「消费即失效」(防重放) —— 先删后判,不留可重放窗口
// ---------------------------------------------------------------------------

/** 机密客户端 + 显式策略,规避 env(OAUTH_REQUIRE_PKCE)带来的不确定性。 */
const TEST_CLIENT: OAuth2Client = {
  clientId: 'cli_test',
  clientSecret: 'sec_test_plain_secret',
  redirectUris: ['https://example.com/cb'],
  scopes: ['openid'],
  name: '测试客户端',
}

const TEST_POLICY: PkcePolicy = {
  requirePkceForPublicClients: true,
  requirePkceForConfidentialClients: false,
  allowedMethods: ['S256'],
}

function baseCodeInput(overrides: Partial<Parameters<typeof createAndStoreAuthorizationCode>[1]> = {}) {
  return {
    clientId: TEST_CLIENT.clientId,
    userId: 'u1',
    redirectUri: 'https://example.com/cb',
    scopes: ['openid'],
    ...overrides,
  }
}

describe('InMemoryAuthorizationCodeStore.consume —— 消费即失效', () => {
  it('同一授权码连续两次消费,第二次拿不到(不留可重放窗口)', async () => {
    const store = new InMemoryAuthorizationCodeStore()
    const code = await createAndStoreAuthorizationCode(store, baseCodeInput())

    const first = await store.consume(code)
    expect(first).not.toBeNull()
    expect(first!.code).toBe(code)
    expect(first!.userId).toBe('u1')

    const second = await store.consume(code)
    expect(second).toBeNull()
  })

  it('过期授权码消费返回 null,且已先删后判(再次消费同样 null)', async () => {
    const store = new InMemoryAuthorizationCodeStore()
    const entry: StoredAuthorizationCode = {
      code: 'expired-code',
      clientId: TEST_CLIENT.clientId,
      userId: 'u1',
      redirectUri: 'https://example.com/cb',
      scopes: ['openid'],
      expiresAt: new Date(Date.now() + 60_000),
    }
    await store.save(entry)
    // save 后把过期时刻改到过去,精确命中 consume 的「先删后判」过期分支
    entry.expiresAt = new Date(Date.now() - 1_000)

    expect(await store.consume('expired-code')).toBeNull()
    expect(await store.consume('expired-code')).toBeNull()
  })
})

describe('RedisAuthorizationCodeStore.consume —— GETDEL 原子取出防重放', () => {
  function fakeRedis() {
    const kv = new Map<string, string>()
    const setex = vi.fn(async (key: string, _ttl: number, value: string) => {
      kv.set(key, value)
      return 'OK'
    })
    const getdel = vi.fn(async (key: string) => {
      const value = kv.get(key) ?? null
      kv.delete(key)
      return value
    })
    return { stub: { setex, getdel } as unknown as IORedis, setex, getdel }
  }

  it('同一授权码连续两次消费,第二次拿不到(原子取出,无重放)', async () => {
    const { stub, getdel } = fakeRedis()
    const store = new RedisAuthorizationCodeStore(stub)
    const code = await createAndStoreAuthorizationCode(store, baseCodeInput())

    const first = await store.consume(code)
    expect(first).not.toBeNull()
    expect(first!.userId).toBe('u1')

    const second = await store.consume(code)
    expect(second).toBeNull()
    expect(getdel).toHaveBeenCalledTimes(2)
  })

  it('过期授权码消费返回 null,且取出后不可再用', async () => {
    const { stub } = fakeRedis()
    const store = new RedisAuthorizationCodeStore(stub)
    await store.save({
      code: 'expired-redis-code',
      clientId: TEST_CLIENT.clientId,
      userId: 'u1',
      redirectUri: 'https://example.com/cb',
      scopes: ['openid'],
      expiresAt: new Date(Date.now() - 1_000),
    })

    expect(await store.consume('expired-redis-code')).toBeNull()
    expect(await store.consume('expired-redis-code')).toBeNull()
  })
})

describe('validateAuthorizationCode —— 同一 code 二次兑换抛 invalid_grant', () => {
  it('第一次校验通过,第二次兑换报「已被消费」', async () => {
    const store = new InMemoryAuthorizationCodeStore()
    const code = await createAndStoreAuthorizationCode(store, baseCodeInput())
    const input = {
      code,
      clientId: TEST_CLIENT.clientId,
      clientSecret: TEST_CLIENT.clientSecret,
      redirectUri: 'https://example.com/cb',
    }

    const validated = await validateAuthorizationCode(store, TEST_CLIENT, input, {
      policy: TEST_POLICY,
    })
    expect(validated.userId).toBe('u1')
    expect(validated.scopes).toEqual(['openid'])

    let caught: unknown
    try {
      await validateAuthorizationCode(store, TEST_CLIENT, input, { policy: TEST_POLICY })
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(OAuth2Error)
    expect((caught as OAuth2Error).code).toBe('invalid_grant')
    expect((caught as OAuth2Error).message).toContain('已被消费')
  })
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
