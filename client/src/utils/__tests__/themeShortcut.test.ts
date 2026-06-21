import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockSetThemeMode = vi.fn()
let currentThemeMode = 'light'

vi.mock('@/stores/darkMode', () => ({
  useDarkModeStore: () => ({
    get themeMode() { return currentThemeMode },
    setThemeMode: mockSetThemeMode
  })
}))

vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }
}))

describe('themeShortcut', () => {
  let keydownHandler: ((event: KeyboardEvent) => void) | null = null
  let originalAddEventListener: typeof window.addEventListener
  let cleanup: (() => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    currentThemeMode = 'light'
    keydownHandler = null
    cleanup = null

    originalAddEventListener = window.addEventListener
    window.addEventListener = vi.fn((type: string, handler: EventListener) => {
      if (type === 'keydown') {
        keydownHandler = handler as (event: KeyboardEvent) => void
      }
      return originalAddEventListener.call(window, type, handler)
    }) as typeof window.addEventListener

    window.removeEventListener = vi.fn() as typeof window.removeEventListener
    document.body.innerHTML = ''
    document.head.innerHTML = ''
  })

  afterEach(() => {
    window.addEventListener = originalAddEventListener
    if (cleanup) {
      cleanup()
      cleanup = null
    }
    keydownHandler = null
  })

  describe('initThemeShortcut', () => {
    it('应该注册keydown事件监听器', async () => {
      const { initThemeShortcut } = await import('../themeShortcut')
      cleanup = initThemeShortcut()
      expect(window.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function))
    })

    it('应该返回清理函数', async () => {
      const { initThemeShortcut } = await import('../themeShortcut')
      cleanup = initThemeShortcut()
      expect(typeof cleanup).toBe('function')
    })
  })

  describe('handleThemeShortcut', () => {
    beforeEach(async () => {
      vi.resetModules()
      const { initThemeShortcut } = await import('../themeShortcut')
      cleanup = initThemeShortcut()
    })

    it('应该在 Ctrl+Shift+T 时触发主题切换', () => {
      const event = {
        key: 't',
        ctrlKey: true,
        shiftKey: true,
        metaKey: false,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      }

      keydownHandler?.(event as unknown as KeyboardEvent)
      expect(mockSetThemeMode).toHaveBeenCalled()
    })

    it('应该忽略不带修饰键的 T 键', () => {
      mockSetThemeMode.mockClear()
      const event = {
        key: 't',
        ctrlKey: false,
        shiftKey: false,
        metaKey: false,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      }

      keydownHandler?.(event as unknown as KeyboardEvent)
      expect(mockSetThemeMode).not.toHaveBeenCalled()
    })

    it('应该忽略只有 Ctrl 的 T 键', () => {
      mockSetThemeMode.mockClear()
      const event = {
        key: 't',
        ctrlKey: true,
        shiftKey: false,
        metaKey: false,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      }

      keydownHandler?.(event as unknown as KeyboardEvent)
      expect(mockSetThemeMode).not.toHaveBeenCalled()
    })

    it('应该忽略只有 Shift 的 T 键', () => {
      mockSetThemeMode.mockClear()
      const event = {
        key: 't',
        ctrlKey: false,
        shiftKey: true,
        metaKey: false,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      }

      keydownHandler?.(event as unknown as KeyboardEvent)
      expect(mockSetThemeMode).not.toHaveBeenCalled()
    })

    it('应该支持 metaKey 替代 ctrlKey', () => {
      mockSetThemeMode.mockClear()
      const event = {
        key: 't',
        ctrlKey: false,
        shiftKey: true,
        metaKey: true,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      }

      keydownHandler?.(event as unknown as KeyboardEvent)
      expect(mockSetThemeMode).toHaveBeenCalled()
    })

    it('应该忽略非 T 键', () => {
      mockSetThemeMode.mockClear()
      const event = {
        key: 'a',
        ctrlKey: true,
        shiftKey: true,
        metaKey: false,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      }

      keydownHandler?.(event as unknown as KeyboardEvent)
      expect(mockSetThemeMode).not.toHaveBeenCalled()
    })

    it('应该忽略大写 T 键', () => {
      mockSetThemeMode.mockClear()
      const event = {
        key: 'T',
        ctrlKey: true,
        shiftKey: true,
        metaKey: false,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      }

      keydownHandler?.(event as unknown as KeyboardEvent)
      expect(mockSetThemeMode).toHaveBeenCalled()
    })
  })

  describe('主题循环', () => {
    beforeEach(async () => {
      vi.resetModules()
      const { initThemeShortcut } = await import('../themeShortcut')
      cleanup = initThemeShortcut()
    })

    it('应该从 light 切换到 dark', () => {
      currentThemeMode = 'light'
      mockSetThemeMode.mockClear()
      
      const event = {
        key: 't',
        ctrlKey: true,
        shiftKey: true,
        metaKey: false,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      }

      keydownHandler?.(event as unknown as KeyboardEvent)
      expect(mockSetThemeMode).toHaveBeenCalledWith('dark', 'keyboard', true)
    })

    it('应该从 dark 切换到 auto', () => {
      currentThemeMode = 'dark'
      mockSetThemeMode.mockClear()
      
      const event = {
        key: 't',
        ctrlKey: true,
        shiftKey: true,
        metaKey: false,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      }

      keydownHandler?.(event as unknown as KeyboardEvent)
      expect(mockSetThemeMode).toHaveBeenCalledWith('auto', 'keyboard', true)
    })

    it('应该从 auto 切换到 high-contrast-light', () => {
      currentThemeMode = 'auto'
      mockSetThemeMode.mockClear()
      
      const event = {
        key: 't',
        ctrlKey: true,
        shiftKey: true,
        metaKey: false,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      }

      keydownHandler?.(event as unknown as KeyboardEvent)
      expect(mockSetThemeMode).toHaveBeenCalledWith('high-contrast-light', 'keyboard', true)
    })

    it('应该从 high-contrast-dark 循环回 light', () => {
      currentThemeMode = 'high-contrast-dark'
      mockSetThemeMode.mockClear()
      
      const event = {
        key: 't',
        ctrlKey: true,
        shiftKey: true,
        metaKey: false,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      }

      keydownHandler?.(event as unknown as KeyboardEvent)
      expect(mockSetThemeMode).toHaveBeenCalledWith('light', 'keyboard', true)
    })
  })
})
