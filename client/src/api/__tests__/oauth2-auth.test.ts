// oauth2-auth.ts 单元测试
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/request', () => ({
  request: {
    post: vi.fn(() => Promise.resolve({ code: 200, msg: 'ok', data: { access_token: 'a' } })),
    get: vi.fn(() => Promise.resolve({ code: 200, msg: 'ok', data: { captchaId: 'c1', captchaImage: 'img' } })),
  },
}))

vi.mock('@/config/backend-paths', () => ({
  AUTH_PATHS: { code: '/auth/code' },
}))

import { request } from '@/utils/request'
import * as api from '../oauth2-auth'

describe('oauth2-auth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('oauth2Login 正常', async () => {
    const r = await api.oauth2Login({ username: 'u', password: 'p' })
    expect(r).toBeDefined()
  })

  it('oauth2Login 带 grant_type', async () => {
    const r = await api.oauth2Login({ username: 'u', password: 'p', grant_type: 'password' })
    expect(r).toBeDefined()
  })

  it('loginWithCaptcha 正常', async () => {
    const r = await api.loginWithCaptcha({ username: 'u', password: 'p', captcha: 'c' })
    expect(r).toBeDefined()
  })

  it('getCaptcha 正常', async () => {
    const r = await api.getCaptcha()
    expect(r.data?.captchaId).toBe('c1')
  })

  it('refreshToken 正常', async () => {
    const r = await api.refreshToken('rt')
    expect(r).toBeDefined()
  })

  it('logout 返回 ok', async () => {
    const r = await api.logout()
    expect(r.code).toBe(200)
  })
})
