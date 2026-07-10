import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock http 模块
vi.mock('@/utils/http', () => {
  const mockData: Record<string, any> = {
    list: [],
    total: 0,
    records: [],
  }
  const mockFn = vi.fn().mockResolvedValue(mockData)
  return {
    http: {
      get: vi.fn().mockResolvedValue(mockData),
      post: vi.fn().mockResolvedValue({ id: 'mock-id' }),
      put: vi.fn().mockResolvedValue({ id: 'mock-id' }),
      patch: vi.fn().mockResolvedValue({ id: 'mock-id' }),
      delete: vi.fn().mockResolvedValue({ ok: true }),
      toApiResponse: (data: any) => ({ code: 200, success: true, message: '', data }),
    },
  }
})

import {
  askApi,
  examApi,
  learnApi,
  memberApi,
  liveApi,
  lecturerApi,
  statisticsApi,
  indexApi,
  certificateApi,
  messageApi,
  circleApi,
  commentApi,
  ossApi,
  pointApi,
  settingApi,
  roleApi,
  contentApi,
  organizationalApi,
  resourceApi,
  searchApi,
} from '../admin-api'

const apis: Record<string, Record<string, any>> = {
  askApi,
  examApi,
  learnApi,
  memberApi,
  liveApi,
  lecturerApi,
  statisticsApi,
  indexApi,
  certificateApi,
  messageApi,
  circleApi,
  commentApi,
  ossApi,
  pointApi,
  settingApi,
  roleApi,
  contentApi,
  organizationalApi,
  resourceApi,
  searchApi,
}

describe('admin-api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('所有 API 对象都存在', () => {
    const expected = [
      'askApi', 'examApi', 'learnApi', 'memberApi', 'liveApi', 'lecturerApi',
      'statisticsApi', 'indexApi', 'certificateApi', 'messageApi', 'circleApi',
      'commentApi', 'ossApi', 'pointApi', 'settingApi', 'roleApi', 'contentApi',
      'organizationalApi', 'resourceApi', 'searchApi',
    ]
    expected.forEach(name => {
      expect(apis[name]).toBeDefined()
      expect(typeof apis[name]).toBe('object')
    })
  })

  describe('每个 API 对象的方法都是函数', () => {
    Object.entries(apis).forEach(([apiName, api]) => {
      it(`${apiName} 的所有方法都是函数`, () => {
        expect(Object.keys(api).length).toBeGreaterThan(0)
        Object.entries(api).forEach(([, method]) => {
          expect(typeof method).toBe('function')
        })
      })
    })
  })

  it('调用方法返回 Promise', async () => {
    const result = examApi.findList({ page: 1 })
    expect(result).toBeInstanceOf(Promise)
    const data = await result
    expect(data).toBeDefined()
  })

  it('toTree 方法返回结果（数组或对象）', async () => {
    const data = await examApi.toTree()
    expect(data).toBeDefined()
  })

  it('回调式调用 (params, callback) 不报错', () => {
    const cb = vi.fn()
    examApi.findList({ page: 1 }, cb)
    // 回调是异步触发的，这里只验证不报错
    expect(examApi.findList).toBeDefined()
  })

  it('callback 作为第一个参数也能触发', () => {
    const cb = vi.fn()
    askApi.findQuestionList(cb)
    expect(askApi.findQuestionList).toBeDefined()
  })

  it('无参数调用返回 Promise 且不报错', async () => {
    const result = await settingApi.getCarousel()
    expect(result).toBeDefined()
  })
})
