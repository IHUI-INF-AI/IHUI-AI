// unified-auth.ts 单元测试
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('axios', () => ({
  default: {
    post: vi.fn(() => Promise.resolve({ data: { code: 200, data: { token: 't' } } })),
  },
  post: vi.fn(() => Promise.resolve({ data: { code: 200, data: { token: 't' } } })),
}))

vi.mock('@/utils/request', () => ({
  request: {
    post: vi.fn(() => Promise.resolve({ data: { code: 200, data: { token: 't' } } })),
  },
}))

vi.mock('@/utils/i18n', () => ({
  t: (k: string) => k,
}))

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import axios from 'axios'
import { request } from '@/utils/request'
import * as api from '../unified/unified-auth'

describe('unified-auth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('unifiedLogin main 正常', async () => {
    const r = await api.unifiedLogin('main', { phone: '138', password: 'p' })
    expect(r).toBeDefined()
  })

  it('unifiedLogin user 正常', async () => {
    const r = await api.unifiedLogin('user', { phone: '138', password: 'p' })
    expect(r).toBeDefined()
  })

  it('unifiedLogin admin (使用 axios)', async () => {
    const r = await api.unifiedLogin('admin', { phone: '138', password: 'p' })
    expect(r).toBeDefined()
  })

  it('unifiedLogin edu-web (使用 axios)', async () => {
    const r = await api.unifiedLogin('edu-web', { phone: '138', password: 'p' })
    expect(r).toBeDefined()
  })

  it('unifiedLogin edu-admin (使用 axios)', async () => {
    const r = await api.unifiedLogin('edu-admin', { phone: '138', password: 'p' })
    expect(r).toBeDefined()
  })

  it('unifiedLogin 包含 email / remember', async () => {
    const r = await api.unifiedLogin('main', { phone: '138', password: 'p', email: 'a@b.com', remember: true })
    expect(r).toBeDefined()
  })

  it('unifiedLogin edu-web 包含 email/code/uuid', async () => {
    const r = await api.unifiedLogin('edu-web', { phone: '138', password: 'p', email: 'a@b.com', code: 'c', uuid: 'u' })
    expect(r).toBeDefined()
  })

  it('unifiedLogin admin 包含 code/uuid', async () => {
    const r = await api.unifiedLogin('admin', { phone: '138', password: 'p', code: 'c', uuid: 'u' })
    expect(r).toBeDefined()
  })

  it('unifiedLogin 404 错误 (msg 包含 404)', async () => {
    ;(request.post as any).mockResolvedValueOnce({ data: { code: 500, msg: '404 NOT_FOUND' }, status: 500 })
    const r = await api.unifiedLogin('main', { phone: '138', password: 'p' })
    expect(r.success).toBe(false)
  })

  it('unifiedLogin 404 错误 (code=404)', async () => {
    ;(request.post as any).mockResolvedValueOnce({ data: { code: 404, msg: 'NOT_FOUND' }, status: 404 })
    const r = await api.unifiedLogin('main', { phone: '138', password: 'p' })
    expect(r.success).toBe(false)
  })

  it('unifiedLogin axios response', async () => {
    ;(request.post as any).mockResolvedValueOnce({ data: { token: 't' }, status: 200 })
    const r = await api.unifiedLogin('main', { phone: '138', password: 'p' })
    expect(r).toBeDefined()
  })

  it('unifiedLogin 错误 axios error 404', async () => {
    ;(request.post as any).mockRejectedValueOnce({ response: { data: { msg: '接口不存在' }, status: 404 } })
    const r = await api.unifiedLogin('main', { phone: '138', password: 'p' })
    expect(r.code).toBe(404)
  })

  it('unifiedLogin 错误 axios error 401', async () => {
    ;(request.post as any).mockRejectedValueOnce({ response: { data: { msg: '认证失败' }, status: 401 } })
    const r = await api.unifiedLogin('main', { phone: '138', password: 'p' })
    expect(r.code).toBe(401)
  })

  it('unifiedLogin 错误 axios error 403', async () => {
    ;(request.post as any).mockRejectedValueOnce({ response: { data: { msg: '权限' }, status: 403 } })
    const r = await api.unifiedLogin('main', { phone: '138', password: 'p' })
    expect(r.code).toBe(403)
  })

  it('unifiedLogin 错误 axios error 500', async () => {
    ;(request.post as any).mockRejectedValueOnce({ response: { data: { msg: '错误' }, status: 500 } })
    const r = await api.unifiedLogin('main', { phone: '138', password: 'p' })
    expect(r.code).toBe(500)
  })

  it('unifiedLogin 错误 普通 Error', async () => {
    ;(request.post as any).mockRejectedValueOnce(new Error('net fail'))
    const r = await api.unifiedLogin('main', { phone: '138', password: 'p' })
    expect(r.success).toBe(false)
  })

  it('unifiedLogin 错误 object with code=500', async () => {
    ;(request.post as any).mockRejectedValueOnce({ code: 500, msg: 'NOT_FOUND 404' })
    const r = await api.unifiedLogin('main', { phone: '138', password: 'p' })
    expect(r.code).toBe(404)
  })

  it('unifiedLogin response with thirdPartyAccounts token', async () => {
    ;(request.post as any).mockResolvedValueOnce({
      data: { code: 200, data: { thirdPartyAccounts: { accessToken: 'tp-token', refreshToken: 'tp-rt' } } },
      status: 200,
    })
    const r = await api.unifiedLogin('main', { phone: '138', password: 'p' })
    expect(r.data?.token).toBe('tp-token')
  })

  it('unifiedLogin response nested data token', async () => {
    ;(request.post as any).mockResolvedValueOnce({
      data: { code: 200, data: { data: { token: 'nested' } } },
      status: 200,
    })
    const r = await api.unifiedLogin('main', { phone: '138', password: 'p' })
    expect(r.data?.token).toBe('nested')
  })

  it('unifiedRegister main 正常', async () => {
    const r = await api.unifiedRegister('main', { username: 'u', password: 'p' })
    expect(r).toBeDefined()
  })

  it('unifiedRegister admin 正常', async () => {
    const r = await api.unifiedRegister('admin', { username: 'u', password: 'p' })
    expect(r).toBeDefined()
  })

  it('unifiedRegister edu-web 含 email/phone/code/captcha/uuid/inviteCode', async () => {
    const r = await api.unifiedRegister('edu-web', {
      username: 'u',
      password: 'p',
      email: 'a@b.com',
      phone: '138',
      code: 'c',
      captcha: 'cap',
      uuid: 'u',
      inviteCode: 'ic',
    })
    expect(r).toBeDefined()
  })

  it('unifiedRegister axios response', async () => {
    ;(request.post as any).mockResolvedValueOnce({ data: { code: 200, data: { token: 't' } }, status: 200 })
    const r = await api.unifiedRegister('main', { username: 'u', password: 'p' })
    expect(r).toBeDefined()
  })

  it('unifiedRegister 404', async () => {
    ;(request.post as any).mockResolvedValueOnce({ data: { code: 500, msg: '404 NOT_FOUND' }, status: 500 })
    const r = await api.unifiedRegister('main', { username: 'u', password: 'p' })
    expect(r.success).toBe(false)
  })

  it('unifiedRegister axios 错误', async () => {
    ;(request.post as any).mockRejectedValueOnce(new Error('net'))
    const r = await api.unifiedRegister('main', { username: 'u', password: 'p' })
    expect(r.success).toBe(false)
  })

  it('unifiedRegister 错误信息含 404', async () => {
    ;(request.post as any).mockRejectedValueOnce(new Error('404 Not Found'))
    const r = await api.unifiedRegister('main', { username: 'u', password: 'p' })
    expect(r.code).toBe(404)
  })

  it('unifiedRegister 错误信息含 401', async () => {
    ;(request.post as any).mockRejectedValueOnce(new Error('401 Unauthorized'))
    const r = await api.unifiedRegister('main', { username: 'u', password: 'p' })
    expect(r.code).toBe(401)
  })

  it('getSourceName', () => {
    expect(api.getSourceName('main')).toBe('官网主站')
    expect(api.getSourceName('user')).toBe('官网用户端')
    expect(api.getSourceName('admin')).toBe('Ruoyi管理后台')
    expect(api.getSourceName('edu-web')).toBe('教育用户端')
    expect(api.getSourceName('edu-admin')).toBe('教育管理端')
    expect(api.getSourceName('unknown' as any)).toBe('未知平台')
  })

  it('isValidSource', () => {
    expect(api.isValidSource('main')).toBe(true)
    expect(api.isValidSource('admin')).toBe(true)
    expect(api.isValidSource('unknown')).toBe(false)
  })

  it('getSupportedSources', () => {
    const r = api.getSupportedSources()
    expect(r.length).toBe(4)
  })
})
