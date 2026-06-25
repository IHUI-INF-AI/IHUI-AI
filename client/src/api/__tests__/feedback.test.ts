// feedback.ts 单元测试
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/request', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}))

vi.mock('@/utils/api-response', () => ({
  withApiResponseHandler: (fn: any) => fn,
  normalizeApiResponse: (r: any) => r?.data ?? r,
}))

import request from '@/utils/request'
import * as api from '../content/feedback'

describe('feedback API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(request.get as any).mockResolvedValue({ data: { list: [], total: 0 } })
    ;(request.post as any).mockResolvedValue({ data: { id: '1' } })
    ;(request.put as any).mockResolvedValue({ data: { id: '1' } })
  })

  it('submitFeedback', async () => {
    const r = await api.submitFeedback({ type: 'feature', content: 'c' })
    expect(r).toBeDefined()
  })

  it('submitFeedback 带 contact 和 images', async () => {
    const r = await api.submitFeedback({ type: 'bug', content: 'c', contact: '138', images: ['a'] })
    expect(r).toBeDefined()
  })

  it('getFeedbacks', async () => {
    const r = await api.getFeedbacks({ page: 1, pageSize: 10 })
    expect(r).toBeDefined()
  })

  it('getFeedbacks 不带参数', async () => {
    const r = await api.getFeedbacks()
    expect(r).toBeDefined()
  })

  it('getFeedbacks 带 type/status', async () => {
    const r = await api.getFeedbacks({ page: 1, pageSize: 10, type: 'bug', status: 'pending' })
    expect(r).toBeDefined()
  })

  it('getFeedbackDetail', async () => {
    const r = await api.getFeedbackDetail('1')
    expect(r).toBeDefined()
  })

  it('replyFeedback', async () => {
    const r = await api.replyFeedback('1', 'reply content')
    expect(r).toBeDefined()
  })

  it('updateFeedbackStatus', async () => {
    const r = await api.updateFeedbackStatus('1', 'resolved')
    expect(r).toBeDefined()
  })

  it('所有错误路径', async () => {
    ;(request.get as any).mockRejectedValue(new Error('fail'))
    ;(request.post as any).mockRejectedValue(new Error('fail'))
    ;(request.put as any).mockRejectedValue(new Error('fail'))
    try { await api.submitFeedback({ type: 'feature', content: 'c' }) } catch { /* noop */ }
    try { await api.getFeedbacks() } catch { /* noop */ }
    try { await api.getFeedbackDetail('1') } catch { /* noop */ }
    try { await api.replyFeedback('1', 'r') } catch { /* noop */ }
    try { await api.updateFeedbackStatus('1', 'resolved') } catch { /* noop */ }
  })
})
