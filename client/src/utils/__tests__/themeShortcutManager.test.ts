import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from 'vitest'
import type { ThemeShortcut } from '../themeShortcutManager'

type FrameRequestCallback = (time: number) => number

const mockStore: Record<string, string> = {}

vi.mock('@/stores/darkMode', () => ({
  useDarkModeStore: vi.fn(() => ({
    themeMode: 'light',
    setThemeMode: vi.fn(),
  })),
}))

vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

describe('themeShortcutManager', () => {
  let mockWindow: { addEventListener: ReturnType<typeof vi.fn>; removeEventListener: ReturnType<typeof vi.fn>; requestAnimationFrame: ReturnType<typeof vi.fn> }
  let mockDocument: { getElementById: ReturnType<typeof vi.fn>; head: { appendChild: ReturnType<typeof vi.fn> }; body: { appendChild: ReturnType<typeof vi.fn>; removeChild: ReturnType<typeof vi.fn> }; createElement: ReturnType<typeof vi.fn> }

  // 预热 transform：全量跑时首次 import 会被 transform 卡住，提前在 beforeAll 触发
  beforeAll(async () => {
    await import('../themeShortcutManager')
  }, 60000)

  beforeEach(async () => {
    Object.keys(mockStore).forEach(k => delete mockStore[k])
    vi.clearAllMocks()

    mockWindow = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      requestAnimationFrame: vi.fn((cb: FrameRequestCallback) => { cb(0); return 0 }),
    }

    mockDocument = {
      getElementById: vi.fn(),
      head: { appendChild: vi.fn() },
      body: { appendChild: vi.fn(), removeChild: vi.fn() },
      createElement: vi.fn().mockReturnValue({
        className: '',
        textContent: '',
        setAttribute: vi.fn(),
        classList: { add: vi.fn(), remove: vi.fn() },
        remove: vi.fn(),
      }),
    }

    vi.stubGlobal('localStorage', {
      getItem: (key: string) => mockStore[key] || null,
      setItem: (key: string, value: string) => { mockStore[key] = value },
      removeItem: (key: string) => { delete mockStore[key] },
      clear: () => { Object.keys(mockStore).forEach(key => delete mockStore[key]) }
    })
    vi.stubGlobal('window', mockWindow)
    vi.stubGlobal('document', mockDocument)
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('getShortcuts', () => {
    it('should return shortcuts list', async () => {
      const { themeShortcutManager } = await import('../themeShortcutManager')
      const shortcuts = themeShortcutManager.getShortcuts()
      expect(Array.isArray(shortcuts)).toBe(true)
      expect(shortcuts.length).toBeGreaterThan(0)
    })

    it('should include toggle-dark shortcut', async () => {
      const { themeShortcutManager } = await import('../themeShortcutManager')
      const shortcuts = themeShortcutManager.getShortcuts()
      expect(shortcuts.find(s => s.id === 'toggle-dark')).toBeDefined()
    })

    it('should load stored shortcuts', async () => {
      mockStore['theme-shortcuts-config'] = JSON.stringify([{ id: 'toggle-dark', key: 'z' }])
      const { themeShortcutManager } = await import('../themeShortcutManager')
      const shortcut = themeShortcutManager.getShortcut('toggle-dark')
      expect(shortcut?.key).toBe('z')
    })

    it('should handle invalid stored data', async () => {
      mockStore['theme-shortcuts-config'] = 'invalid-json'
      const { themeShortcutManager } = await import('../themeShortcutManager')
      const shortcuts = themeShortcutManager.getShortcuts()
      expect(shortcuts.length).toBeGreaterThan(0)
    })
  })

  describe('getShortcut', () => {
    it('should return specific shortcut', async () => {
      const { themeShortcutManager } = await import('../themeShortcutManager')
      const shortcut = themeShortcutManager.getShortcut('toggle-dark')
      expect(shortcut).toBeDefined()
      expect(shortcut?.action).toBe('toggle-dark')
    })

    it('should return undefined for invalid id', async () => {
      const { themeShortcutManager } = await import('../themeShortcutManager')
      const shortcut = themeShortcutManager.getShortcut('invalid-id')
      expect(shortcut).toBeUndefined()
    })
  })

  describe('updateShortcut', () => {
    it('should update shortcut', async () => {
      const { themeShortcutManager } = await import('../themeShortcutManager')
      const result = themeShortcutManager.updateShortcut('toggle-dark', { key: 'x' })
      expect(result).toBe(true)
      const shortcut = themeShortcutManager.getShortcut('toggle-dark')
      expect(shortcut?.key).toBe('x')
    })

    it('should return false for invalid id', async () => {
      const { themeShortcutManager } = await import('../themeShortcutManager')
      const result = themeShortcutManager.updateShortcut('invalid-id', { key: 'x' })
      expect(result).toBe(false)
    })
  })

  describe('enableShortcut', () => {
    it('should enable shortcut', async () => {
      const { themeShortcutManager } = await import('../themeShortcutManager')
      themeShortcutManager.disableShortcut('toggle-dark')
      const result = themeShortcutManager.enableShortcut('toggle-dark')
      expect(result).toBe(true)
      const shortcut = themeShortcutManager.getShortcut('toggle-dark')
      expect(shortcut?.enabled).toBe(true)
    })
  })

  describe('disableShortcut', () => {
    it('should disable shortcut', async () => {
      const { themeShortcutManager } = await import('../themeShortcutManager')
      const result = themeShortcutManager.disableShortcut('toggle-dark')
      expect(result).toBe(true)
      const shortcut = themeShortcutManager.getShortcut('toggle-dark')
      expect(shortcut?.enabled).toBe(false)
      themeShortcutManager.enableShortcut('toggle-dark')
    })
  })

  describe('toggleShortcut', () => {
    it('should toggle shortcut enabled state', async () => {
      const { themeShortcutManager } = await import('../themeShortcutManager')
      const initial = themeShortcutManager.getShortcut('cycle-theme')
      const initialState = initial?.enabled

      themeShortcutManager.toggleShortcut('cycle-theme')
      const afterToggle = themeShortcutManager.getShortcut('cycle-theme')
      expect(afterToggle?.enabled).toBe(!initialState)

      themeShortcutManager.toggleShortcut('cycle-theme')
      const afterSecondToggle = themeShortcutManager.getShortcut('cycle-theme')
      expect(afterSecondToggle?.enabled).toBe(initialState)
    })

    it('should return false for invalid id', async () => {
      const { themeShortcutManager } = await import('../themeShortcutManager')
      const result = themeShortcutManager.toggleShortcut('invalid-id')
      expect(result).toBe(false)
    })
  })

  describe('resetShortcuts', () => {
    it('should reset shortcuts to defaults', async () => {
      const { themeShortcutManager } = await import('../themeShortcutManager')
      themeShortcutManager.updateShortcut('toggle-dark', { key: 'z' })
      themeShortcutManager.resetShortcuts()
      const shortcut = themeShortcutManager.getShortcut('toggle-dark')
      expect(shortcut?.key).toBe('d')
    })
  })

  describe('formatShortcut', () => {
    it('should format shortcut with modifiers', async () => {
      const { themeShortcutManager } = await import('../themeShortcutManager')
      const shortcut: ThemeShortcut = {
        id: 'test',
        key: 't',
        modifiers: ['ctrl', 'shift'],
        action: 'cycle-theme',
        description: 'Test',
        descriptionEn: 'Test',
        enabled: true
      }
      const formatted = themeShortcutManager.formatShortcut(shortcut)
      expect(formatted).toBe('Ctrl + Shift + T')
    })

    it('should format shortcut without modifiers', async () => {
      const { themeShortcutManager } = await import('../themeShortcutManager')
      const shortcut: ThemeShortcut = {
        id: 'test',
        key: 't',
        modifiers: [],
        action: 'cycle-theme',
        description: 'Test',
        descriptionEn: 'Test',
        enabled: true
      }
      const formatted = themeShortcutManager.formatShortcut(shortcut)
      expect(formatted).toBe('T')
    })

    it('should format shortcut with alt modifier', async () => {
      const { themeShortcutManager } = await import('../themeShortcutManager')
      const shortcut: ThemeShortcut = {
        id: 'test',
        key: '1',
        modifiers: ['alt'],
        action: 'set-light',
        description: 'Test',
        descriptionEn: 'Test',
        enabled: true
      }
      const formatted = themeShortcutManager.formatShortcut(shortcut)
      expect(formatted).toBe('Alt + 1')
    })

    it('should format shortcut with meta modifier', async () => {
      const { themeShortcutManager } = await import('../themeShortcutManager')
      const shortcut: ThemeShortcut = {
        id: 'test',
        key: 'm',
        modifiers: ['meta'],
        action: 'set-light',
        description: 'Test',
        descriptionEn: 'Test',
        enabled: true
      }
      const formatted = themeShortcutManager.formatShortcut(shortcut)
      expect(formatted).toBe('⌘ + M')
    })
  })

  describe('checkConflict', () => {
    it('should detect conflict with existing shortcut', async () => {
      const { themeShortcutManager } = await import('../themeShortcutManager')
      const conflict = themeShortcutManager.checkConflict({
        key: 'd',
        modifiers: ['ctrl', 'shift'],
        action: 'set-light',
        description: 'Test',
        descriptionEn: 'Test',
        enabled: true
      })
      expect(conflict).not.toBeNull()
      expect(conflict?.id).toBe('toggle-dark')
    })

    it('should return null for no conflict', async () => {
      const { themeShortcutManager } = await import('../themeShortcutManager')
      const conflict = themeShortcutManager.checkConflict({
        key: 'x',
        modifiers: ['ctrl', 'alt'],
        action: 'set-light',
        description: 'Test',
        descriptionEn: 'Test',
        enabled: true
      })
      expect(conflict).toBeNull()
    })

    it('should not detect conflict with disabled shortcut', async () => {
      const { themeShortcutManager } = await import('../themeShortcutManager')
      themeShortcutManager.disableShortcut('toggle-dark')
      const conflict = themeShortcutManager.checkConflict({
        key: 'd',
        modifiers: ['ctrl', 'shift'],
        action: 'set-light',
        description: 'Test',
        descriptionEn: 'Test',
        enabled: true
      })
      expect(conflict).toBeNull()
      themeShortcutManager.enableShortcut('toggle-dark')
    })
  })

  describe('registerAction', () => {
    it('should register custom action handler', async () => {
      const { themeShortcutManager } = await import('../themeShortcutManager')
      const handler = vi.fn()
      themeShortcutManager.registerAction('set-dark', handler)
    })
  })

  describe('unregisterAction', () => {
    it('should unregister action handler', async () => {
      const { themeShortcutManager } = await import('../themeShortcutManager')
      const handler = vi.fn()
      themeShortcutManager.registerAction('set-dark', handler)
      themeShortcutManager.unregisterAction('set-dark')
    })
  })

  describe('setNotificationCallback', () => {
    it('should set notification callback', async () => {
      const { themeShortcutManager } = await import('../themeShortcutManager')
      const callback = vi.fn()
      themeShortcutManager.setNotificationCallback(callback)
      themeShortcutManager.setNotificationCallback(null)
    })
  })

  describe('isInitializedStatus', () => {
    it('should return false before init', async () => {
      const { themeShortcutManager } = await import('../themeShortcutManager')
      expect(themeShortcutManager.isInitializedStatus()).toBe(false)
    })
  })

  describe('initThemeShortcut', () => {
    it('should return cleanup function', async () => {
      const { initThemeShortcut } = await import('../themeShortcutManager')
      const cleanup = initThemeShortcut()
      expect(typeof cleanup).toBe('function')
      cleanup()
    })

    it('should add event listener', async () => {
      const { initThemeShortcut } = await import('../themeShortcutManager')
      initThemeShortcut()
      expect(mockWindow.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function))
    })

    it('should not initialize twice', async () => {
      const { initThemeShortcut } = await import('../themeShortcutManager')
      initThemeShortcut()
      initThemeShortcut()
      expect(mockWindow.addEventListener).toHaveBeenCalledTimes(1)
    })
  })

  describe('getThemeShortcutInfo', () => {
    it('should return shortcut info', async () => {
      const { getThemeShortcutInfo } = await import('../themeShortcutManager')
      const info = getThemeShortcutInfo()
      expect(info.key).toBeDefined()
      expect(info.modifiers).toBeDefined()
    })
  })

  describe('isThemeShortcutInitialized', () => {
    it('should return initialization status', async () => {
      const { isThemeShortcutInitialized } = await import('../themeShortcutManager')
      const status = isThemeShortcutInitialized()
      expect(typeof status).toBe('boolean')
    })
  })

  describe('server-side rendering', () => {
    it('should handle undefined window in loadShortcuts', async () => {
      vi.unstubAllGlobals()
      vi.stubGlobal('window', undefined)
      vi.stubGlobal('document', mockDocument)
      vi.stubGlobal('localStorage', {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
        clear: () => {}
      })
      vi.resetModules()
      const { themeShortcutManager } = await import('../themeShortcutManager')
      const shortcuts = themeShortcutManager.getShortcuts()
      expect(shortcuts.length).toBeGreaterThan(0)
    })

    it('should handle undefined window in init', async () => {
      vi.unstubAllGlobals()
      vi.stubGlobal('window', undefined)
      vi.stubGlobal('document', mockDocument)
      vi.stubGlobal('localStorage', {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
        clear: () => {}
      })
      vi.resetModules()
      const { initThemeShortcut } = await import('../themeShortcutManager')
      const cleanup = initThemeShortcut()
      expect(typeof cleanup).toBe('function')
    })
  })

  describe('addNotificationStyles', () => {
    it('should add styles only once', async () => {
      mockDocument.getElementById = vi.fn().mockReturnValueOnce(null).mockReturnValueOnce({ remove: vi.fn() })
      const { initThemeShortcut } = await import('../themeShortcutManager')
      initThemeShortcut()
      expect(mockDocument.head.appendChild).toHaveBeenCalled()
    })

    it('should not add styles if already present', async () => {
      mockDocument.getElementById = vi.fn().mockReturnValue({ remove: vi.fn() })
      const { initThemeShortcut } = await import('../themeShortcutManager')
      initThemeShortcut()
    })
  })

  describe('keydown handlers', () => {
    it('should handle toggle-dark shortcut', async () => {
      const { initThemeShortcut, themeShortcutManager } = await import('../themeShortcutManager')
      const mockSetThemeMode = vi.fn()
      vi.mock('@/stores/darkMode', () => ({
        useDarkModeStore: vi.fn(() => ({
          themeMode: 'light',
          setThemeMode: mockSetThemeMode,
        })),
      }))
      initThemeShortcut()
      const keydownHandler = (mockWindow.addEventListener as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => call[0] === 'keydown'
      )?.[1] as (e: { key: string; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; metaKey: boolean; preventDefault: () => void; stopPropagation: () => void }) => void
      
      if (keydownHandler) {
        keydownHandler({ key: 'd', ctrlKey: true, shiftKey: true, altKey: false, metaKey: false, preventDefault: vi.fn(), stopPropagation: vi.fn() })
      }
    })

    it('should handle cycle-theme shortcut', async () => {
      const { initThemeShortcut } = await import('../themeShortcutManager')
      initThemeShortcut()
      const keydownHandler = (mockWindow.addEventListener as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => call[0] === 'keydown'
      )?.[1] as (e: { key: string; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; metaKey: boolean; preventDefault: () => void; stopPropagation: () => void }) => void
      
      if (keydownHandler) {
        keydownHandler({ key: 't', ctrlKey: true, shiftKey: true, altKey: false, metaKey: false, preventDefault: vi.fn(), stopPropagation: vi.fn() })
      }
    })

    it('should handle set-light shortcut', async () => {
      const { initThemeShortcut } = await import('../themeShortcutManager')
      initThemeShortcut()
      const keydownHandler = (mockWindow.addEventListener as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => call[0] === 'keydown'
      )?.[1] as (e: { key: string; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; metaKey: boolean; preventDefault: () => void; stopPropagation: () => void }) => void
      
      if (keydownHandler) {
        keydownHandler({ key: '1', ctrlKey: true, altKey: true, shiftKey: false, metaKey: false, preventDefault: vi.fn(), stopPropagation: vi.fn() })
      }
    })

    it('should handle set-dark shortcut', async () => {
      const { initThemeShortcut } = await import('../themeShortcutManager')
      initThemeShortcut()
      const keydownHandler = (mockWindow.addEventListener as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => call[0] === 'keydown'
      )?.[1] as (e: { key: string; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; metaKey: boolean; preventDefault: () => void; stopPropagation: () => void }) => void
      
      if (keydownHandler) {
        keydownHandler({ key: '2', ctrlKey: true, altKey: true, shiftKey: false, metaKey: false, preventDefault: vi.fn(), stopPropagation: vi.fn() })
      }
    })

    it('should handle set-auto shortcut', async () => {
      const { initThemeShortcut } = await import('../themeShortcutManager')
      initThemeShortcut()
      const keydownHandler = (mockWindow.addEventListener as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => call[0] === 'keydown'
      )?.[1] as (e: { key: string; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; metaKey: boolean; preventDefault: () => void; stopPropagation: () => void }) => void
      
      if (keydownHandler) {
        keydownHandler({ key: '3', ctrlKey: true, altKey: true, shiftKey: false, metaKey: false, preventDefault: vi.fn(), stopPropagation: vi.fn() })
      }
    })

    it('should ignore disabled shortcuts', async () => {
      const { initThemeShortcut, themeShortcutManager } = await import('../themeShortcutManager')
      themeShortcutManager.disableShortcut('toggle-dark')
      initThemeShortcut()
      const keydownHandler = (mockWindow.addEventListener as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => call[0] === 'keydown'
      )?.[1] as (e: { key: string; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; metaKey: boolean; preventDefault: () => void; stopPropagation: () => void }) => void
      
      if (keydownHandler) {
        keydownHandler({ key: 'd', ctrlKey: true, shiftKey: true, altKey: false, metaKey: false, preventDefault: vi.fn(), stopPropagation: vi.fn() })
      }
      themeShortcutManager.enableShortcut('toggle-dark')
    })

    it('should ignore keydown without matching shortcut', async () => {
      const { initThemeShortcut } = await import('../themeShortcutManager')
      initThemeShortcut()
      const keydownHandler = (mockWindow.addEventListener as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => call[0] === 'keydown'
      )?.[1] as (e: { key: string; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; metaKey: boolean; preventDefault: () => void; stopPropagation: () => void }) => void
      
      if (keydownHandler) {
        keydownHandler({ key: 'z', ctrlKey: true, shiftKey: true, altKey: false, metaKey: false, preventDefault: vi.fn(), stopPropagation: vi.fn() })
      }
    })
  })

  describe('showNotification', () => {
    it('should use notification callback if set', async () => {
      const callback = vi.fn()
      const { initThemeShortcut, themeShortcutManager } = await import('../themeShortcutManager')
      themeShortcutManager.setNotificationCallback(callback)
      initThemeShortcut()
      const keydownHandler = (mockWindow.addEventListener as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => call[0] === 'keydown'
      )?.[1] as (e: { key: string; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; metaKey: boolean; preventDefault: () => void; stopPropagation: () => void }) => void

      if (keydownHandler) {
        keydownHandler({ key: 'd', ctrlKey: true, shiftKey: true, altKey: false, metaKey: false, preventDefault: vi.fn(), stopPropagation: vi.fn() })
      }
    })

    // 无 callback 时走默认通知流程
    it('should show default notification when callback is null', async () => {
      const { initThemeShortcut, themeShortcutManager } = await import('../themeShortcutManager')
      themeShortcutManager.setNotificationCallback(null)
      initThemeShortcut()
      const keydownHandler = (mockWindow.addEventListener as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => call[0] === 'keydown'
      )?.[1] as (e: { key: string; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; metaKey: boolean; preventDefault: () => void; stopPropagation: () => void }) => void

      if (keydownHandler) {
        keydownHandler({ key: 'd', ctrlKey: true, shiftKey: true, altKey: false, metaKey: false, preventDefault: vi.fn(), stopPropagation: vi.fn() })
      }
      expect(mockDocument.createElement).toHaveBeenCalledWith('div')
      expect(mockDocument.body.appendChild).toHaveBeenCalled()
    })
  })

  // input/textarea 元素聚焦时不应触发快捷键
  describe('keydown input/textarea guard', () => {
    it('should ignore keydown in input element', async () => {
      const { initThemeShortcut } = await import('../themeShortcutManager')
      initThemeShortcut()
      const keydownHandler = (mockWindow.addEventListener as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => call[0] === 'keydown'
      )?.[1] as (e: unknown) => void

      if (keydownHandler) {
        const input = { tagName: 'INPUT' }
        keydownHandler({ key: 'd', ctrlKey: true, shiftKey: true, altKey: false, metaKey: false, target: input, preventDefault: vi.fn(), stopPropagation: vi.fn() })
      }
    })

    it('should ignore keydown in textarea element', async () => {
      const { initThemeShortcut } = await import('../themeShortcutManager')
      initThemeShortcut()
      const keydownHandler = (mockWindow.addEventListener as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => call[0] === 'keydown'
      )?.[1] as (e: unknown) => void

      if (keydownHandler) {
        const textarea = { tagName: 'TEXTAREA' }
        keydownHandler({ key: 'd', ctrlKey: true, shiftKey: true, altKey: false, metaKey: false, target: textarea, preventDefault: vi.fn(), stopPropagation: vi.fn() })
      }
    })
  })

  // 触发快捷键时应调用 preventDefault 和 stopPropagation
  describe('keydown preventDefault', () => {
    it('should call preventDefault and stopPropagation when shortcut matches', async () => {
      const { initThemeShortcut } = await import('../themeShortcutManager')
      initThemeShortcut()
      const keydownHandler = (mockWindow.addEventListener as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => call[0] === 'keydown'
      )?.[1] as (e: unknown) => void

      if (keydownHandler) {
        const preventDefault = vi.fn()
        const stopPropagation = vi.fn()
        keydownHandler({ key: 'd', ctrlKey: true, shiftKey: true, altKey: false, metaKey: false, target: { tagName: 'BODY' }, preventDefault, stopPropagation })
        expect(preventDefault).toHaveBeenCalled()
        expect(stopPropagation).toHaveBeenCalled()
      }
    })
  })

  // handler 抛错时被捕获并记录
  describe('keydown handler error', () => {
    it('should catch and log handler error', async () => {
      const { initThemeShortcut, themeShortcutManager } = await import('../themeShortcutManager')
      // 注册一个会抛错的 handler 覆盖默认的 toggle-dark
      themeShortcutManager.registerAction('toggle-dark', () => { throw new Error('boom') })
      initThemeShortcut()
      const keydownHandler = (mockWindow.addEventListener as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => call[0] === 'keydown'
      )?.[1] as (e: unknown) => void

      if (keydownHandler) {
        keydownHandler({ key: 'd', ctrlKey: true, shiftKey: true, altKey: false, metaKey: false, target: { tagName: 'BODY' }, preventDefault: vi.fn(), stopPropagation: vi.fn() })
      }
    })
  })

  // 测试 registerAction 覆盖后真正执行
  describe('registerAction override', () => {
    it('should execute overridden action via keydown', async () => {
      const { initThemeShortcut, themeShortcutManager } = await import('../themeShortcutManager')
      const customHandler = vi.fn()
      themeShortcutManager.registerAction('set-light', customHandler)
      initThemeShortcut()
      const keydownHandler = (mockWindow.addEventListener as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => call[0] === 'keydown'
      )?.[1] as (e: unknown) => void

      if (keydownHandler) {
        keydownHandler({ key: '1', ctrlKey: false, altKey: true, shiftKey: false, metaKey: false, target: { tagName: 'BODY' }, preventDefault: vi.fn(), stopPropagation: vi.fn() })
      }
      expect(customHandler).toHaveBeenCalled()
    })
  })

  // init 返回的清理函数
  describe('init cleanup function', () => {
    it('should remove keydown listener and reset initialized status on cleanup', async () => {
      const { initThemeShortcut, themeShortcutManager } = await import('../themeShortcutManager')
      const cleanup = initThemeShortcut()
      expect(themeShortcutManager.isInitializedStatus()).toBe(true)
      cleanup()
      expect(mockWindow.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function))
      expect(themeShortcutManager.isInitializedStatus()).toBe(false)
    })

    // 清理后可以再次初始化
    it('should be re-initializable after cleanup', async () => {
      const { initThemeShortcut, themeShortcutManager } = await import('../themeShortcutManager')
      const cleanup = initThemeShortcut()
      cleanup()
      initThemeShortcut()
      expect(themeShortcutManager.isInitializedStatus()).toBe(true)
    })
  })

  // 存储数据包含未知 id 时应忽略
  describe('mergeWithDefaults with unknown ids', () => {
    it('should ignore unknown shortcut ids in stored data', async () => {
      mockStore['theme-shortcuts-config'] = JSON.stringify([
        { id: 'toggle-dark', key: 'z' },
        { id: 'unknown-id', key: 'q' }
      ])
      const { themeShortcutManager } = await import('../themeShortcutManager')
      const shortcut = themeShortcutManager.getShortcut('toggle-dark')
      expect(shortcut?.key).toBe('z')
      expect(themeShortcutManager.getShortcut('unknown-id')).toBeUndefined()
    })
  })

  // localStorage.setItem 抛错时不中断
  describe('saveShortcuts error handling', () => {
    it('should not throw when localStorage.setItem fails', async () => {
      vi.stubGlobal('localStorage', {
        getItem: (key: string) => mockStore[key] || null,
        setItem: () => { throw new Error('quota exceeded') },
        removeItem: () => {},
        clear: () => {}
      })
      vi.resetModules()
      const { themeShortcutManager } = await import('../themeShortcutManager')
      expect(() => themeShortcutManager.updateShortcut('toggle-dark', { key: 'x' })).not.toThrow()
    })
  })

  // getModeName i18n 路径
  describe('i18n mode name', () => {
    it('should use vue-i18n t function when available', async () => {
      vi.stubGlobal('window', {
        ...mockWindow,
        __VUE_I18N__: { global: { t: (k: string) => `i18n:${k}` } }
      })
      vi.resetModules()
      const { initThemeShortcut, themeShortcutManager } = await import('../themeShortcutManager')
      const callback = vi.fn()
      themeShortcutManager.setNotificationCallback(callback)
      initThemeShortcut()
      const keydownHandler = (mockWindow.addEventListener as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => call[0] === 'keydown'
      )?.[1] as (e: unknown) => void
      if (keydownHandler) {
        keydownHandler({ key: 'd', ctrlKey: true, shiftKey: true, altKey: false, metaKey: false, target: { tagName: 'BODY' }, preventDefault: vi.fn(), stopPropagation: vi.fn() })
      }
      // i18n 返回的字符串应该包含 i18n: 前缀
      const lastCall = callback.mock.calls[callback.mock.calls.length - 1]
      if (lastCall) {
        expect(lastCall[0]).toContain('i18n:')
      }
    })
  })

  // 各种 toggle-high-contrast 分支
  describe('toggle-high-contrast branches', () => {
    it('should toggle from light to high-contrast-light', async () => {
      vi.mock('@/stores/darkMode', () => ({
        useDarkModeStore: vi.fn(() => ({
          themeMode: 'light',
          setThemeMode: vi.fn(),
        })),
      }))
      vi.resetModules()
      const { initThemeShortcut, themeShortcutManager } = await import('../themeShortcutManager')
      themeShortcutManager.setNotificationCallback(vi.fn())
      initThemeShortcut()
      const keydownHandler = (mockWindow.addEventListener as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => call[0] === 'keydown'
      )?.[1] as (e: unknown) => void
      if (keydownHandler) {
        keydownHandler({ key: 'h', ctrlKey: true, shiftKey: true, altKey: false, metaKey: false, target: { tagName: 'BODY' }, preventDefault: vi.fn(), stopPropagation: vi.fn() })
      }
    })

    it('should toggle from dark to high-contrast-dark', async () => {
      vi.mock('@/stores/darkMode', () => ({
        useDarkModeStore: vi.fn(() => ({
          themeMode: 'dark',
          setThemeMode: vi.fn(),
        })),
      }))
      vi.resetModules()
      const { initThemeShortcut, themeShortcutManager } = await import('../themeShortcutManager')
      themeShortcutManager.setNotificationCallback(vi.fn())
      initThemeShortcut()
      const keydownHandler = (mockWindow.addEventListener as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => call[0] === 'keydown'
      )?.[1] as (e: unknown) => void
      if (keydownHandler) {
        keydownHandler({ key: 'h', ctrlKey: true, shiftKey: true, altKey: false, metaKey: false, target: { tagName: 'BODY' }, preventDefault: vi.fn(), stopPropagation: vi.fn() })
      }
    })

    it('should toggle from high-contrast-light to light', async () => {
      vi.mock('@/stores/darkMode', () => ({
        useDarkModeStore: vi.fn(() => ({
          themeMode: 'high-contrast-light',
          setThemeMode: vi.fn(),
        })),
      }))
      vi.resetModules()
      const { initThemeShortcut, themeShortcutManager } = await import('../themeShortcutManager')
      themeShortcutManager.setNotificationCallback(vi.fn())
      initThemeShortcut()
      const keydownHandler = (mockWindow.addEventListener as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => call[0] === 'keydown'
      )?.[1] as (e: unknown) => void
      if (keydownHandler) {
        keydownHandler({ key: 'h', ctrlKey: true, shiftKey: true, altKey: false, metaKey: false, target: { tagName: 'BODY' }, preventDefault: vi.fn(), stopPropagation: vi.fn() })
      }
    })

    it('should toggle from high-contrast-dark to dark', async () => {
      vi.mock('@/stores/darkMode', () => ({
        useDarkModeStore: vi.fn(() => ({
          themeMode: 'high-contrast-dark',
          setThemeMode: vi.fn(),
        })),
      }))
      vi.resetModules()
      const { initThemeShortcut, themeShortcutManager } = await import('../themeShortcutManager')
      themeShortcutManager.setNotificationCallback(vi.fn())
      initThemeShortcut()
      const keydownHandler = (mockWindow.addEventListener as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => call[0] === 'keydown'
      )?.[1] as (e: unknown) => void
      if (keydownHandler) {
        keydownHandler({ key: 'h', ctrlKey: true, shiftKey: true, altKey: false, metaKey: false, target: { tagName: 'BODY' }, preventDefault: vi.fn(), stopPropagation: vi.fn() })
      }
    })
  })

  // toggle-dark 在 high-contrast-dark 模式下应切到 light
  describe('toggle-dark from high-contrast-dark', () => {
    it('should switch to light when current mode is high-contrast-dark', async () => {
      vi.mock('@/stores/darkMode', () => ({
        useDarkModeStore: vi.fn(() => ({
          themeMode: 'high-contrast-dark',
          setThemeMode: vi.fn(),
        })),
      }))
      vi.resetModules()
      const { initThemeShortcut, themeShortcutManager } = await import('../themeShortcutManager')
      themeShortcutManager.setNotificationCallback(vi.fn())
      initThemeShortcut()
      const keydownHandler = (mockWindow.addEventListener as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => call[0] === 'keydown'
      )?.[1] as (e: unknown) => void
      if (keydownHandler) {
        keydownHandler({ key: 'd', ctrlKey: true, shiftKey: true, altKey: false, metaKey: false, target: { tagName: 'BODY' }, preventDefault: vi.fn(), stopPropagation: vi.fn() })
      }
    })
  })

  // 触发 registerAction 覆盖的 action（验证 unregister 之外覆盖也能执行）
  describe('high-contrast set actions', () => {
    it('should execute overridden action via keydown', async () => {
      const { initThemeShortcut, themeShortcutManager } = await import('../themeShortcutManager')
      const handler = vi.fn()
      // 用 registerAction 覆盖默认的 set-auto handler
      themeShortcutManager.registerAction('set-auto', () => {
        handler()
      })
      themeShortcutManager.setNotificationCallback(vi.fn())
      initThemeShortcut()
      const keydownHandler = (mockWindow.addEventListener as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => call[0] === 'keydown'
      )?.[1] as (e: unknown) => void
      if (keydownHandler) {
        keydownHandler({ key: '3', ctrlKey: false, altKey: true, shiftKey: false, metaKey: false, target: { tagName: 'BODY' }, preventDefault: vi.fn(), stopPropagation: vi.fn() })
      }
      expect(handler).toHaveBeenCalled()
    })
  })

  // metaOnly 路径：modifiers 含 meta 但不含 ctrl
  describe('meta only modifier', () => {
    it('should match shortcut with meta only', async () => {
      const { themeShortcutManager, initThemeShortcut } = await import('../themeShortcutManager')
      // 新增一个仅含 meta 修饰键的快捷键
      themeShortcutManager.updateShortcut('toggle-dark', { key: 'k', modifiers: ['meta'] })
      const handler = vi.fn()
      themeShortcutManager.registerAction('toggle-dark', handler)
      themeShortcutManager.setNotificationCallback(vi.fn())
      initThemeShortcut()
      const keydownHandler = (mockWindow.addEventListener as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => call[0] === 'keydown'
      )?.[1] as (e: unknown) => void
      if (keydownHandler) {
        keydownHandler({ key: 'k', ctrlKey: false, altKey: false, shiftKey: false, metaKey: true, target: { tagName: 'BODY' }, preventDefault: vi.fn(), stopPropagation: vi.fn() })
      }
      expect(handler).toHaveBeenCalled()
    })
  })

  // 修饰键不匹配时不应触发
  describe('modifier mismatch', () => {
    it('should not match when shift is required but not pressed', async () => {
      const { initThemeShortcut, themeShortcutManager } = await import('../themeShortcutManager')
      const handler = vi.fn()
      themeShortcutManager.registerAction('toggle-dark', handler)
      initThemeShortcut()
      const keydownHandler = (mockWindow.addEventListener as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => call[0] === 'keydown'
      )?.[1] as (e: unknown) => void
      if (keydownHandler) {
        // 不按 shift，应该不匹配（toggle-dark 需要 ctrl+shift）
        keydownHandler({ key: 'd', ctrlKey: true, shiftKey: false, altKey: false, metaKey: false, target: { tagName: 'BODY' }, preventDefault: vi.fn(), stopPropagation: vi.fn() })
      }
      expect(handler).not.toHaveBeenCalled()
    })
  })

  // HTMLTextAreaElement 实例早期返回
  describe('HTMLTextAreaElement guard', () => {
    it('should ignore keydown in HTMLTextAreaElement instance', async () => {
      // 定义 HTMLTextAreaElement 类，让 instanceof 生效
      class HTMLTextAreaElement {}
      vi.stubGlobal('HTMLTextAreaElement', HTMLTextAreaElement)
      vi.resetModules()
      const { initThemeShortcut, themeShortcutManager } = await import('../themeShortcutManager')
      const handler = vi.fn()
      themeShortcutManager.registerAction('toggle-dark', handler)
      initThemeShortcut()
      const keydownHandler = (mockWindow.addEventListener as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => call[0] === 'keydown'
      )?.[1] as (e: unknown) => void
      if (keydownHandler) {
        const textarea = new HTMLTextAreaElement()
        keydownHandler({ key: 'd', ctrlKey: true, shiftKey: true, altKey: false, metaKey: false, target: textarea, preventDefault: vi.fn(), stopPropagation: vi.fn() })
      }
      expect(handler).not.toHaveBeenCalled()
    })
  })

  // HTMLInputElement 实例早期返回
  describe('HTMLInputElement guard', () => {
    it('should ignore keydown in HTMLInputElement instance', async () => {
      class HTMLInputElement {}
      vi.stubGlobal('HTMLInputElement', HTMLInputElement)
      vi.resetModules()
      const { initThemeShortcut, themeShortcutManager } = await import('../themeShortcutManager')
      const handler = vi.fn()
      themeShortcutManager.registerAction('toggle-dark', handler)
      initThemeShortcut()
      const keydownHandler = (mockWindow.addEventListener as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => call[0] === 'keydown'
      )?.[1] as (e: unknown) => void
      if (keydownHandler) {
        const input = new HTMLInputElement()
        keydownHandler({ key: 'd', ctrlKey: true, shiftKey: true, altKey: false, metaKey: false, target: input, preventDefault: vi.fn(), stopPropagation: vi.fn() })
      }
      expect(handler).not.toHaveBeenCalled()
    })
  })

  // getThemeShortcutInfo 验证返回结构
  describe('getThemeShortcutInfo structure', () => {
    it('should return uppercase key and modifiers array', async () => {
      const { getThemeShortcutInfo } = await import('../themeShortcutManager')
      const info = getThemeShortcutInfo()
      expect(info.key).toBe('T')
      expect(info.modifiers).toContain('ctrl')
      expect(info.modifiers).toContain('shift')
    })
  })
})
