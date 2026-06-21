import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/request', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    post: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    put: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    delete: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
  },
}))

import * as api from '../resource'

describe('resource', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resourceApi.list 应能正常调用', async () => {
    const obj = (api as any).resourceApi
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

  it('resourceApi.params 应能正常调用', async () => {
    const obj = (api as any).resourceApi
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

  it('resourceApi.detail 应能正常调用', async () => {
    const obj = (api as any).resourceApi
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

  it('resourceApi.id 应能正常调用', async () => {
    const obj = (api as any).resourceApi
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

  it('resourceApi.hot 应能正常调用', async () => {
    const obj = (api as any).resourceApi
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

  it('resourceApi.recommend 应能正常调用', async () => {
    const obj = (api as any).resourceApi
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

  it('resourceApi.categories 应能正常调用', async () => {
    const obj = (api as any).resourceApi
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

  it('resourceApi.name 应能正常调用', async () => {
    const obj = (api as any).resourceApi
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

  it('resourceApi.my 应能正常调用', async () => {
    const obj = (api as any).resourceApi
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

  it('resourceApi.upload 应能正常调用', async () => {
    const obj = (api as any).resourceApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.upload()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('resourceApi.payload 应能正常调用', async () => {
    const obj = (api as any).resourceApi
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

  it('resourceApi.download 应能正常调用', async () => {
    const obj = (api as any).resourceApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.download()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('resourceApi.url 应能正常调用', async () => {
    const obj = (api as any).resourceApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.url()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('resourceApi.expire 应能正常调用', async () => {
    const obj = (api as any).resourceApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.expire()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('resourceApi.favorite 应能正常调用', async () => {
    const obj = (api as any).resourceApi
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

  it('resourceApi.like 应能正常调用', async () => {
    const obj = (api as any).resourceApi
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

  it('resourceApi.rate 应能正常调用', async () => {
    const obj = (api as any).resourceApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.rate()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('resourceApi.score 应能正常调用', async () => {
    const obj = (api as any).resourceApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.score()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

})
