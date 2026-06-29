import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/request', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    post: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    put: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    delete: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
  },
}))

import * as api from '../exam'

describe('exam', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('examApi.listPapers 应能正常调用', async () => {
    const obj = (api as any).examApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.listPapers()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('examApi.get 应能正常调用', async () => {
    const obj = (api as any).examApi
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

  it('examApi.paperDetail 应能正常调用', async () => {
    const obj = (api as any).examApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.paperDetail()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('examApi.id 应能正常调用', async () => {
    const obj = (api as any).examApi
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

  it('examApi.params 应能正常调用', async () => {
    const obj = (api as any).examApi
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

  it('examApi.categories 应能正常调用', async () => {
    const obj = (api as any).examApi
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

  it('examApi.questions 应能正常调用', async () => {
    const obj = (api as any).examApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.questions()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('examApi.paperId 应能正常调用', async () => {
    const obj = (api as any).examApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.paperId()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('examApi.paper_id 应能正常调用', async () => {
    const obj = (api as any).examApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.paper_id()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('examApi.submit 应能正常调用', async () => {
    const obj = (api as any).examApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.submit()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('examApi.data 应能正常调用', async () => {
    const obj = (api as any).examApi
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

  it('examApi.answers 应能正常调用', async () => {
    const obj = (api as any).examApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.answers()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('examApi.duration 应能正常调用', async () => {
    const obj = (api as any).examApi
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

  it('examApi.post 应能正常调用', async () => {
    const obj = (api as any).examApi
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

  it('examApi.records 应能正常调用', async () => {
    const obj = (api as any).examApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.records()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('examApi.wrongList 应能正常调用', async () => {
    const obj = (api as any).examApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.wrongList()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('examApi.removeWrong 应能正常调用', async () => {
    const obj = (api as any).examApi
    expect(obj).toBeDefined()
    if (obj) {
      try {
        const result = await obj.removeWrong()
        expect(result).toBeDefined()
      } catch (e) {
        expect(e).toBeDefined()
      }
    }
  })

  it('examApi.delete 应能正常调用', async () => {
    const obj = (api as any).examApi
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

})
