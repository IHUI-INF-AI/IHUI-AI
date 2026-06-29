// ai-proxy.ts 单元测试
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/request', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}))

vi.mock('@/utils/api-response', () => ({
  withApiResponseHandler: (fn: any) => fn,
  normalizeApiResponse: (r: any) => r?.data ?? r,
}))

vi.mock('@/utils/i18n', () => ({
  t: (k: string) => k,
}))

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

vi.mock('@/utils/storage', () => ({
  StorageManager: { getItem: vi.fn(() => 'token') },
  STORAGE_KEYS: { TOKEN: 't' },
  TokenStorage: { getToken: vi.fn(() => 'test-token') },
}))

vi.mock('@/config/backend-paths', () => ({
  COZE_PATHS: { ai: { models: '/ai/models', chatCompletions: '/ai/chat', chatCompletionsStream: '/ai/chat/stream' } },
}))

import request from '@/utils/request'
import * as api from '../ai-proxy'

describe('ai-proxy API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(request.get as any).mockResolvedValue({ data: { models: [] } })
    ;(request.post as any).mockResolvedValue({ data: { id: 'r1' } })
  })

  it('getSupportedModels 正常', async () => {
    const r = await api.getSupportedModels()
    expect(r).toBeDefined()
  })

  it('getSupportedModels 错误', async () => {
    ;(request.get as any).mockRejectedValue(new Error('fail'))
    try { await api.getSupportedModels() } catch (e) {}
  })

  it('chatCompletions 正常', async () => {
    const r = await api.chatCompletions({ model: 'm', messages: [] })
    expect(r).toBeDefined()
  })

  it('chatCompletions 错误', async () => {
    ;(request.post as any).mockRejectedValue(new Error('fail'))
    try { await api.chatCompletions({ model: 'm', messages: [] }) } catch (e) {}
  })

  it('chatCompletionsStream 正常', async () => {
    const encoder = new TextEncoder()
    ;(globalThis as any).fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        body: {
          getReader: () => ({
            read: vi.fn()
              .mockResolvedValueOnce({ done: false, value: encoder.encode('data: {"event":"chunk","content":"hi"}\n\n') })
              .mockResolvedValueOnce({ done: true, value: undefined }),
          }),
        },
      })
    ) as any
    const events: any[] = []
    await api.chatCompletionsStream({ model: 'm', messages: [] }, (e) => events.push(e))
    expect(events.length).toBeGreaterThan(0)
  })

  it('chatCompletionsStream HTTP 错误', async () => {
    ;(globalThis as any).fetch = vi.fn(() => Promise.resolve({ ok: false, status: 500 })) as any
    const onEvent = vi.fn()
    try { await api.chatCompletionsStream({ model: 'm', messages: [] }, onEvent) } catch (e) {}
    expect(onEvent).toHaveBeenCalled()
  })

  it('chatCompletionsStream 解析错误', async () => {
    const encoder = new TextEncoder()
    ;(globalThis as any).fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        body: {
          getReader: () => ({
            read: vi.fn()
              .mockResolvedValueOnce({ done: false, value: encoder.encode('data: not-json\n\n') })
              .mockResolvedValueOnce({ done: true, value: undefined }),
          }),
        },
      })
    ) as any
    await api.chatCompletionsStream({ model: 'm', messages: [] }, () => {})
  })

  it('chatCompletionsStream fetch 失败', async () => {
    ;(globalThis as any).fetch = vi.fn(() => Promise.reject(new Error('fail'))) as any
    const onEvent = vi.fn()
    try { await api.chatCompletionsStream({ model: 'm', messages: [] }, onEvent) } catch (e) {}
    expect(onEvent).toHaveBeenCalled()
  })
})
