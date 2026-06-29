// unified-wechat.ts 单元测试
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/request', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

vi.mock('@/utils/api-response', () => ({
  withApiResponseHandler: (fn: any) => fn,
  normalizeApiResponse: (r: any) => r?.data ?? r,
}))

vi.mock('@/utils/i18n', () => ({
  t: (k: string) => k,
}))

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import request from '@/utils/request'
import * as api from '../unified-wechat'

describe('unified-wechat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(request.get as any).mockResolvedValue({ data: { qrCodeUrl: 'url', ticket: 't', loginId: 'l1', expiresIn: 300 } })
    ;(request.post as any).mockResolvedValue({ data: { token: 'tok', user: { openid: 'o' } } })
  })

  it('generateWechatQrCode 默认', async () => {
    const r = await api.generateWechatQrCode()
    expect(r.success).toBe(true)
  })

  it('generateWechatQrCode 带参数', async () => {
    const r = await api.generateWechatQrCode({ appId: 'app', redirectUri: 'cb', state: 'st' })
    expect(r.success).toBe(true)
  })

  it('generateWechatQrCode 嵌套 data', async () => {
    ;(request.get as any).mockResolvedValueOnce({ data: { data: { qrCodeUrl: 'nested' } } })
    const r = await api.generateWechatQrCode()
    expect(r.data?.qrCodeUrl).toBe('nested')
  })

  it('generateWechatQrCode 非对象 data', async () => {
    ;(request.get as any).mockResolvedValueOnce({ data: 'not-object' })
    const r = await api.generateWechatQrCode()
    expect(r.data?.expiresIn).toBe(300)
  })

  it('generateWechatQrCode 网络错误返回失败', async () => {
    ;(request.get as any).mockRejectedValueOnce(new Error('Network Error'))
    const r = await api.generateWechatQrCode()
    expect(r.success).toBe(false)
    expect(r.code).toBe(503)
  })

  it('generateWechatQrCode ECONNREFUSED', async () => {
    ;(request.get as any).mockRejectedValueOnce(new Error('ECONNREFUSED'))
    const r = await api.generateWechatQrCode()
    expect(r.success).toBe(false)
    expect(r.code).toBe(503)
  })

  it('generateWechatQrCode timeout', async () => {
    ;(request.get as any).mockRejectedValueOnce(new Error('timeout'))
    const r = await api.generateWechatQrCode()
    expect(r.success).toBe(false)
    expect(r.code).toBe(503)
  })

  it('generateWechatQrCode 其他错误返回失败', async () => {
    ;(request.get as any).mockRejectedValueOnce(new Error('other'))
    const r = await api.generateWechatQrCode()
    expect(r.success).toBe(false)
    expect(r.code).toBe(503)
  })

  it('checkWechatQrStatus 正常', async () => {
    ;(request.get as any).mockResolvedValue({ data: { status: 'pending' } })
    const r = await api.checkWechatQrStatus('login1')
    expect(r).toBeDefined()
  })

  it('checkWechatQrStatus loginId 为空', async () => {
    const r = await api.checkWechatQrStatus('')
    expect(r.success).toBe(false)
    expect(r.code).toBe(400)
  })

  it('checkWechatQrStatus 网络错误返回失败', async () => {
    ;(request.get as any).mockRejectedValueOnce(new Error('Network Error'))
    const r = await api.checkWechatQrStatus('login1')
    expect(r.success).toBe(false)
    expect(r.code).toBe(503)
  })

  it('checkWechatQrStatus 其他错误返回失败', async () => {
    ;(request.get as any).mockRejectedValueOnce(new Error('other'))
    const r = await api.checkWechatQrStatus('login1')
    expect(r.success).toBe(false)
    expect(r.code).toBe(503)
  })

  it('handleWechatCallback 正常', async () => {
    const r = await api.handleWechatCallback('code1', 'state1')
    expect(r).toBeDefined()
  })

  it('handleWechatCallback 错误返回失败', async () => {
    ;(request.post as any).mockRejectedValueOnce(new Error('fail'))
    const r = await api.handleWechatCallback('code1', 'state1')
    expect(r.success).toBe(false)
    expect(r.code).toBe(503)
  })

  it('getWechatConfig 正常', async () => {
    const r = await api.getWechatConfig()
    expect(r).toBeDefined()
  })

  it('getWechatConfig 错误返回默认', async () => {
    ;(request.get as any).mockRejectedValueOnce(new Error('fail'))
    const r = await api.getWechatConfig()
    expect(r.data?.qrLoginEnabled).toBe(true)
  })

  it('default export', () => {
    expect(api.default.generateWechatQrCode).toBeDefined()
    expect(api.default.checkWechatQrStatus).toBeDefined()
    expect(api.default.handleWechatCallback).toBeDefined()
    expect(api.default.getWechatConfig).toBeDefined()
  })
})
