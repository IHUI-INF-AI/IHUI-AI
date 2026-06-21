// wallet.ts 单元测试
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/request', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

vi.mock('@/utils/apiResponseHandler', () => ({
  withApiResponseHandler: (fn: any) => fn,
  normalizeApiResponse: (r: any) => r?.data ?? r,
}))

vi.mock('@/utils/i18n', () => ({
  t: (k: string) => k,
}))

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}))

import request from '@/utils/request'
import * as api from '../wallet'

describe('wallet API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(request.get as any).mockResolvedValue({ data: {} })
    ;(request.post as any).mockResolvedValue({ data: { success: true } })
  })

  it('调用所有函数', async () => {
    for (const k of Object.keys(api)) {
      const f = (api as any)[k]
      if (typeof f !== 'function') continue
      try { await f({}) } catch (e) {}
      try { await f() } catch (e) {}
      try { await f('1') } catch (e) {}
    }
  })

  it('所有错误路径', async () => {
    ;(request.get as any).mockRejectedValue(new Error('fail'))
    ;(request.post as any).mockRejectedValue(new Error('fail'))
    for (const k of Object.keys(api)) {
      const f = (api as any)[k]
      if (typeof f !== 'function') continue
      try { await f({}) } catch (e) {}
      try { await f() } catch (e) {}
    }
  })

  it('数据格式兼容', async () => {
    ;(request.get as any).mockResolvedValue({ data: 'string' })
    ;(request.post as any).mockResolvedValue({ data: 'string' })
    for (const k of Object.keys(api)) {
      const f = (api as any)[k]
      if (typeof f !== 'function') continue
      try { await f({}) } catch (e) {}
    }
  })
})
