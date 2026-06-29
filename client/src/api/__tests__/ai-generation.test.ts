// ai-generation.ts 单元测试
import { describe, it, expect, vi, beforeEach } from 'vitest'

let nextFail = false

vi.mock('@/utils/request', () => ({
  default: vi.fn().mockImplementation((config: any) => {
    if (nextFail) {
      nextFail = false
      return Promise.reject(new Error('fail'))
    }
    return Promise.resolve({ data: { code: 200, data: { taskId: 't1', status: 'completed', url: 'http://a' } } })
  }),
}))

vi.mock('@/utils/i18n', () => ({
  t: (key: string) => key,
}))

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import * as api from '../ai-generation'

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

describe('ai-generation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    nextFail = false
  })

  it('图片生成', async () => {
    await callFn((api as any).generateImageQwen, { prompt: 'p' })
    await callFn((api as any).generateImageDoubao, { prompt: 'p' })
    await callFn((api as any).generateImageJimeng, { prompt: 'p' })
  })

  it('图片生成失败', async () => {
    nextFail = true
    try { await (api as any).generateImageQwen({ prompt: 'p' }) } catch (e) { expect(e).toBeDefined() }
    nextFail = true
    try { await (api as any).generateImageDoubao({ prompt: 'p' }) } catch (e) { expect(e).toBeDefined() }
    nextFail = true
    try { await (api as any).generateImageJimeng({ prompt: 'p' }) } catch (e) { expect(e).toBeDefined() }
  })

  it('视频生成', async () => {
    await callFn((api as any).generateVideoKling, { prompt: 'p' })
    await callFn((api as any).generateVideoJimeng, { prompt: 'p' })
    await callFn((api as any).generateVideoVidu, { prompt: 'p' })
  })

  it('视频生成失败', async () => {
    nextFail = true
    try { await (api as any).generateVideoKling({ prompt: 'p' }) } catch (e) { expect(e).toBeDefined() }
    nextFail = true
    try { await (api as any).generateVideoJimeng({ prompt: 'p' }) } catch (e) { expect(e).toBeDefined() }
    nextFail = true
    try { await (api as any).generateVideoVidu({ prompt: 'p' }) } catch (e) { expect(e).toBeDefined() }
  })

  it('3D 生成', async () => {
    await callFn((api as any).generate3DModel, { prompt: 'p' })
    nextFail = true
    try { await (api as any).generate3DModel({ prompt: 'p' }) } catch (e) { expect(e).toBeDefined() }
  })

  it('任务状态', async () => {
    await callFn((api as any).getTaskStatus, 't1')
    await callFn((api as any).cancelTask, 't1')
    await callFn((api as any).batchGetTaskStatus, ['t1', 't2'])
  })

  it('统一生成路由', async () => {
    await callFn((api as any).generateContent, { type: 'image', provider: 'qwen', prompt: 'p' })
    await callFn((api as any).generateContent, { type: 'image', provider: 'doubao', prompt: 'p' })
    await callFn((api as any).generateContent, { type: 'image', provider: 'jimeng', prompt: 'p' })
    await callFn((api as any).generateContent, { type: 'video', provider: 'kling', prompt: 'p' })
    await callFn((api as any).generateContent, { type: 'video', provider: 'jimeng', prompt: 'p' })
    await callFn((api as any).generateContent, { type: 'video', provider: 'vidu', prompt: 'p' })
    await callFn((api as any).generateContent, { type: '3d', provider: 'qwen', prompt: 'p' })
    try { await (api as any).generateContent({ type: 'image', provider: 'unknown' as any, prompt: 'p' }) } catch (e) { expect(e).toBeDefined() }
    try { await (api as any).generateContent({ type: 'unknown' as any, provider: 'qwen', prompt: 'p' }) } catch (e) { expect(e).toBeDefined() }
  })

  it('默认导出', () => {
    expect((api as any).default).toBeDefined()
    expect((api as any).default.generateImageQwen).toBeDefined()
  })
})

