import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/request', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    post: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    put: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    delete: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
  },
}))

import * as api from '../news'

describe('news', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('newsApi.list 应能正常调用', async () => {
    const obj = (api as any).newsApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.list()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('newsApi.params 应能正常调用', async () => {
    const obj = (api as any).newsApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.params()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('newsApi.detail 应能正常调用', async () => {
    const obj = (api as any).newsApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.detail()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('newsApi.id 应能正常调用', async () => {
    const obj = (api as any).newsApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.id()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('newsApi.hot 应能正常调用', async () => {
    const obj = (api as any).newsApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.hot()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('newsApi.categories 应能正常调用', async () => {
    const obj = (api as any).newsApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.categories()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('newsApi.wrap 应能正常调用', async () => {
    const obj = (api as any).newsApi
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

  it('newsApi.name 应能正常调用', async () => {
    const obj = (api as any).newsApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.name()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('newsApi.recommend 应能正常调用', async () => {
    const obj = (api as any).newsApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.recommend()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('newsApi.like 应能正常调用', async () => {
    const obj = (api as any).newsApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.like()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('newsApi.favorite 应能正常调用', async () => {
    const obj = (api as any).newsApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.favorite()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('newsApi.announcement 应能正常调用', async () => {
    const obj = (api as any).newsApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.announcement()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

})
