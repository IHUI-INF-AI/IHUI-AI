import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('vue', () => ({
  ref: vi.fn((value: any) => ({ value })),
  onUnmounted: vi.fn(),
}))

describe('useClipboard', () => {
  let mockNavigator: { clipboard?: { writeText: ReturnType<typeof vi.fn>; readText: ReturnType<typeof vi.fn>; read?: ReturnType<typeof vi.fn> } }

  beforeEach(() => {
    vi.useFakeTimers()
    mockNavigator = {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
        readText: vi.fn().mockResolvedValue('test text'),
        read: vi.fn().mockResolvedValue([
          {
            types: ['text/plain'],
            getData: vi.fn().mockReturnValue('item data'),
          },
        ]),
      },
    }
    vi.stubGlobal('navigator', mockNavigator)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  describe('useClipboard', () => {
    it('应该返回剪贴板状态和方法', async () => {
      const { useClipboard } = await import('../useClipboard')
      const clipboard = useClipboard()
      
      expect(clipboard.text).toBeDefined()
      expect(clipboard.copied).toBeDefined()
      expect(clipboard.isSupported).toBe(true)
      expect(typeof clipboard.copy).toBe('function')
      expect(typeof clipboard.read).toBe('function')
    })

    it('应该复制文本', async () => {
      const { useClipboard } = await import('../useClipboard')
      const clipboard = useClipboard()
      
      await clipboard.copy('test text')
      
      expect(mockNavigator.clipboard!.writeText).toHaveBeenCalledWith('test text')
      expect(clipboard.text.value).toBe('test text')
      expect(clipboard.copied.value).toBe(true)
    })

    it('应该使用source作为默认值', async () => {
      const { useClipboard } = await import('../useClipboard')
      const clipboard = useClipboard({ source: 'default text' })
      
      expect(clipboard.text.value).toBe('default text')
    })

    it('应该复制ref中的文本', async () => {
      const { useClipboard } = await import('../useClipboard')
      const clipboard = useClipboard({ source: 'initial' })
      
      await clipboard.copy()
      
      expect(mockNavigator.clipboard!.writeText).toHaveBeenCalledWith('initial')
    })

    it('应该读取剪贴板文本', async () => {
      const { useClipboard } = await import('../useClipboard')
      const clipboard = useClipboard({ read: true })
      
      const result = await clipboard.read()
      
      expect(result).toBe('test text')
      expect(clipboard.text.value).toBe('test text')
    })

    it('read应该返回当前文本当不支持时', async () => {
      vi.stubGlobal('navigator', {})
      
      const { useClipboard } = await import('../useClipboard')
      const clipboard = useClipboard({ source: 'current', read: true })
      
      const result = await clipboard.read()
      
      expect(result).toBe('current')
    })

    it('read应该返回当前文本当未启用read时', async () => {
      const { useClipboard } = await import('../useClipboard')
      const clipboard = useClipboard({ source: 'current', read: false })
      
      const result = await clipboard.read()
      
      expect(result).toBe('current')
    })

    it('copied应该在1.5秒后重置', async () => {
      const { useClipboard } = await import('../useClipboard')
      const clipboard = useClipboard()
      
      await clipboard.copy('test')
      expect(clipboard.copied.value).toBe(true)
      
      vi.advanceTimersByTime(1500)
      expect(clipboard.copied.value).toBe(false)
    })

    it('应该处理复制失败', async () => {
      mockNavigator.clipboard!.writeText.mockRejectedValueOnce(new Error('fail'))
      
      const { useClipboard } = await import('../useClipboard')
      const clipboard = useClipboard()
      
      await clipboard.copy('test')
      
      expect(clipboard.text.value).toBe('test')
      expect(clipboard.copied.value).toBe(true)
    })

    it('应该处理读取失败', async () => {
      mockNavigator.clipboard!.readText.mockRejectedValueOnce(new Error('fail'))
      
      const { useClipboard } = await import('../useClipboard')
      const clipboard = useClipboard({ source: 'fallback', read: true })
      
      const result = await clipboard.read()
      
      expect(result).toBe('fallback')
    })

    it('isSupported应该为false当navigator不存在时', async () => {
      vi.stubGlobal('navigator', undefined)
      
      const { useClipboard } = await import('../useClipboard')
      const clipboard = useClipboard()
      
      expect(clipboard.isSupported).toBe(false)
    })

    it('isSupported应该为false当clipboard不存在时', async () => {
      vi.stubGlobal('navigator', {})
      
      const { useClipboard } = await import('../useClipboard')
      const clipboard = useClipboard()
      
      expect(clipboard.isSupported).toBe(false)
    })

    it('不支持clipboard时应该也能复制', async () => {
      vi.stubGlobal('navigator', {})
      
      const { useClipboard } = await import('../useClipboard')
      const clipboard = useClipboard()
      
      await clipboard.copy('test')
      
      expect(clipboard.text.value).toBe('test')
      expect(clipboard.copied.value).toBe(true)
    })
  })

  describe('useClipboardItems', () => {
    it('应该返回剪贴板项状态和方法', async () => {
      const { useClipboardItems } = await import('../useClipboard')
      const clipboardItems = useClipboardItems()
      
      expect(clipboardItems.items).toBeDefined()
      expect(clipboardItems.isSupported).toBe(true)
      expect(typeof clipboardItems.read).toBe('function')
    })

    it('应该读取剪贴板项', async () => {
      const { useClipboardItems } = await import('../useClipboard')
      const clipboardItems = useClipboardItems()
      
      const result = await clipboardItems.read()
      
      expect(result.length).toBe(1)
      expect(clipboardItems.items.value.length).toBe(1)
    })

    it('isSupported应该为false当read不存在时', async () => {
      vi.stubGlobal('navigator', {
        clipboard: {
          writeText: vi.fn(),
          readText: vi.fn(),
        },
      })
      
      const { useClipboardItems } = await import('../useClipboard')
      const clipboardItems = useClipboardItems()
      
      expect(clipboardItems.isSupported).toBe(false)
    })

    it('read应该抛出错误当不支持时', async () => {
      vi.stubGlobal('navigator', {})
      
      const { useClipboardItems } = await import('../useClipboard')
      const clipboardItems = useClipboardItems()
      
      await expect(clipboardItems.read()).rejects.toThrow('Clipboard API is not supported')
    })

    it('read应该抛出错误当读取失败时', async () => {
      mockNavigator.clipboard!.read!.mockRejectedValueOnce(new Error('read fail'))
      
      const { useClipboardItems } = await import('../useClipboard')
      const clipboardItems = useClipboardItems()
      
      await expect(clipboardItems.read()).rejects.toThrow('Failed to read clipboard items')
    })
  })
})
