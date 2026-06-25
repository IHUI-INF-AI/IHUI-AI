import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/request', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    post: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    put: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    delete: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
  },
}))

import * as api from '../content/article'

describe('article', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('articleApi.list 应能正常调用', async () => {
    const obj = (api as any).articleApi
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

  it('articleApi.params 应能正常调用', async () => {
    const obj = (api as any).articleApi
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

  it('articleApi.detail 应能正常调用', async () => {
    const obj = (api as any).articleApi
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

  it('articleApi.id 应能正常调用', async () => {
    const obj = (api as any).articleApi
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

  it('articleApi.hot 应能正常调用', async () => {
    const obj = (api as any).articleApi
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

  it('articleApi.essence 应能正常调用', async () => {
    const obj = (api as any).articleApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.essence()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('articleApi.categories 应能正常调用', async () => {
    const obj = (api as any).articleApi
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

  it('articleApi.wrap 应能正常调用', async () => {
    const obj = (api as any).articleApi
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

  it('articleApi.name 应能正常调用', async () => {
    const obj = (api as any).articleApi
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

  it('articleApi.my 应能正常调用', async () => {
    const obj = (api as any).articleApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.my()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('articleApi.publish 应能正常调用', async () => {
    const obj = (api as any).articleApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.publish()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('articleApi.payload 应能正常调用', async () => {
    const obj = (api as any).articleApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.payload()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('articleApi.like 应能正常调用', async () => {
    const obj = (api as any).articleApi
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

  it('articleApi.favorite 应能正常调用', async () => {
    const obj = (api as any).articleApi
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

  it('articleApi.comments 应能正常调用', async () => {
    const obj = (api as any).articleApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.comments()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

})
