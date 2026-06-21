// auth-info.ts 单元测试
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/request', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('@/utils/apiResponseHandler', () => ({
  withApiResponseHandler: (fn: any) => fn,
  normalizeApiResponse: (r: any) => r?.data ?? r,
}))

import request from '@/utils/request'
import * as api from '../auth-info'

describe('auth-info API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(request.get as any).mockResolvedValue({ data: { list: [], total: 0 } })
    ;(request.post as any).mockResolvedValue({ data: { id: '1' } })
    ;(request.put as any).mockResolvedValue({ data: { id: '1' } })
    ;(request.delete as any).mockResolvedValue({ data: null })
  })

  it('createAuthInfo', async () => {
    const r = await api.createAuthInfo({ realName: 'x' })
    expect(r).toBeDefined()
  })

  it('updateAuthInfo', async () => {
    const r = await api.updateAuthInfo({ id: '1' })
    expect(r).toBeDefined()
  })

  it('exportAuthInfo 带参数', async () => {
    const r = await api.exportAuthInfo({ page: 1 })
    expect(r).toBeDefined()
  })

  it('exportAuthInfo 不带参数', async () => {
    const r = await api.exportAuthInfo()
    expect(r).toBeDefined()
  })

  it('getAuthInfoById', async () => {
    const r = await api.getAuthInfoById('1')
    expect(r).toBeDefined()
  })

  it('getAuthInfoList', async () => {
    const r = await api.getAuthInfoList({ page: 1, pageSize: 10 })
    expect(r).toBeDefined()
  })

  it('getAuthInfoList 不带参数', async () => {
    const r = await api.getAuthInfoList()
    expect(r).toBeDefined()
  })

  it('deleteAuthInfo 单个 id', async () => {
    const r = await api.deleteAuthInfo('1')
    expect(r).toBeDefined()
  })

  it('deleteAuthInfo 多个 id', async () => {
    const r = await api.deleteAuthInfo(['1', '2'])
    expect(r).toBeDefined()
  })

  it('调用所有函数并捕获错误', async () => {
    ;(request.get as any).mockRejectedValue(new Error('fail'))
    ;(request.post as any).mockRejectedValue(new Error('fail'))
    ;(request.put as any).mockRejectedValue(new Error('fail'))
    ;(request.delete as any).mockRejectedValue(new Error('fail'))
    try { await api.createAuthInfo({}) } catch (e) {}
    try { await api.updateAuthInfo({}) } catch (e) {}
    try { await api.exportAuthInfo() } catch (e) {}
    try { await api.getAuthInfoById('1') } catch (e) {}
    try { await api.getAuthInfoList() } catch (e) {}
    try { await api.deleteAuthInfo('1') } catch (e) {}
  })
})
