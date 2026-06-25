// aiChat.ts 单元测试
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/request', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('@/utils/storage', () => ({
  StorageManager: { getItem: vi.fn(() => 'token') },
  STORAGE_KEYS: { USER_UUID: 'u', TOKEN: 't' },
}))

vi.mock('@/config/backend-paths', () => ({
  DEVELOPER_PATHS: { models: { list: '/models' } },
  API_V1_PATHS: { chat: { process: '/chat/process' } },
  COZE_PATHS: { chatStream: '/chat/stream', userModelChat: { byId: (id: string) => `/userchat/${id}` } },
}))

vi.mock('../system/fastapi', () => ({
  createTask: vi.fn(() => Promise.resolve({ code: 200, data: { id: 't1' } })),
}))

import request from '@/utils/request'
import * as api from '../ai/aiChat'

describe('aiChat API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(request.get as any).mockResolvedValue({ data: ['m1'] })
    ;(request.post as any).mockResolvedValue({ data: { code: 200, msg: 'ok', data: { content: 'c' } } })
    ;(request.delete as any).mockResolvedValue({ data: undefined })
  })

  it('sendAIChatMessage 正常', async () => {
    const r = await api.sendAIChatMessage({ content: 'c', modelId: 'm' })
    expect(r).toBeDefined()
  })

  it('sendAIChatMessage 错误', async () => {
    ;(request.post as any).mockRejectedValue(new Error('fail'))
    const r = await api.sendAIChatMessage({ content: 'c', modelId: 'm' })
    expect(r).toBeDefined()
  })

  it('sendAIChatMessage agentic 成功', async () => {
    const r = await api.sendAIChatMessage({ content: 'c', modelId: 'm', useAgentic: true })
    expect(r).toBeDefined()
  })

  it('sendAIChatMessage agentic 失败回退', async () => {
    const fastapiMod = await import('../system/fastapi')
    ;(fastapiMod.createTask as any).mockResolvedValueOnce({ code: 500 })
    const r = await api.sendAIChatMessage({ content: 'c', modelId: 'm', useAgentic: true })
    expect(r).toBeDefined()
  })

  it('sendAIChatMessage window userUuid', async () => {
    ;(globalThis as any).userUuid = 'window-uuid'
    const r = await api.sendAIChatMessage({ content: 'c', modelId: 'm' })
    expect(r).toBeDefined()
    delete (globalThis as any).userUuid
  })

  it('getAIChatModels 数组', async () => {
    const r = await api.getAIChatModels()
    expect(r.data).toEqual(['m1'])
  })

  it('getAIChatModels 非数组', async () => {
    ;(request.get as any).mockResolvedValue({ data: 'not-array' })
    const r = await api.getAIChatModels()
    expect(r.data).toEqual([])
  })

  it('getAIChatModels 错误', async () => {
    ;(request.get as any).mockRejectedValue(new Error('fail'))
    const r = await api.getAIChatModels()
    expect(r.success).toBe(false)
  })

  it('getAIChatModels 无 data', async () => {
    ;(request.get as any).mockResolvedValue({})
    const r = await api.getAIChatModels()
    expect(r.data).toEqual([])
  })

  it('getAIChatHistory 数组', async () => {
    ;(request.get as any).mockResolvedValue({ data: [{ id: 1 }] })
    const r = await api.getAIChatHistory('s1')
    expect(r.data?.length).toBe(1)
  })

  it('getAIChatHistory 单对象', async () => {
    ;(request.get as any).mockResolvedValue({ data: { id: 1 } })
    const r = await api.getAIChatHistory('s1')
    expect(r.data?.length).toBe(1)
  })

  it('getAIChatHistory 空', async () => {
    ;(request.get as any).mockResolvedValue({})
    const r = await api.getAIChatHistory('s1')
    expect(r.data).toEqual([])
  })

  it('getAIChatHistory 错误', async () => {
    ;(request.get as any).mockRejectedValue(new Error('fail'))
    const r = await api.getAIChatHistory('s1')
    expect(r.success).toBe(false)
  })

  it('deleteAIChatSession', async () => {
    const r = await api.deleteAIChatSession('s1')
    expect(r.success).toBe(true)
  })

  it('deleteAIChatSession 错误', async () => {
    ;(request.delete as any).mockRejectedValue(new Error('fail'))
    const r = await api.deleteAIChatSession('s1')
    expect(r.success).toBe(false)
  })

  it('sendAIChatMessageStream 正常', async () => {
    const encoder = new TextEncoder()
    ;(globalThis as any).fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        body: {
          getReader: () => ({
            read: vi.fn()
              .mockResolvedValueOnce({ done: false, value: encoder.encode('data: {"content":"hi"}\n') })
              .mockResolvedValueOnce({ done: false, value: encoder.encode('data: [DONE]\n') })
              .mockResolvedValueOnce({ done: true, value: undefined }),
          }),
        },
      })
    ) as any
    const onChunk = vi.fn()
    const onComplete = vi.fn()
    const onError = vi.fn()
    await api.sendAIChatMessageStream({ content: 'c', modelId: 'm' }, onChunk, onComplete, onError)
    expect(onError).not.toHaveBeenCalled()
  })

  it('sendAIChatMessageStream delta 格式', async () => {
    const encoder = new TextEncoder()
    ;(globalThis as any).fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        body: {
          getReader: () => ({
            read: vi.fn()
              .mockResolvedValueOnce({ done: false, value: encoder.encode('data: {"delta":{"content":"d"}}\n') })
              .mockResolvedValueOnce({ done: true, value: undefined }),
          }),
        },
      })
    ) as any
    const onChunk = vi.fn()
    await api.sendAIChatMessageStream({ content: 'c', modelId: 'm' }, onChunk, () => {}, () => {})
    expect(onChunk).toHaveBeenCalled()
  })

  it('sendAIChatMessageStream 非 data 行', async () => {
    const encoder = new TextEncoder()
    ;(globalThis as any).fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        body: {
          getReader: () => ({
            read: vi.fn()
              .mockResolvedValueOnce({ done: false, value: encoder.encode('not-data\n') })
              .mockResolvedValueOnce({ done: true, value: undefined }),
          }),
        },
      })
    ) as any
    await api.sendAIChatMessageStream({ content: 'c', modelId: 'm' }, () => {}, () => {}, () => {})
  })

  it('sendAIChatMessageStream 解析错误', async () => {
    const encoder = new TextEncoder()
    ;(globalThis as any).fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        body: {
          getReader: () => ({
            read: vi.fn()
              .mockResolvedValueOnce({ done: false, value: encoder.encode('data: not-json\n') })
              .mockResolvedValueOnce({ done: true, value: undefined }),
          }),
        },
      })
    ) as any
    await api.sendAIChatMessageStream({ content: 'c', modelId: 'm' }, () => {}, () => {}, () => {})
  })

  it('sendAIChatMessageStream HTTP 错误', async () => {
    ;(globalThis as any).fetch = vi.fn(() => Promise.resolve({ ok: false, status: 500, body: null })) as any
    const onError = vi.fn()
    await api.sendAIChatMessageStream({ content: 'c', modelId: 'm' }, () => {}, () => {}, onError)
    expect(onError).toHaveBeenCalled()
  })

  it('sendAIChatMessageStream 无 reader', async () => {
    ;(globalThis as any).fetch = vi.fn(() => Promise.resolve({ ok: true, body: null })) as any
    const onError = vi.fn()
    await api.sendAIChatMessageStream({ content: 'c', modelId: 'm' }, () => {}, () => {}, onError)
    expect(onError).toHaveBeenCalled()
  })

  it('sendAIChatMessageStream window userUuid', async () => {
    ;(globalThis as any).userUuid = 'win-uuid'
    const encoder = new TextEncoder()
    ;(globalThis as any).fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        body: {
          getReader: () => ({
            read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
          }),
        },
      })
    ) as any
    await api.sendAIChatMessageStream({ content: 'c', modelId: 'm' }, () => {}, () => {}, () => {})
    delete (globalThis as any).userUuid
  })
})
