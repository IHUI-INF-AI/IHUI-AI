import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { ApiResult } from '@ihui/types'

vi.mock('@ihui/api-client/client', () => ({
  fetchApi: vi.fn(),
}))

import { fetchApi } from '@ihui/api-client/client'
import { getProfile, updateProfile } from '../user-api'

describe('user-api', () => {
  beforeEach(() => vi.clearAllMocks())

  it('getProfile调用fetchApi GET /api/auth/me', async () => {
    const profile = {
      id: 'u1',
      username: 'test',
      nickname: 'Test',
      avatar: null,
      email: null,
      phone: null,
      bio: null,
      gender: null,
      birthday: null,
      createdAt: '',
      updatedAt: '',
    }
    vi.mocked(fetchApi).mockResolvedValue({ success: true, data: profile } as ApiResult<
      typeof profile
    >)

    const r = await getProfile()
    expect(fetchApi).toHaveBeenCalledWith('/api/auth/me')
    expect(r.success).toBe(true)
    if (r.success) expect(r.data).toEqual(profile)
  })

  it('getProfile失败时返回error', async () => {
    vi.mocked(fetchApi).mockResolvedValue({ success: false, error: '未登录' })

    const r = await getProfile()
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toBe('未登录')
  })

  it('updateProfile调用fetchApi PUT /auth/profile 携带body', async () => {
    const profile = {
      id: 'u1',
      username: 'test',
      nickname: 'New',
      avatar: null,
      email: null,
      phone: null,
      bio: 'hi',
      gender: 1,
      birthday: '2000-01-01',
      createdAt: '',
      updatedAt: '',
    }
    vi.mocked(fetchApi).mockResolvedValue({ success: true, data: profile } as ApiResult<
      typeof profile
    >)

    const input = { nickname: 'New', bio: 'hi', gender: 1, birthday: '2000-01-01' }
    const r = await updateProfile(input)
    expect(fetchApi).toHaveBeenCalledWith('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(input),
    })
    expect(r.success).toBe(true)
  })

  it('updateProfile不传可选字段时body仅含已传字段', async () => {
    vi.mocked(fetchApi).mockResolvedValue({ success: true, data: {} as never })

    await updateProfile({ nickname: 'OnlyNick' })
    const call = vi.mocked(fetchApi).mock.calls[0]!
    expect(call[0]).toBe('/auth/profile')
    const opts = call[1] as RequestInit
    expect(opts.method).toBe('PUT')
    expect(JSON.parse(opts.body as string)).toEqual({ nickname: 'OnlyNick' })
  })

  it('updateProfile失败时返回error', async () => {
    vi.mocked(fetchApi).mockResolvedValue({ success: false, error: '昵称已被占用' })

    const r = await updateProfile({ nickname: 'taken' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toBe('昵称已被占用')
  })
})
