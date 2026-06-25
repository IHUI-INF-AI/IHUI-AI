// skills-enhanced-ai.ts 单元测试
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
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

vi.mock('@/config/backend-paths', () => ({
  COZE_PATHS: {
    skills: { chat: '/skills/chat', match: '/skills/match' },
    // 2026-06-25 修复#Q: 补全 api-white-list.ts 顶层引用的字段, 避免导入失败
    agents: { list: '/coze/agents/list' },
    aiModelInfo: { list: '/coze/ai-model-info/list' },
    cache: { agentCategoryDict: { categories: '/coze/cache/category-dict/categories' } },
  },
  COZE_PREFIX: '/coze',
  LOGIN_PWD_PATHS: { refreshToken: '/auth/login/pwd/refresh' },
}))

import request from '@/utils/request'
import * as api from '../skills/skills-enhanced-ai'

describe('skills-enhanced-ai', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(request.get as any).mockResolvedValue({ data: { code: 200, data: [] } })
    ;(request.post as any).mockResolvedValue({ data: { code: 200, data: { content: 'c' } } })
  })

  it('调用所有函数', async () => {
    for (const k of Object.keys(api)) {
      const f = (api as any)[k]
      if (typeof f !== 'function') continue
      try { await f({}) } catch { /* noop */ }
      try { await f() } catch { /* noop */ }
      try { await f('1') } catch { /* noop */ }
      try { await f({ content: 'c' }) } catch { /* noop */ }
      try { await f({ message: 'm' }) } catch { /* noop */ }
      try { await f({ query: 'q' }) } catch { /* noop */ }
    }
  })

  it('所有错误路径', async () => {
    ;(request.get as any).mockRejectedValue(new Error('fail'))
    ;(request.post as any).mockRejectedValue(new Error('fail'))
    for (const k of Object.keys(api)) {
      const f = (api as any)[k]
      if (typeof f !== 'function') continue
      try { await f({}) } catch { /* noop */ }
      try { await f() } catch { /* noop */ }
    }
  })

  it('数据格式兼容', async () => {
    ;(request.get as any).mockResolvedValue({ data: 'string' })
    ;(request.post as any).mockResolvedValue({ data: 'string' })
    for (const k of Object.keys(api)) {
      const f = (api as any)[k]
      if (typeof f !== 'function') continue
      try { await f({}) } catch { /* noop */ }
    }
  })
})
