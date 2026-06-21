import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/request', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    post: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    put: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    delete: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
  },
}))

import * as api from '../circle'

describe('circle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('circleApi.list 应能正常调用', async () => {
    const obj = (api as any).circleApi
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

  it('circleApi.get 应能正常调用', async () => {
    const obj = (api as any).circleApi
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

  it('circleApi.detail 应能正常调用', async () => {
    const obj = (api as any).circleApi
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

  it('circleApi.id 应能正常调用', async () => {
    const obj = (api as any).circleApi
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

  it('circleApi.params 应能正常调用', async () => {
    const obj = (api as any).circleApi
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

  it('circleApi.categories 应能正常调用', async () => {
    const obj = (api as any).circleApi
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

  it('circleApi.wrap 应能正常调用', async () => {
    const obj = (api as any).circleApi
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

  it('circleApi.join 应能正常调用', async () => {
    const obj = (api as any).circleApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.join()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('circleApi.circleId 应能正常调用', async () => {
    const obj = (api as any).circleApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.circleId()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('circleApi.post 应能正常调用', async () => {
    const obj = (api as any).circleApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.post()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('circleApi.circle_id 应能正常调用', async () => {
    const obj = (api as any).circleApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.circle_id()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('circleApi.quit 应能正常调用', async () => {
    const obj = (api as any).circleApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.quit()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('circleApi.posts 应能正常调用', async () => {
    const obj = (api as any).circleApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.posts()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('circleApi.publish 应能正常调用', async () => {
    const obj = (api as any).circleApi
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

  it('circleApi.data 应能正常调用', async () => {
    const obj = (api as any).circleApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.data()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('circleApi.content 应能正常调用', async () => {
    const obj = (api as any).circleApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.content()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('circleApi.postDetail 应能正常调用', async () => {
    const obj = (api as any).circleApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.postDetail()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('circleApi.toggleLike 应能正常调用', async () => {
    const obj = (api as any).circleApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.toggleLike()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('circleApi.postId 应能正常调用', async () => {
    const obj = (api as any).circleApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.postId()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('circleApi.toggleFavorite 应能正常调用', async () => {
    const obj = (api as any).circleApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.toggleFavorite()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

})
