// models.ts 单元测试
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/request', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

vi.mock('@/utils/i18n', () => ({
  t: (k: string) => k,
}))

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

vi.mock('@/utils/envUtils', () => ({
  isDemoMode: vi.fn(() => false),
}))

vi.mock('@/config/backend-paths', () => ({
  DEVELOPER_PATHS: { models: { list: '/list', byId: (id: string) => `/${id}`, test: (id: string) => `/${id}/test`, chat: (id: string) => `/${id}/chat` } },
  COZE_PATHS: { aiModelInfo: { list: '/aimodelinfo' }, aiModels: { list: '/aimodels' } },
  API_V1_PATHS: { model: { switch: '/switch' } },
}))

import request from '@/utils/request'
import { isDemoMode } from '@/utils/envUtils'
import * as api from '../models'

describe('models API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(isDemoMode as any).mockReturnValue(false)
    ;(request.get as any).mockResolvedValue({ data: { code: 0, data: [], list: [] } })
    ;(request.post as any).mockResolvedValue({ data: { success: true } })
    ;(request.put as any).mockResolvedValue({ data: { success: true } })
    ;(request.delete as any).mockResolvedValue({ data: { success: true } })
  })

  it('getModelsList 正常', async () => {
    const r = await api.getModelsList({ page: 1, pageSize: 10 })
    expect(r).toBeDefined()
  })

  it('getModelsList demo 模式', async () => {
    ;(isDemoMode as any).mockReturnValue(true)
    const r = await api.getModelsList()
    expect(r.success).toBe(true)
  })

  it('getModelsList enabled 参数', async () => {
    const r = await api.getModelsList({ enabled: true })
    expect(r).toBeDefined()
  })

  it('getModelsList 500 错误', async () => {
    ;(request.get as any).mockRejectedValue({ response: { status: 500 } })
    const r = await api.getModelsList()
    expect(r.success).toBe(true)
  })

  it('getModelsList 其他错误', async () => {
    ;(request.get as any).mockRejectedValue({ response: { status: 401 } })
    const r = await api.getModelsList()
    expect(r.success).toBe(false)
  })

  it('getModelDetail 正常', async () => {
    const r = await api.getModelDetail('1')
    expect(r.success).toBe(true)
  })

  it('getModelDetail 错误', async () => {
    ;(request.get as any).mockRejectedValue(new Error('fail'))
    const r = await api.getModelDetail('1')
    expect(r.success).toBe(false)
  })

  it('createModel', async () => {
    const r = await api.createModel({ name: 'm' })
    expect(r.success).toBe(true)
  })

  it('createModel 错误', async () => {
    ;(request.post as any).mockRejectedValue(new Error('fail'))
    const r = await api.createModel({ name: 'm' })
    expect(r.success).toBe(false)
  })

  it('updateModel', async () => {
    const r = await api.updateModel('1', { name: 'm' })
    expect(r.success).toBe(true)
  })

  it('updateModel 错误', async () => {
    ;(request.put as any).mockRejectedValue(new Error('fail'))
    const r = await api.updateModel('1', {})
    expect(r.success).toBe(false)
  })

  it('deleteModel', async () => {
    const r = await api.deleteModel('1')
    expect(r.success).toBe(true)
  })

  it('deleteModel 错误', async () => {
    ;(request.delete as any).mockRejectedValue(new Error('fail'))
    const r = await api.deleteModel('1')
    expect(r.success).toBe(false)
  })

  it('switchModel', async () => {
    const r = await api.switchModel({ model_id: 'm' })
    expect(r.success).toBe(true)
  })

  it('switchModel 错误', async () => {
    ;(request.post as any).mockRejectedValue(new Error('fail'))
    const r = await api.switchModel({ model_id: 'm' })
    expect(r.success).toBe(false)
  })

  it('testModel 正常', async () => {
    const r = await api.testModel('1')
    expect(r.success).toBe(true)
  })

  it('testModel 错误', async () => {
    ;(request.post as any).mockRejectedValue(new Error('fail'))
    const r = await api.testModel('1')
    expect(r.success).toBe(false)
  })

  it('callModel', async () => {
    const r = await api.callModel({ modelId: 'm', messages: [] })
    expect(r.success).toBe(true)
  })

  it('callModel 错误', async () => {
    ;(request.post as any).mockRejectedValue(new Error('fail'))
    const r = await api.callModel({ modelId: 'm', messages: [] })
    expect(r.success).toBe(false)
  })

  it('getAvailableModels 正常 (array)', async () => {
    ;(request.get as any).mockResolvedValueOnce({
      data: { code: 0, data: [{ id: '1', name: 'm', type: 1, is_del: 0 }] },
    })
    const r = await api.getAvailableModels()
    expect(r.success).toBe(true)
  })

  it('getAvailableModels list 形式', async () => {
    ;(request.get as any).mockResolvedValueOnce({
      data: { data: [{ id: '1', name: 'm', type: 2, is_del: 0 }] },
    })
    const r = await api.getAvailableModels()
    expect(r.success).toBe(true)
  })

  it('getAvailableModels 备用接口', async () => {
    ;(request.get as any)
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce({ data: { list: [{ id: '1', name: 'm', type: 'talk', enabled: true }] } })
    const r = await api.getAvailableModels()
    expect(r).toBeDefined()
  })

  it('getAvailableModels 备用接口 array', async () => {
    ;(request.get as any)
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce({ data: [{ id: '1', name: 'm' }] })
    const r = await api.getAvailableModels()
    expect(r).toBeDefined()
  })

  it('getAvailableModels 备用接口 code', async () => {
    ;(request.get as any)
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce({ data: { code: 200, data: { list: [] } } })
    const r = await api.getAvailableModels()
    expect(r).toBeDefined()
  })

  it('getAvailableModels 备用接口 错误', async () => {
    ;(request.get as any).mockRejectedValue(new Error('fail'))
    const r = await api.getAvailableModels()
    expect(r.success).toBe(true)
  })

  it('getAvailableModels 备用接口 500', async () => {
    ;(request.get as any)
      .mockRejectedValueOnce({ response: { status: 500 } })
      .mockRejectedValueOnce({ response: { status: 500 } })
    try { await api.getAvailableModels() } catch { /* noop */ }
  })

  it('getAvailableModels 401 错误', async () => {
    ;(request.get as any)
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce({ data: { code: 401 } })
    try { await api.getAvailableModels() } catch { /* noop */ }
  })

  it('getAvailableModels 模型 type=0/1/3/4/5', async () => {
    ;(request.get as any).mockResolvedValueOnce({
      data: { code: 0, data: [
        { id: '1', name: 'a', type: 0, is_del: 0 },
        { id: '2', name: 'b', type: 1, is_del: 0 },
        { id: '3', name: 'c', type: 3, is_del: 0 },
        { id: '4', name: 'd', type: 4, is_del: 0 },
        { id: '5', name: 'e', type: 5, is_del: 0 },
        { id: '6', name: 'f', type: 999, is_del: 0 },
      ] },
    })
    const r = await api.getAvailableModels()
    expect(r.success).toBe(true)
  })

  it('getAvailableModels 名称推断', async () => {
    ;(request.get as any).mockResolvedValueOnce({
      data: { code: 0, data: [
        { id: '1', name: 'image-banana', is_del: 0 },
        { id: '2', name: 'video-wan2', is_del: 0 },
        { id: '3', name: 'audio-suno', is_del: 0 },
      ] },
    })
    const r = await api.getAvailableModels()
    expect(r.success).toBe(true)
  })

  it('MODEL_PROVIDERS 常量', () => {
    expect(api.MODEL_PROVIDERS.openai.name).toBe('OpenAI')
    expect(api.MODEL_PROVIDERS.anthropic.name).toBe('Anthropic')
    expect(api.MODEL_PROVIDERS.google.name).toBe('Google')
    expect(api.MODEL_PROVIDERS.coze.name).toBe('扣子（Coze）')
  })
})
