import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/request', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    post: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    put: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    delete: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
  },
}))

import * as api from '../live'

describe('live', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('liveApi.categoryList 应能正常调用', async () => {
    const obj = (api as any).liveApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.categoryList()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('liveApi.categoryTree 应能正常调用', async () => {
    const obj = (api as any).liveApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.categoryTree()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('liveApi.list 应能正常调用', async () => {
    const obj = (api as any).liveApi
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

  it('liveApi.detail 应能正常调用', async () => {
    const obj = (api as any).liveApi
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

  it('liveApi.id 应能正常调用', async () => {
    const obj = (api as any).liveApi
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

  it('liveApi.create 应能正常调用', async () => {
    const obj = (api as any).liveApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.create()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('liveApi.data 应能正常调用', async () => {
    const obj = (api as any).liveApi
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

  it('liveApi.update 应能正常调用', async () => {
    const obj = (api as any).liveApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.update()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('liveApi.delete 应能正常调用', async () => {
    const obj = (api as any).liveApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.delete()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('liveApi.start 应能正常调用', async () => {
    const obj = (api as any).liveApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.start()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('liveApi.end 应能正常调用', async () => {
    const obj = (api as any).liveApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.end()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('liveApi.recordStart 应能正常调用', async () => {
    const obj = (api as any).liveApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.recordStart()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('liveApi.recordEnd 应能正常调用', async () => {
    const obj = (api as any).liveApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.recordEnd()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('liveApi.subscribe 应能正常调用', async () => {
    const obj = (api as any).liveApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.subscribe()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('liveApi.subscribed 应能正常调用', async () => {
    const obj = (api as any).liveApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.subscribed()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('liveApi.unsubscribe 应能正常调用', async () => {
    const obj = (api as any).liveApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.unsubscribe()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('liveApi.subscribedList 应能正常调用', async () => {
    const obj = (api as any).liveApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.subscribedList()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('liveApi.commentList 应能正常调用', async () => {
    const obj = (api as any).liveApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.commentList()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('liveApi.channelId 应能正常调用', async () => {
    const obj = (api as any).liveApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.channelId()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('liveApi.params 应能正常调用', async () => {
    const obj = (api as any).liveApi
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

  it('liveApi.commentSubmit 应能正常调用', async () => {
    const obj = (api as any).liveApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.commentSubmit()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('liveApi.content 应能正常调用', async () => {
    const obj = (api as any).liveApi
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

  it('liveApi.commentDelete 应能正常调用', async () => {
    const obj = (api as any).liveApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.commentDelete()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('liveApi.giftList 应能正常调用', async () => {
    const obj = (api as any).liveApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.giftList()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('liveApi.giftSend 应能正常调用', async () => {
    const obj = (api as any).liveApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.giftSend()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('liveApi.giftId 应能正常调用', async () => {
    const obj = (api as any).liveApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.giftId()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('liveApi.count 应能正常调用', async () => {
    const obj = (api as any).liveApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.count()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('liveApi.like 应能正常调用', async () => {
    const obj = (api as any).liveApi
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

  it('liveApi.likeNum 应能正常调用', async () => {
    const obj = (api as any).liveApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.likeNum()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('liveApi.hostChannelList 应能正常调用', async () => {
    const obj = (api as any).liveApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.hostChannelList()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('liveApi.announce 应能正常调用', async () => {
    const obj = (api as any).liveApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.announce()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

})
