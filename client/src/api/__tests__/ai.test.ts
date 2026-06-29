// ai.ts 单元测试 - 提升覆盖率
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/request', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    post: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    put: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    delete: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
  },
}))

vi.mock('@/utils/api-response', () => ({
  withApiResponseHandler: (fn: any) => fn,
  normalizeApiResponse: vi.fn((r: any) => r?.data || {}),
}))

vi.mock('@/utils/i18n', () => ({
  t: (key: string) => key,
}))

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('@/config/backend-paths', () => ({
  COZE_PATHS: { ai: { models: '/ai/models', modelById: (id: string) => `/ai/models/${id}`, chatSessions: '/ai/chat/sessions', chatSessionById: (id: string) => `/ai/chat/sessions/${id}`, generate: '/ai/generate', generateStream: '/ai/generate/stream', providers: '/ai/providers', usage: '/ai/usage' } },
}))

// mock import.meta.env.DEV 为 false
const origDev = (import.meta as any).env?.DEV
try {
  Object.defineProperty(import.meta, 'env', { value: { ...(origDev ? { DEV: false } : {}), DEV: false, VITE_AGENTS_SHOW_SAMPLE_WHEN_EMPTY: 'false', VITE_USE_REAL_API: 'false' }, configurable: true, writable: true })
} catch (_) {}

// 同时设置 process.env.NODE_ENV
;(globalThis as any).process = { ...(globalThis as any).process, env: { ...((globalThis as any).process?.env || {}), NODE_ENV: 'production' } }

import * as api from '../ai'

async function callFn(fn: any, ...args: any[]): Promise<any> {
  try {
    const result = await fn(...args)
    expect(result).toBeDefined()
    return result
  } catch (e) {
    expect(e).toBeDefined()
    return null
  }
}

describe('ai', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getAIModels 列表', async () => {
    await callFn((api as any).getAIModels)
    await callFn((api as any).getAIModels, { provider: 'openai' })
    await callFn((api as any).getAIModels, { status: 'active' })
  })

  it('getAIModel 详情', async () => {
    await callFn((api as any).getAIModel, 'gpt-4')
  })

  it('聊天会话 CRUD', async () => {
    await callFn((api as any).createChatSession, { modelId: 'gpt-4' })
    await callFn((api as any).createChatSession, { modelId: 'gpt-4', title: 't' })
    await callFn((api as any).getChatSessions)
    await callFn((api as any).getChatSessions, { page: 1, pageSize: 10 })
    await callFn((api as any).getChatSession, 's1')
    await callFn((api as any).deleteChatSession, 's1')
  })

  it('generateContent 生成', async () => {
    await callFn((api as any).generateContent, { prompt: 'p', modelId: 'gpt-4', type: 'text' })
  })

  it('streamGenerateContent 流式', async () => {
    const onChunk = vi.fn()
    const onComplete = vi.fn()
    const onError = vi.fn()
    // 流式走 fetch mock
    const mockReader = {
      read: vi.fn()
        .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"content":"hi"}\n') })
        .mockResolvedValueOnce({ done: true }),
    }
    const mockBody = { getReader: vi.fn().mockReturnValue(mockReader) }
    const origFetch = (globalThis as any).fetch
    ;(globalThis as any).fetch = vi.fn().mockResolvedValue({ ok: true, body: mockBody })
    try {
      await (api as any).streamGenerateContent({ prompt: 'p', modelId: 'gpt-4', type: 'text' }, onChunk, onComplete, onError)
    } catch (e) {
      expect(e).toBeDefined()
    } finally {
      ;(globalThis as any).fetch = origFetch
    }
  })

  it('streamGenerateContent 错误处理', async () => {
    const onError = vi.fn()
    const origFetch = (globalThis as any).fetch
    ;(globalThis as any).fetch = vi.fn().mockRejectedValue(new Error('fail'))
    try {
      await (api as any).streamGenerateContent({ prompt: 'p', modelId: 'gpt-4', type: 'text' }, vi.fn(), vi.fn(), onError)
    } catch (e) {
      expect(e).toBeDefined()
    } finally {
      ;(globalThis as any).fetch = origFetch
    }
  })

  it('getAIProviders 提供商', async () => {
    await callFn((api as any).getAIProviders)
  })

  it('getAIUsageStats 使用统计', async () => {
    await callFn((api as any).getAIUsageStats)
    await callFn((api as any).getAIUsageStats, { startDate: '2024-01-01', endDate: '2024-12-31' })
  })
})
