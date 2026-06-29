import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/request', () => ({
  default: { post: vi.fn() },
}))

vi.mock('@/utils/apiResponseHandler', () => ({
  withApiResponseHandler: <T extends (...args: unknown[]) => Promise<unknown>>(fn: T) => fn,
  normalizeApiResponse: (r: any) => r,
}))

import request from '@/utils/request'
import { createAuthUser } from '../auth-user'

describe('auth-user', () => {
  beforeEach(() => {
    vi.mocked(request.post).mockReset()
  })

  it('createAuthUser 调用 request.post 并返回响应', async () => {
    const mockResponse = { data: { id: 'u-1', realName: '张三' } }
    vi.mocked(request.post).mockResolvedValueOnce(mockResponse)
    const data = { id: 'u-1', realName: '张三' }
    const res = await createAuthUser(data)
    expect(request.post).toHaveBeenCalledWith('/auth/user', data)
    expect(res).toBe(mockResponse)
  })

  it('createAuthUser 异常时正常抛出', async () => {
    vi.mocked(request.post).mockRejectedValueOnce(new Error('网络错误'))
    await expect(createAuthUser({} as any)).rejects.toThrow('网络错误')
  })
})
