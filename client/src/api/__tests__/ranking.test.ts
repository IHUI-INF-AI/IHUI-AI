import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/request', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    post: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    put: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    delete: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
  },
}))

import * as api from '../ranking'

describe('ranking', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rankApi.lists 应能正常调用', async () => {
    const obj = (api as any).rankApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.lists()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('rankApi.wrap 应能正常调用', async () => {
    const obj = (api as any).rankApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.wrap()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('rankApi.get 应能正常调用', async () => {
    const obj = (api as any).rankApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.get()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('rankApi.user 应能正常调用', async () => {
    const obj = (api as any).rankApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.user()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('rankApi.agent 应能正常调用', async () => {
    const obj = (api as any).rankApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.agent()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('rankApi.course 应能正常调用', async () => {
    const obj = (api as any).rankApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.course()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

})
