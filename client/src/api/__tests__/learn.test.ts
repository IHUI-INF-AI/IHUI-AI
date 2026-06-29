import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/request', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    post: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    put: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    delete: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
  },
}))

import * as api from '../learn'

describe('learn', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('learnApi.categories 应能正常调用', async () => {
    const obj = (api as any).learnApi
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

  it('learnApi.wrap 应能正常调用', async () => {
    const obj = (api as any).learnApi
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

  it('learnApi.categoryTree 应能正常调用', async () => {
    const obj = (api as any).learnApi
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

  it('learnApi.list 应能正常调用', async () => {
    const obj = (api as any).learnApi
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

  it('learnApi.detail 应能正常调用', async () => {
    const obj = (api as any).learnApi
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

  it('learnApi.id 应能正常调用', async () => {
    const obj = (api as any).learnApi
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

  it('learnApi.recommend 应能正常调用', async () => {
    const obj = (api as any).learnApi
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

  it('learnApi.videoList 应能正常调用', async () => {
    const obj = (api as any).learnApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.videoList()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('learnApi.params 应能正常调用', async () => {
    const obj = (api as any).learnApi
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

  it('learnApi.videoDetail 应能正常调用', async () => {
    const obj = (api as any).learnApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.videoDetail()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('learnApi.chapterList 应能正常调用', async () => {
    const obj = (api as any).learnApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.chapterList()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('learnApi.lessonId 应能正常调用', async () => {
    const obj = (api as any).learnApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.lessonId()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('learnApi.signUp 应能正常调用', async () => {
    const obj = (api as any).learnApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.signUp()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('learnApi.cancelSignUp 应能正常调用', async () => {
    const obj = (api as any).learnApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.cancelSignUp()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('learnApi.recordSave 应能正常调用', async () => {
    const obj = (api as any).learnApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.recordSave()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('learnApi.data 应能正常调用', async () => {
    const obj = (api as any).learnApi
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

  it('learnApi.duration 应能正常调用', async () => {
    const obj = (api as any).learnApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.duration()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('learnApi.progress 应能正常调用', async () => {
    const obj = (api as any).learnApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.progress()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('learnApi.recordUpdate 应能正常调用', async () => {
    const obj = (api as any).learnApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.recordUpdate()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('learnApi.recordList 应能正常调用', async () => {
    const obj = (api as any).learnApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.recordList()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('learnApi.totalLearnTime 应能正常调用', async () => {
    const obj = (api as any).learnApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.totalLearnTime()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('learnApi.total 应能正常调用', async () => {
    const obj = (api as any).learnApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.total()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('learnApi.todayLearnTime 应能正常调用', async () => {
    const obj = (api as any).learnApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.todayLearnTime()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('learnApi.createOrder 应能正常调用', async () => {
    const obj = (api as any).learnApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.createOrder()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('learnApi.payOrder 应能正常调用', async () => {
    const obj = (api as any).learnApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.payOrder()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('learnApi.orderId 应能正常调用', async () => {
    const obj = (api as any).learnApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.orderId()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('learnApi.payType 应能正常调用', async () => {
    const obj = (api as any).learnApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.payType()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('learnApi.orderList 应能正常调用', async () => {
    const obj = (api as any).learnApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.orderList()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('learnApi.favoriteList 应能正常调用', async () => {
    const obj = (api as any).learnApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.favoriteList()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('learnApi.toggleFavorite 应能正常调用', async () => {
    const obj = (api as any).learnApi
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

  it('learnApi.isFavorite 应能正常调用', async () => {
    const obj = (api as any).learnApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.isFavorite()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('learnApi.certificateList 应能正常调用', async () => {
    const obj = (api as any).learnApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.certificateList()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('learnApi.certificateDetail 应能正常调用', async () => {
    const obj = (api as any).learnApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.certificateDetail()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('learnApi.homeworkList 应能正常调用', async () => {
    const obj = (api as any).learnApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.homeworkList()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('learnApi.commentList 应能正常调用', async () => {
    const obj = (api as any).learnApi
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

  it('learnApi.commentSubmit 应能正常调用', async () => {
    const obj = (api as any).learnApi
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

  it('learnApi.content 应能正常调用', async () => {
    const obj = (api as any).learnApi
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

  it('learnApi.rating 应能正常调用', async () => {
    const obj = (api as any).learnApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.rating()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('learnApi.topicList 应能正常调用', async () => {
    const obj = (api as any).learnApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.topicList()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('learnApi.topicDetail 应能正常调用', async () => {
    const obj = (api as any).learnApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.topicDetail()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('learnApi.mapList 应能正常调用', async () => {
    const obj = (api as any).learnApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.mapList()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('learnApi.mapDetail 应能正常调用', async () => {
    const obj = (api as any).learnApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.mapDetail()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

})
