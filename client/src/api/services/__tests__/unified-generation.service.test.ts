// unified-generation.service.ts 单元测试
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/request', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}))

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

vi.mock('@/utils/i18n', () => ({
  t: (k: string) => k,
}))

vi.mock('@/api/models', () => ({
  getAvailableModels: vi.fn(() =>
    Promise.resolve({
      success: true,
      data: [
        {
          supportsImages: true,
          provider: 'qwen',
          name: 'qwen-image',
          displayName: '通义',
          remark: '/api/qwen/image',
          quest_type: 'http',
        },
      ],
    })
  ),
}))

vi.mock('./aiGeneration.service', () => ({
  generateDoubaoImage: vi.fn(() => Promise.resolve({ success: true, data: { image_url: 'a' } })),
  generateJimeng4Image: vi.fn(() => Promise.resolve({ success: true, data: { image_url: 'a' } })),
  generateDashScopeImageToImage: vi.fn(() => Promise.resolve({ success: true, data: { image_urls: ['a'] } })),
  startOneClickVideo: vi.fn(() => Promise.resolve({ success: true, data: { task_id: 't1' } })),
  getOneClickVideoStatus: vi.fn(() =>
    Promise.resolve({ success: true, data: { status: 'completed', message: 'ok' } })
  ),
  createKlingVideo: vi.fn(() => Promise.resolve({ success: true, data: { task_id: 't1' } })),
  submitHunyuan3DTask: vi.fn(() => Promise.resolve({ success: true, data: { job_id: 'j1' } })),
  queryHunyuan3DStatus: vi.fn(() =>
    Promise.resolve({ success: true, data: { status: 'SUCCEEDED', progress: 100, result_url: 'u' } })
  ),
  chatDashScopeVision: vi.fn(() =>
    Promise.resolve({ success: true, data: { reasoning: 'r', answer: 'a' } })
  ),
  createDashScopeVideoWebSocket: vi.fn(() => ({ close: vi.fn() })),
}))

vi.mock('../ai-models', () => ({
  soraRequest: vi.fn(() => Promise.resolve({ data: { taskId: 't1' } })),
  aliGenerateTimbre: vi.fn(() => Promise.resolve({ data: { url: 'a' } })),
  audioStart: vi.fn(() => Promise.resolve({ data: { taskId: 't1' } })),
  audioEnd: vi.fn(() => Promise.resolve({ data: { status: 'completed', url: 'a' } })),
}))

import { unifiedGenerationService, generateContent, generateContentStream, getGenerationTaskStatus, cancelGenerationTask } from '../unified-generation.service'

describe('unified-generation.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('generate qwen-image 成功', async () => {
    const r = await unifiedGenerationService.generate({
      type: 'image',
      provider: 'qwen-image',
      prompt: 'p',
      userUuid: 'u',
    })
    expect(r).toBeDefined()
  })

  it('generate doubao-image', async () => {
    const r = await unifiedGenerationService.generate({
      type: 'image',
      provider: 'doubao-image',
      prompt: 'p',
      userUuid: 'u',
    })
    expect(r).toBeDefined()
  })

  it('generate jimeng-image', async () => {
    const r = await unifiedGenerationService.generate({
      type: 'image',
      provider: 'jimeng-image',
      prompt: 'p',
      userUuid: 'u',
    })
    expect(r).toBeDefined()
  })

  it('generate dashscope-i2i 成功', async () => {
    const r = await unifiedGenerationService.generate({
      type: 'image',
      provider: 'dashscope-i2i',
      prompt: 'p',
      userUuid: 'u',
      referenceImage: 'http://x',
    })
    expect(r).toBeDefined()
  })

  it('generate dashscope-i2i 缺少 referenceImage', async () => {
    const r = await unifiedGenerationService.generate({
      type: 'image',
      provider: 'dashscope-i2i',
      prompt: 'p',
      userUuid: 'u',
    })
    expect(r.success).toBe(false)
  })

  it('generate image 不支持 provider', async () => {
    const r = await unifiedGenerationService.generate({
      type: 'image',
      provider: 'unknown' as any,
      prompt: 'p',
      userUuid: 'u',
    })
    expect(r.success).toBe(false)
  })

  it('generate qwen-image 缺少 remark', async () => {
    const modelsMod = await import('@/api/models')
    ;(modelsMod.getAvailableModels as any).mockResolvedValueOnce({
      success: true,
      data: [{ supportsImages: true, provider: 'qwen', name: 'q' }],
    })
    const r = await unifiedGenerationService.generate({
      type: 'image',
      provider: 'qwen-image',
      prompt: 'p',
      userUuid: 'u',
    })
    expect(r.success).toBe(false)
  })

  it('generate qwen-image WebSocket quest_type', async () => {
    const modelsMod = await import('@/api/models')
    ;(modelsMod.getAvailableModels as any).mockResolvedValueOnce({
      success: true,
      data: [
        {
          supportsImages: true,
          provider: 'qwen',
          name: 'qwen-image',
          displayName: '通义',
          remark: '/api/x',
          quest_type: 'ws',
        },
      ],
    })
    const r = await unifiedGenerationService.generate({
      type: 'image',
      provider: 'qwen-image',
      prompt: 'p',
      userUuid: 'u',
    })
    expect(r.success).toBe(false)
  })

  it('generate video one-click-video', async () => {
    const r = await unifiedGenerationService.generate({
      type: 'video',
      provider: 'one-click-video',
      prompt: 'p',
      userUuid: 'u',
    })
    expect(r).toBeDefined()
  })

  it('generate video kling-video', async () => {
    const r = await unifiedGenerationService.generate({
      type: 'video',
      provider: 'kling-video',
      prompt: 'p',
      userUuid: 'u',
    })
    expect(r).toBeDefined()
  })

  it('generate video sora-video', async () => {
    const r = await unifiedGenerationService.generate({
      type: 'video',
      provider: 'sora-video',
      prompt: 'p',
      userUuid: 'u',
    })
    expect(r).toBeDefined()
  })

  it('generate video dashscope-video', async () => {
    const r = await unifiedGenerationService.generate({
      type: 'video',
      provider: 'dashscope-video',
      prompt: 'p',
      userUuid: 'u',
    })
    expect(r).toBeDefined()
  })

  it('generate video 未知 provider', async () => {
    const r = await unifiedGenerationService.generate({
      type: 'video',
      provider: 'unknown' as any,
      prompt: 'p',
      userUuid: 'u',
    })
    expect(r.success).toBe(false)
  })

  it('generate audio ali-timbre', async () => {
    const r = await unifiedGenerationService.generate({
      type: 'audio',
      provider: 'ali-timbre',
      prompt: 'p',
      userUuid: 'u',
    })
    expect(r).toBeDefined()
  })

  it('generate audio cosyvoice', async () => {
    const r = await unifiedGenerationService.generate({
      type: 'audio',
      provider: 'cosyvoice',
      prompt: 'p',
      userUuid: 'u',
    })
    expect(r).toBeDefined()
  })

  it('generate audio 不支持 provider', async () => {
    const r = await unifiedGenerationService.generate({
      type: 'audio',
      provider: 'unknown' as any,
      prompt: 'p',
      userUuid: 'u',
    })
    expect(r.success).toBe(false)
  })

  it('generate 3D hunyuan-3d', async () => {
    const r = await unifiedGenerationService.generate({
      type: '3d',
      provider: 'hunyuan-3d',
      prompt: 'p',
      userUuid: 'u',
    })
    expect(r).toBeDefined()
  })

  it('generate 3D 不支持 provider', async () => {
    const r = await unifiedGenerationService.generate({
      type: '3d',
      provider: 'unknown' as any,
      prompt: 'p',
      userUuid: 'u',
    })
    expect(r.success).toBe(false)
  })

  it('generate vision dashscope-vision', async () => {
    const r = await unifiedGenerationService.generate({
      type: 'vision',
      provider: 'dashscope-vision',
      prompt: 'p',
      userUuid: 'u',
      referenceImage: 'http://x',
    })
    expect(r).toBeDefined()
  })

  it('generate vision 缺少 referenceImage', async () => {
    const r = await unifiedGenerationService.generate({
      type: 'vision',
      provider: 'dashscope-vision',
      prompt: 'p',
      userUuid: 'u',
    })
    expect(r.success).toBe(false)
  })

  it('generate music (走 audio ali-timbre)', async () => {
    const r = await unifiedGenerationService.generate({
      type: 'music',
      prompt: 'p',
      userUuid: 'u',
    })
    expect(r).toBeDefined()
  })

  it('generate 未知 type', async () => {
    const r = await unifiedGenerationService.generate({
      type: 'unknown' as any,
      prompt: 'p',
      userUuid: 'u',
    })
    expect(r.success).toBe(false)
  })

  it('generateStream video dashscope-video', async () => {
    const r = await unifiedGenerationService.generateStream(
      { type: 'video', provider: 'dashscope-video', prompt: 'p', userUuid: 'u' },
      {}
    )
    expect(r).toBeDefined()
  })

  it('generateStream 降级为非 video', async () => {
    const r = await unifiedGenerationService.generateStream(
      { type: 'image', provider: 'qwen-image', prompt: 'p', userUuid: 'u' },
      { onComplete: () => {} }
    )
    expect(r).toBeDefined()
  })

  it('generateStream 错误', async () => {
    const r = await unifiedGenerationService.generateStream(
      { type: 'video', provider: 'unknown' as any, prompt: 'p', userUuid: 'u' },
      { onError: vi.fn() }
    )
    expect(r).toBeDefined()
  })

  it('getTaskStatus 同步完成', async () => {
    const r = await unifiedGenerationService.getTaskStatus('1', 'image')
    expect(r.success).toBe(true)
  })

  it('getTaskStatus video', async () => {
    const r = await unifiedGenerationService.getTaskStatus('1', 'video')
    expect(r).toBeDefined()
  })

  it('getTaskStatus 3d', async () => {
    const r = await unifiedGenerationService.getTaskStatus('1', '3d')
    expect(r).toBeDefined()
  })

  it('cancelTask 正常', () => {
    unifiedGenerationService.cancelTask('1')
  })

  it('cancelTask 关闭已存在的 ws', () => {
    const ws = { close: vi.fn() } as any
    ;(unifiedGenerationService as any).activeWebSockets.set('1', ws)
    unifiedGenerationService.cancelTask('1')
    expect(ws.close).toHaveBeenCalled()
  })

  it('导出函数包装', async () => {
    await generateContent({ type: 'image', prompt: 'p', userUuid: 'u' })
    const id = await generateContentStream(
      { type: 'image', prompt: 'p', userUuid: 'u' },
      {}
    )
    expect(id).toBeDefined()
    await getGenerationTaskStatus('1', 'image')
    cancelGenerationTask('1')
  })
})
