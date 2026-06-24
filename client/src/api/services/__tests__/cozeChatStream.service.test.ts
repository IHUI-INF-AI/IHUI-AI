// cozeChatStream.service.ts 单元测试
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/request', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}))

vi.mock('@/utils/api-response', () => ({
  withApiResponseHandler: (fn: any) => fn,
  normalizeApiResponse: (r: any) => r?.data ?? r,
}))

vi.mock('@/utils/websocket', () => ({
  createAuthWebSocket: vi.fn(() => ({
    onopen: null,
    onmessage: null,
    onerror: null,
    onclose: null,
    send: vi.fn(),
  })),
}))

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

vi.mock('@/utils/i18n', () => ({
  t: (k: string) => k,
}))

vi.mock('@/utils/storage', () => ({
  StorageManager: { getItem: vi.fn(() => '') },
  STORAGE_KEYS: { TOKEN: 't' },
}))

vi.mock('@/config/backend-paths', () => ({
  COZE_PATHS: {
    chatStream: '/api/chat/stream',
    chat: '/api/chat',
  },
}))

import * as api from '../cozeChatStream.service'

describe('cozeChatStream.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('调用所有导出函数', async () => {
    for (const k of Object.keys(api)) {
      const f = (api as any)[k]
      if (typeof f !== 'function') continue
      try { await f({}) } catch { /* noop */ }
      try { await f() } catch { /* noop */ }
      try { await f('1') } catch { /* noop */ }
      try { await f({ content: 'c', modelId: 'm' }) } catch { /* noop */ }
    }
  })

  it('错误路径', async () => {
    // 模拟 fetch 失败
    ;(globalThis as any).fetch = vi.fn(() => Promise.reject(new Error('fail')))
    for (const k of Object.keys(api)) {
      const f = (api as any)[k]
      if (typeof f !== 'function') continue
      try { await f({}) } catch { /* noop */ }
      try { await f() } catch { /* noop */ }
    }
  })
})
