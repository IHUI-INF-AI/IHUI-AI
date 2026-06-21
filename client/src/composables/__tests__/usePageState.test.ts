import { describe, it, expect, vi, beforeEach } from 'vitest'
import { usePageState, useListPageState } from '../usePageState'

vi.mock('element-plus', () => ({
  ElMessage: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('../useApiError', () => ({
  useApiError: vi.fn(() => ({
    error: { value: null },
    loading: { value: false },
    execute: vi.fn().mockImplementation(async (apiCall) => {
      const response = await apiCall()
      if (response.code === 200 || response.success) {
        return response.data
      }
      return null
    }),
    clearError: vi.fn(),
  })),
}))

describe('usePageState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应该返回页面状态和方法', () => {
    const { data, loading, error, isEmpty, emptyText, fetchData, reset, clearError } = usePageState()
    expect(data.value).toBeNull()
    expect(loading.value).toBe(false)
    expect(error.value).toBeNull()
    expect(isEmpty.value).toBe(true)
    expect(emptyText).toBe('暂无数据')
    expect(typeof fetchData).toBe('function')
    expect(typeof reset).toBe('function')
    expect(typeof clearError).toBe('function')
  })

  it('应该支持自定义emptyText', () => {
    const { emptyText } = usePageState({ emptyText: '没有数据' })
    expect(emptyText).toBe('没有数据')
  })

  describe('isEmpty', () => {
    it('应该返回true当data为null', () => {
      const { isEmpty } = usePageState()
      expect(isEmpty.value).toBe(true)
    })

    it('应该返回true当data为空数组', () => {
      const { data, isEmpty } = usePageState<string[]>()
      data.value = []
      expect(isEmpty.value).toBe(true)
    })

    it('应该返回false当data有值', () => {
      const { data, isEmpty } = usePageState<string[]>()
      data.value = ['item']
      expect(isEmpty.value).toBe(false)
    })

    it('应该返回true当data为空对象', () => {
      const { data, isEmpty } = usePageState<Record<string, unknown>>()
      data.value = {}
      expect(isEmpty.value).toBe(true)
    })

    it('应该返回false当data有属性', () => {
      const { data, isEmpty } = usePageState<Record<string, unknown>>()
      data.value = { key: 'value' }
      expect(isEmpty.value).toBe(false)
    })
  })

  describe('fetchData', () => {
    it('应该获取数据', async () => {
      const { data, fetchData } = usePageState()
      const apiCall = vi.fn().mockResolvedValue({ code: 200, data: { id: 1 }, success: true })
      
      const result = await fetchData(apiCall)
      
      expect(result).toEqual({ id: 1 })
      expect(data.value).toEqual({ id: 1 })
    })

    it('应该处理失败响应', async () => {
      const { data, fetchData } = usePageState()
      const apiCall = vi.fn().mockResolvedValue({ code: 400, message: 'Error', data: null })
      
      const result = await fetchData(apiCall)
      
      expect(result).toBeNull()
      expect(data.value).toBeNull()
    })

    it('应该调用onSuccess回调', async () => {
      const { fetchData } = usePageState()
      const apiCall = vi.fn().mockResolvedValue({ code: 200, data: { id: 1 }, success: true })
      const onSuccess = vi.fn()
      
      await fetchData(apiCall, { onSuccess })
      
      expect(onSuccess).toHaveBeenCalledWith({ id: 1 })
    })

    it('应该调用transform函数', async () => {
      const { data, fetchData } = usePageState()
      const apiCall = vi.fn().mockResolvedValue({ code: 200, data: { id: 1 }, success: true })
      const transform = vi.fn((d) => ({ ...d, transformed: true }))
      
      await fetchData(apiCall, { transform })
      
      expect(data.value).toEqual({ id: 1, transformed: true })
    })
  })

  describe('reset', () => {
    it('应该重置状态', () => {
      const { data, reset } = usePageState()
      data.value = { id: 1 } as any
      reset()
      expect(data.value).toBeNull()
    })
  })
})

describe('useListPageState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应该返回列表页面状态和方法', () => {
    const { data, loading, error, isEmpty, pagination, loadList, resetList } = useListPageState()
    expect(data.value).toBeNull()
    expect(loading.value).toBe(false)
    expect(error.value).toBeNull()
    expect(pagination.value.page).toBe(1)
    expect(pagination.value.pageSize).toBe(20)
    expect(pagination.value.total).toBe(0)
    expect(typeof loadList).toBe('function')
    expect(typeof resetList).toBe('function')
  })

  describe('loadList', () => {
    it('应该加载列表数据', async () => {
      const { data, pagination, loadList } = useListPageState()
      const apiCall = vi.fn().mockResolvedValue({
        code: 200,
        data: { list: [{ id: 1 }, { id: 2 }], total: 2 },
      })
      
      const result = await loadList(apiCall)
      
      expect(result).toEqual([{ id: 1 }, { id: 2 }])
      expect(data.value).toEqual([{ id: 1 }, { id: 2 }])
      expect(pagination.value.total).toBe(2)
    })

    it('应该重置列表', async () => {
      const { data, pagination, loadList } = useListPageState()
      const apiCall = vi.fn().mockResolvedValue({
        code: 200,
        data: { list: [{ id: 1 }], total: 1 },
      })
      
      await loadList(apiCall, { reset: true })
      
      expect(pagination.value.page).toBe(1)
    })

    it('应该调用onSuccess回调', async () => {
      const { loadList } = useListPageState()
      const apiCall = vi.fn().mockResolvedValue({
        code: 200,
        data: { list: [{ id: 1 }], total: 1 },
      })
      const onSuccess = vi.fn()
      
      await loadList(apiCall, { onSuccess })
      
      expect(onSuccess).toHaveBeenCalledWith([{ id: 1 }])
    })
  })

  describe('resetList', () => {
    it('应该重置列表状态', () => {
      const { data, pagination, resetList } = useListPageState()
      data.value = [{ id: 1 }] as any
      pagination.value.page = 2
      pagination.value.total = 10
      
      resetList()
      
      expect(data.value).toBeNull()
      expect(pagination.value.page).toBe(1)
      expect(pagination.value.total).toBe(0)
    })
  })
})
