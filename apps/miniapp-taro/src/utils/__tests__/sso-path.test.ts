/**
 * miniapp-taro SSO 路径修复回归测试
 *
 * 背景:2026-07-17 发现 sso.ts 中 3 处 ${BASE_URL}/api/auth/sso/* 双 /api 前缀 bug
 * (BASE_URL 已含 /api,实际请求 /api/api/auth/sso/* 404)。
 * 本测试锁定:所有 SSO 请求 URL 必须只含单个 /api 前缀。
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

// === Mock @tarojs/taro ===
const taroStorage: Record<string, unknown> = {}
vi.mock('@tarojs/taro', () => ({
  getStorageSync: (key: string) => taroStorage[key] ?? '',
  removeStorageSync: (key: string) => {
    delete taroStorage[key]
  },
  setStorageSync: (key: string, val: unknown) => {
    taroStorage[key] = val
  },
}))

// === 捕获 fetch URL ===
const fetchCalls: { url: string; init?: RequestInit }[] = []
const originalFetch = globalThis.fetch
beforeAll(() => {
  globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
    fetchCalls.push({ url, init })
    return new Response(JSON.stringify({ code: 200, data: null }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }) as unknown as typeof globalThis.fetch
})
afterAll(() => {
  globalThis.fetch = originalFetch
})

import { exchangeSsoCode, validateToken, ssoLogout } from '../sso'

describe('miniapp-taro SSO 路径修复', () => {
  it('exchangeSsoCode 请求 URL 不含双 /api 前缀', async () => {
    fetchCalls.length = 0
    await exchangeSsoCode('test-code')
    expect(fetchCalls).toHaveLength(1)
    const url = fetchCalls[0]!.url
    // 必须含 /api/auth/sso/exchange(单前缀)
    expect(url).toContain('/api/auth/sso/exchange')
    // 必须不含 /api/api/(双前缀)
    expect(url).not.toContain('/api/api/')
    // 完整 URL 应为 http://localhost:3001/api/auth/sso/exchange
    expect(url).toBe('http://localhost:3001/api/auth/sso/exchange')
  })

  it('validateToken 请求 URL 不含双 /api 前缀', async () => {
    fetchCalls.length = 0
    await validateToken('test-token')
    expect(fetchCalls).toHaveLength(1)
    const url = fetchCalls[0]!.url
    expect(url).toContain('/api/auth/sso/validate')
    expect(url).not.toContain('/api/api/')
    expect(url).toBe('http://localhost:3001/api/auth/sso/validate')
  })

  it('ssoLogout 请求 URL 不含双 /api 前缀', async () => {
    fetchCalls.length = 0
    await ssoLogout('test-token')
    expect(fetchCalls).toHaveLength(1)
    const url = fetchCalls[0]!.url
    expect(url).toContain('/api/auth/sso/logout')
    expect(url).not.toContain('/api/api/')
    expect(url).toBe('http://localhost:3001/api/auth/sso/logout')
  })

  it('exchangeSsoCode 请求体含 code + clientId', async () => {
    fetchCalls.length = 0
    await exchangeSsoCode('my-code')
    expect(fetchCalls).toHaveLength(1)
    const init = fetchCalls[0]!.init
    expect(init?.method).toBe('POST')
    const body = JSON.parse(init?.body as string)
    expect(body.code).toBe('my-code')
    expect(body.clientId).toBe('miniapp-taro')
  })

  it('validateToken 请求头含 Authorization Bearer', async () => {
    fetchCalls.length = 0
    await validateToken('my-token')
    const init = fetchCalls[0]!.init
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer my-token' })
  })

  it('ssoLogout 请求方法为 POST + Authorization Bearer', async () => {
    fetchCalls.length = 0
    await ssoLogout('my-token')
    const init = fetchCalls[0]!.init
    expect(init?.method).toBe('POST')
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer my-token' })
  })
})

describe('miniapp-taro SSO 路径回归防护', () => {
  it('所有 SSO 端点路径使用 BASE_URL(已含 /api)+ 单 /auth/sso/* 拼接', async () => {
    fetchCalls.length = 0
    await Promise.all([exchangeSsoCode('c'), validateToken('t'), ssoLogout('t')])
    expect(fetchCalls).toHaveLength(3)
    for (const call of fetchCalls) {
      expect(call.url).toMatch(
        /^http:\/\/localhost:3001\/api\/auth\/sso\/(exchange|validate|logout)$/,
      )
    }
  })
})
