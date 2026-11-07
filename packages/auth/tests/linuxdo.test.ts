// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createLinuxdoProvider, isLinuxdoConfigured } from '../src/providers/linuxdo'

const config = {
  clientId: 'ld-client-id',
  clientSecret: 'ld-client-secret',
  redirectUri: 'https://aizhs.top/auth/oauth/linuxdo/callback',
}

describe('linuxdo provider', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('isLinuxdoConfigured:三键齐为真,缺任一为假', () => {
    const prev = {
      id: process.env.LINUXDO_CLIENT_ID,
      secret: process.env.LINUXDO_CLIENT_SECRET,
      uri: process.env.LINUXDO_REDIRECT_URI,
    }
    process.env.LINUXDO_CLIENT_ID = 'x'
    process.env.LINUXDO_CLIENT_SECRET = 'y'
    delete process.env.LINUXDO_REDIRECT_URI
    expect(isLinuxdoConfigured()).toBe(false)
    process.env.LINUXDO_REDIRECT_URI = 'z'
    expect(isLinuxdoConfigured()).toBe(true)
    for (const [k, v] of Object.entries({ CLIENT_ID: prev.id, CLIENT_SECRET: prev.secret, REDIRECT_URI: prev.uri })) {
      const key = `LINUXDO_${k}`
      if (v === undefined) delete process.env[key]
      else process.env[key] = v
    }
  })

  it('getAuthorizationUrl 生成 connect.linux.do authorize 带 client_id/redirect/scope/state', async () => {
    const p = createLinuxdoProvider(config)
    const url = await p.getAuthorizationUrl('STATE123')
    expect(url).toContain('https://connect.linux.do/oauth2/authorize?')
    const q = new URL(url).searchParams
    expect(q.get('client_id')).toBe('ld-client-id')
    expect(q.get('redirect_uri')).toBe(config.redirectUri)
    expect(q.get('response_type')).toBe('code')
    expect(q.get('scope')).toBe('user')
    expect(q.get('state')).toBe('STATE123')
  })

  it('exchangeCodeForToken 用 form body 换 token 并回传 accessToken', async () => {
    const fetchMock = vi.fn(async (u: string, init?: RequestInit) => {
      expect(u).toBe('https://connect.linux.do/oauth2/token')
      const body = new URLSearchParams(String(init?.body ?? ''))
      expect(body.get('client_id')).toBe('ld-client-id')
      expect(body.get('client_secret')).toBe('ld-client-secret')
      expect(body.get('grant_type')).toBe('authorization_code')
      expect(body.get('code')).toBe('CODE_ABC')
      return { json: async () => ({ access_token: 'TK1', token_type: 'Bearer', expires_in: 3600 }) } as Response
    })
    vi.stubGlobal('fetch', fetchMock)
    const p = createLinuxdoProvider(config)
    const t = await p.exchangeCodeForToken('CODE_ABC')
    expect(t.accessToken).toBe('TK1')
    expect(t.tokenType).toBe('Bearer')
  })

  it('exchangeCodeForToken 无 access_token 抛错', async () => {
    vi.stubGlobal('fetch', async () => ({ json: async () => ({ error: 'invalid_grant' }) }) as unknown as Response)
    const p = createLinuxdoProvider(config)
    await expect(p.exchangeCodeForToken('BAD')).rejects.toThrow(/LinuxDo token 交换失败/)
  })

  it('fetchUserInfo 归一化 openId/nickname/相对头像/emailVerified', async () => {
    vi.stubGlobal(
      'fetch',
      async (u: string, init?: RequestInit) => {
        expect(u).toBe('https://connect.linux.do/api/user')
        expect(String((init?.headers as Record<string, string>).Authorization)).toBe('Bearer TK1')
        return {
          ok: true,
          json: async () => ({
            id: 42,
            username: 'lisi',
            name: '李四',
            email: 'l@x.com',
            avatar_thumb: '/user_avatar/lisi.png',
            email_verified: true,
          }),
        } as Response
      },
    )
    const p = createLinuxdoProvider(config)
    const info = await p.fetchUserInfo('TK1')
    expect(info).toMatchObject({
      openId: '42',
      nickname: '李四',
      email: 'l@x.com',
      emailVerified: true,
      avatar: 'https://linux.do/user_avatar/lisi.png',
    })
  })

  it('fetchUserInfo HTTP 非 2xx 抛错', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: false, status: 403 }) as unknown as Response)
    const p = createLinuxdoProvider(config)
    await expect(p.fetchUserInfo('TK')).rejects.toThrow(/LinuxDo userinfo 拉取失败: HTTP 403/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
