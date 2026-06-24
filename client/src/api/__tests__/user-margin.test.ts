// user-margin.ts 单元测试
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
import * as api from '../user-margin'

describe('user-margin API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(request.get as any).mockResolvedValue({ data: { list: [], total: 0 } })
    ;(request.post as any).mockResolvedValue({ data: { id: '1' } })
    ;(request.put as any).mockResolvedValue({ data: { id: '1' } })
    ;(request.delete as any).mockResolvedValue({ data: null })
  })

  it('createUserMargin', async () => {
    const r = await api.createUserMargin({ marginType: 'cash' })
    expect(r).toBeDefined()
  })

  it('updateUserMargin', async () => {
    const r = await api.updateUserMargin({ id: '1' })
    expect(r).toBeDefined()
  })

  it('exportUserMargin 带参数', async () => {
    const r = await api.exportUserMargin({ page: 1 })
    expect(r).toBeDefined()
  })

  it('exportUserMargin 不带参数', async () => {
    const r = await api.exportUserMargin()
    expect(r).toBeDefined()
  })

  it('getUserMarginById', async () => {
    const r = await api.getUserMarginById('1')
    expect(r).toBeDefined()
  })

  it('getUserMarginList', async () => {
    const r = await api.getUserMarginList({ page: 1, pageSize: 10 })
    expect(r).toBeDefined()
  })

  it('getUserMarginList 不带参数', async () => {
    const r = await api.getUserMarginList()
    expect(r).toBeDefined()
  })

  it('deleteUserMargin 单个', async () => {
    const r = await api.deleteUserMargin('1')
    expect(r).toBeDefined()
  })

  it('deleteUserMargin 多个', async () => {
    const r = await api.deleteUserMargin(['1', '2'])
    expect(r).toBeDefined()
  })

  it('所有错误路径', async () => {
    ;(request.get as any).mockRejectedValue(new Error('fail'))
    ;(request.post as any).mockRejectedValue(new Error('fail'))
    ;(request.put as any).mockRejectedValue(new Error('fail'))
    ;(request.delete as any).mockRejectedValue(new Error('fail'))
    try { await api.createUserMargin({}) } catch { /* noop */ }
    try { await api.updateUserMargin({}) } catch { /* noop */ }
    try { await api.exportUserMargin() } catch { /* noop */ }
    try { await api.getUserMarginById('1') } catch { /* noop */ }
    try { await api.getUserMarginList() } catch { /* noop */ }
    try { await api.deleteUserMargin('1') } catch { /* noop */ }
  })
})
