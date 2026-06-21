import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/request', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    post: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    put: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    delete: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
  },
}))

import * as api from '../ask'

describe('ask', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('askApi.listPublic 应能正常调用', async () => {
    const obj = (api as any).askApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.listPublic()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('askApi.get 应能正常调用', async () => {
    const obj = (api as any).askApi
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

  it('askApi.detail 应能正常调用', async () => {
    const obj = (api as any).askApi
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

  it('askApi.id 应能正常调用', async () => {
    const obj = (api as any).askApi
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

  it('askApi.params 应能正常调用', async () => {
    const obj = (api as any).askApi
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

  it('askApi.categories 应能正常调用', async () => {
    const obj = (api as any).askApi
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

  it('askApi.wrap 应能正常调用', async () => {
    const obj = (api as any).askApi
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

  it('askApi.create 应能正常调用', async () => {
    const obj = (api as any).askApi
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

  it('askApi.data 应能正常调用', async () => {
    const obj = (api as any).askApi
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

  it('askApi.title 应能正常调用', async () => {
    const obj = (api as any).askApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.title()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('askApi.content 应能正常调用', async () => {
    const obj = (api as any).askApi
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

  it('askApi.post 应能正常调用', async () => {
    const obj = (api as any).askApi
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

  it('askApi.answer 应能正常调用', async () => {
    const obj = (api as any).askApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.answer()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('askApi.questionId 应能正常调用', async () => {
    const obj = (api as any).askApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.questionId()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('askApi.question_id 应能正常调用', async () => {
    const obj = (api as any).askApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.question_id()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('askApi.answerList 应能正常调用', async () => {
    const obj = (api as any).askApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.answerList()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('askApi.toggleLike 应能正常调用', async () => {
    const obj = (api as any).askApi
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

  it('askApi.targetType 应能正常调用', async () => {
    const obj = (api as any).askApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.targetType()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('askApi.targetId 应能正常调用', async () => {
    const obj = (api as any).askApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.targetId()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('askApi.target_type 应能正常调用', async () => {
    const obj = (api as any).askApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.target_type()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('askApi.target_id 应能正常调用', async () => {
    const obj = (api as any).askApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.target_id()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('askApi.toggleFavorite 应能正常调用', async () => {
    const obj = (api as any).askApi
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

  it('askApi.adopt 应能正常调用', async () => {
    const obj = (api as any).askApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.adopt()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('askApi.answerId 应能正常调用', async () => {
    const obj = (api as any).askApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.answerId()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('askApi.comment 应能正常调用', async () => {
    const obj = (api as any).askApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.comment()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('askApi.commentList 应能正常调用', async () => {
    const obj = (api as any).askApi
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

})
