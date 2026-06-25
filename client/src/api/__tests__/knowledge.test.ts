// knowledge.ts 单元测试
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('axios', () => {
  const mockClient: any = {
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  }
  return {
    default: {
      create: vi.fn(() => mockClient),
    },
  }
})

vi.mock('@/utils/storage', () => ({
  StorageManager: { getItem: vi.fn(() => '') },
  STORAGE_KEYS: { ACCESS_TOKEN: 'a', USER_TOKEN: 'u', TOKEN: 't' },
}))

vi.mock('@/utils/i18n', () => ({
  t: (k: string) => k,
}))

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

import axios from 'axios'
import * as api from '../knowledge/knowledge'

const mockClient: any = (axios.create as any)()

describe('knowledge API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 默认 mock 返回已经经过拦截器转换的 ApiResponse 格式
    mockClient.get.mockResolvedValue({ data: { list: [{ id: 1, title: 'kb' }], total: 1 } })
    mockClient.post.mockResolvedValue({ data: { id: 1, success: true, data: { id: 1 } } })
    mockClient.put.mockResolvedValue({ data: { success: true, data: { id: 1 } } })
    mockClient.delete.mockResolvedValue({ data: { success: true } })
  })

  it('createKnowledgeBase', async () => {
    const res = await api.createKnowledgeBase({ kbName: 'x' })
    expect(res).toBeDefined()
  })

  it('getKnowledgeBases 正常', async () => {
    const res = await api.getKnowledgeBases({ page: 1, pageSize: 10 })
    expect(res.success).toBe(true)
    expect(res.data.items.length).toBeGreaterThan(0)
  })

  it('getKnowledgeBases 错误', async () => {
    mockClient.get.mockRejectedValue(new Error('fail'))
    const res = await api.getKnowledgeBases()
    expect(res.success).toBe(false)
  })

  it('getKnowledgeBases 多种数据格式', async () => {
    mockClient.get.mockResolvedValue({ data: { list: [{ id: 1 }], total: 1 } })
    const res = await api.getKnowledgeBases()
    expect(res.success).toBe(true)
  })

  it('getRecommendedKnowledgeBases 正常', async () => {
    mockClient.get.mockResolvedValue({
      success: true, code: 200, message: 'ok', timestamp: Date.now(),
      data: { list: [{ id: 1, title: 'kb' }], total: 1 },
    })
    const res = await api.getRecommendedKnowledgeBases()
    expect(res.success).toBe(true)
  })

  it('getRecommendedKnowledgeBases 失败', async () => {
    mockClient.get.mockResolvedValue({ data: { success: false, data: null } })
    const res = await api.getRecommendedKnowledgeBases()
    expect(res.data.items).toEqual([])
  })

  it('getKnowledgeBase 正常', async () => {
    mockClient.get.mockResolvedValue({
      success: true, code: 200, message: 'ok', timestamp: Date.now(),
      data: { id: '1', title: 'kb' },
    })
    const res = await api.getKnowledgeBase('1')
    expect(res.success).toBe(true)
  })

  it('getKnowledgeBase 失败', async () => {
    mockClient.get.mockResolvedValue({ data: { success: false, data: null } })
    const res = await api.getKnowledgeBase('1')
    expect(res).toBeDefined()
  })

  it('updateKnowledgeBase', async () => {
    const res = await api.updateKnowledgeBase('1', { kbName: 'n' })
    expect(res).toBeDefined()
  })

  it('deleteKnowledgeBase', async () => {
    const res = await api.deleteKnowledgeBase('1')
    expect(res).toBeDefined()
  })

  it('getResourceCategories 正常', async () => {
    mockClient.get.mockResolvedValue({ data: { success: true, data: [{ id: 1, name: 'a' }] } })
    const res = await api.getResourceCategories(0)
    expect(res.data).toBeDefined()
  })

  it('getResourceCategories 失败', async () => {
    mockClient.get.mockResolvedValue({ data: { success: false } })
    const res = await api.getResourceCategories()
    expect(res.data).toEqual([])
  })

  it('downloadResource', async () => {
    const res = await api.downloadResource('1')
    expect(res).toBeDefined()
  })

  it('addDocumentToKnowledgeBase', async () => {
    const res = await api.addDocumentToKnowledgeBase('1', { content: 'c' })
    expect(res.success).toBe(false)
  })

  it('getKnowledgeBaseDocuments', async () => {
    const res = await api.getKnowledgeBaseDocuments('1')
    expect(res.success).toBe(true)
    expect(res.data.items).toEqual([])
  })

  it('deleteKnowledgeBaseDocument', async () => {
    const res = await api.deleteKnowledgeBaseDocument('1', '2')
    expect(res.success).toBe(false)
  })

  it('searchKnowledge 正常', async () => {
    mockClient.get.mockResolvedValue({
      success: true, code: 200, message: 'ok', timestamp: Date.now(),
      data: { list: [{ id: 1, title: 't' }] },
    })
    const res = await api.searchKnowledge({ query: 'q' })
    expect(res.success).toBe(true)
  })
})
