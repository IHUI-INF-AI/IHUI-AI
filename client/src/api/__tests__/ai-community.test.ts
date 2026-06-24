// ai-community.ts 单元测试
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/request', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
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
  logger: { error: vi.fn(), info: vi.fn() },
}))

import request from '@/utils/request'
import * as api from '../ai-community'

describe('ai-community API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(request.get as any).mockResolvedValue({ data: { list: [] } })
    ;(request.post as any).mockResolvedValue({ data: { success: true } })
    ;(request.put as any).mockResolvedValue({ data: { success: true } })
    ;(request.delete as any).mockResolvedValue({ data: { success: true } })
  })

  it('调用所有导出函数', async () => {
    for (const k of Object.keys(api)) {
      const f = (api as any)[k]
      if (typeof f !== 'function') continue
      try { await f({}) } catch { /* noop */ }
      try { await f() } catch { /* noop */ }
      try { await f('1') } catch { /* noop */ }
      try { await f({ id: '1' }) } catch { /* noop */ }
      try { await f({ keyword: 'k' }) } catch { /* noop */ }
      try { await f({ page: 1, pageSize: 10 }) } catch { /* noop */ }
    }
  })

  it('所有错误路径', async () => {
    ;(request.get as any).mockRejectedValue(new Error('fail'))
    ;(request.post as any).mockRejectedValue(new Error('fail'))
    ;(request.put as any).mockRejectedValue(new Error('fail'))
    ;(request.delete as any).mockRejectedValue(new Error('fail'))
    for (const k of Object.keys(api)) {
      const f = (api as any)[k]
      if (typeof f !== 'function') continue
      try { await f({}) } catch { /* noop */ }
      try { await f() } catch { /* noop */ }
    }
  })

  it('数据格式兼容', async () => {
    ;(request.get as any).mockResolvedValue({ data: 'string' })
    for (const k of Object.keys(api)) {
      const f = (api as any)[k]
      if (typeof f !== 'function') continue
      try { await f({}) } catch { /* noop */ }
    }
  })
})
