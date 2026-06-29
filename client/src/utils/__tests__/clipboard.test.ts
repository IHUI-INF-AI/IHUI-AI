import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

let currentPlatform = 'web'

vi.mock('@/utils/i18n', () => ({
  t: vi.fn((key: string) => key),
}))

vi.mock('@/router/utils/routeMerger', () => ({
  getCurrentPlatform: vi.fn(() => currentPlatform),
  PlatformType: {},
}))

vi.mock('@/utils/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}))

describe('clipboard', () => {
  let mockNavigator: { clipboard?: { writeText: vi.Mock; readText: vi.Mock } }
  let mockDocument: { createElement: vi.Mock; body: { appendChild: vi.Mock; removeChild: vi.Mock }; execCommand: vi.Mock }

  beforeEach(() => {
    vi.clearAllMocks()
    currentPlatform = 'web'

    mockNavigator = {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
        readText: vi.fn().mockResolvedValue('test text'),
      },
    }

    mockDocument = {
      createElement: vi.fn(() => ({
        value: '',
        style: { position: '', opacity: '', left: '', top: '' },
        select: vi.fn(),
      })),
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
      },
      execCommand: vi.fn(() => true),
    }

    vi.stubGlobal('navigator', mockNavigator)
    vi.stubGlobal('document', mockDocument)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  describe('模块导入', () => {
    it('应该成功导入模块', async () => {
      const mod = await import('../clipboard')
      expect(mod).toBeDefined()
      expect(mod.ClipboardManager).toBeDefined()
      expect(mod.copyToClipboard).toBeDefined()
      expect(mod.pasteFromClipboard).toBeDefined()
    })
  })

  describe('ClipboardManager.copy', () => {
    it('应该成功复制文本到剪贴板', async () => {
      const { ClipboardManager } = await import('../clipboard')
      const result = await ClipboardManager.copy('test text')
      expect(result.success).toBe(true)
      expect(result.platform).toBe('web')
    })

    it('应该使用现代Clipboard API', async () => {
      const { ClipboardManager } = await import('../clipboard')
      await ClipboardManager.copy('test text')
      expect(mockNavigator.clipboard?.writeText).toHaveBeenCalledWith('test text')
    })

    it('应该在Clipboard API失败时降级到传统方法', async () => {
      mockNavigator.clipboard!.writeText = vi.fn().mockRejectedValue(new Error('Clipboard API failed'))
      vi.stubGlobal('navigator', mockNavigator)

      const { ClipboardManager } = await import('../clipboard')
      const result = await ClipboardManager.copy('test text')
      expect(result.success).toBe(true)
    })

    it('应该返回失败结果当没有clipboard API时', async () => {
      vi.stubGlobal('navigator', {})

      const { ClipboardManager } = await import('../clipboard')
      const result = await ClipboardManager.copy('test text')
      expect(result.success).toBe(true)
    })
  })

  describe('ClipboardManager.paste', () => {
    it('应该成功从剪贴板读取文本', async () => {
      const { ClipboardManager } = await import('../clipboard')
      const result = await ClipboardManager.paste()
      expect(result.success).toBe(true)
      expect(result.text).toBe('test text')
    })

    it('应该返回失败结果当读取失败时', async () => {
      mockNavigator.clipboard!.readText = vi.fn().mockRejectedValue(new Error('Read failed'))
      vi.stubGlobal('navigator', mockNavigator)

      const { ClipboardManager } = await import('../clipboard')
      const result = await ClipboardManager.paste()
      expect(result.success).toBe(false)
      expect(result.text).toBeNull()
    })

    it('应该返回失败结果当没有clipboard API时', async () => {
      vi.stubGlobal('navigator', {})

      const { ClipboardManager } = await import('../clipboard')
      const result = await ClipboardManager.paste()
      expect(result.success).toBe(false)
      expect(result.text).toBeNull()
    })
  })



  describe('支付宝平台', () => {
    it('应该在支付宝平台使用支付宝API复制', async () => {
      currentPlatform = 'alipay'
      const mockMy = {
        setClipboard: vi.fn((opts: { text: string; success: () => void; fail: () => void }) => {
          opts.success()
        }),
      }
      vi.stubGlobal('window', { my: mockMy })

      const { ClipboardManager } = await import('../clipboard')
      const result = await ClipboardManager.copy('test text')
      expect(result.success).toBe(true)
      expect(result.platform).toBe('alipay')
    })

    it('应该在支付宝平台使用支付宝API读取', async () => {
      currentPlatform = 'alipay'
      const mockMy = {
        getClipboard: vi.fn((opts: { success: (res: { text: string }) => void; fail: () => void }) => {
          opts.success({ text: 'clipboard text' })
        }),
      }
      vi.stubGlobal('window', { my: mockMy })

      const { ClipboardManager } = await import('../clipboard')
      const result = await ClipboardManager.paste()
      expect(result.success).toBe(true)
      expect(result.text).toBe('clipboard text')
    })

    it('应该返回失败当支付宝SDK未初始化时', async () => {
      currentPlatform = 'alipay'
      vi.stubGlobal('window', {})

      const { ClipboardManager } = await import('../clipboard')
      const result = await ClipboardManager.copy('test text')
      expect(result.success).toBe(false)
    })
  })

  describe('不支持的平台', () => {
    it('应该返回失败结果', async () => {
      currentPlatform = 'unknown' as unknown as string

      const { ClipboardManager } = await import('../clipboard')
      const result = await ClipboardManager.copy('test text')
      expect(result.success).toBe(false)
    })
  })
})
