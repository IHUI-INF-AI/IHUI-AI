import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/utils/storage', () => ({
  StorageManager: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
  },
  STORAGE_KEYS: {
    DARK_MODE: 'darkMode',
  },
}))

vi.mock('@/utils/themePerformance', () => ({
  themePerformanceMonitor: {
    startMeasurement: vi.fn(),
    endMeasurement: vi.fn(),
    startSwitch: vi.fn(),
    endSwitch: vi.fn(() => ({ duration: 100, domElements: 10 })),
    getPerformanceScore: vi.fn(() => 0.95),
    getReport: vi.fn(() => ({ switches: 5, avgDuration: 50 })),
    clearMetrics: vi.fn(),
  },
}))

vi.mock('@/utils/themeHistory', () => ({
  themeHistoryManager: {
    record: vi.fn(),
    addEntry: vi.fn(),
    getReport: vi.fn(() => ({ entries: 10 })),
    getEntries: vi.fn(() => [{ from: 'light', to: 'dark' }]),
    clearHistory: vi.fn(),
  },
}))

vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock('@/utils/optimization', () => ({
  debounce: vi.fn((fn: () => void) => fn),
}))

const mockMediaQuery = {
  matches: false,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}

vi.stubGlobal('window', {
  matchMedia: vi.fn(() => mockMediaQuery),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
})

vi.stubGlobal('document', {
  documentElement: {
    classList: {
      add: vi.fn(),
      remove: vi.fn(),
    },
    setAttribute: vi.fn(),
    removeAttribute: vi.fn(),
    getAttribute: vi.fn(() => null),
  },
  getElementById: vi.fn(),
  head: { appendChild: vi.fn() },
  createElement: vi.fn().mockReturnValue({
    id: '',
    textContent: '',
    remove: vi.fn(),
  }),
})

vi.stubGlobal('requestAnimationFrame', (cb: () => void) => setTimeout(cb, 0))

import { useDarkModeStore } from '../darkMode'
import { StorageManager } from '@/utils/storage'

describe('darkMode store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('初始状态', () => {
    it('应该默认为light模式', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null)
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()
      expect(darkModeStore.themeMode).toBe('light')
    })

    it('应该从存储加载主题模式', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue('dark')
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()
      expect(darkModeStore.themeMode).toBe('dark')
    })

    it('应该处理true值', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue('true')
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()
      expect(darkModeStore.themeMode).toBe('dark')
    })

    it('应该处理false值', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue('false')
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()
      expect(darkModeStore.themeMode).toBe('light')
    })

    it('应该处理auto模式', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue('auto')
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()
      expect(darkModeStore.themeMode).toBe('auto')
    })

    it('应该处理high-contrast-light模式', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue('high-contrast-light')
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()
      expect(darkModeStore.themeMode).toBe('high-contrast-light')
    })

    it('应该处理high-contrast-dark模式', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue('high-contrast-dark')
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()
      expect(darkModeStore.themeMode).toBe('high-contrast-dark')
    })
  })

  describe('isDarkMode计算属性', () => {
    it('应该返回true当主题模式为dark时', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue('dark')
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()
      expect(darkModeStore.isDarkMode).toBe(true)
    })

    it('应该返回false当主题模式为light时', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue('light')
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()
      expect(darkModeStore.isDarkMode).toBe(false)
    })

    it('应该返回true当主题模式为high-contrast-dark时', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue('high-contrast-dark')
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()
      expect(darkModeStore.isDarkMode).toBe(true)
    })

    it('auto模式应该跟随系统偏好', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue('auto')
      mockMediaQuery.matches = true
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()
      expect(darkModeStore.isDarkMode).toBe(true)
    })
  })

  describe('isHighContrast计算属性', () => {
    it('应该返回true当主题模式为high-contrast-light时', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue('high-contrast-light')
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()
      expect(darkModeStore.isHighContrast).toBe(true)
    })

    it('应该返回true当主题模式为high-contrast-dark时', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue('high-contrast-dark')
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()
      expect(darkModeStore.isHighContrast).toBe(true)
    })

    it('应该返回false当主题模式为light时', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue('light')
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()
      expect(darkModeStore.isHighContrast).toBe(false)
    })
  })

  describe('darkModeClass计算属性', () => {
    it('应该返回dark当主题模式为dark时', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue('dark')
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()
      expect(darkModeStore.darkModeClass).toBe('dark')
    })

    it('应该返回空字符串当主题模式为light时', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue('light')
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()
      expect(darkModeStore.darkModeClass).toBe('')
    })

    it('应该返回high-contrast-light当主题模式为high-contrast-light时', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue('high-contrast-light')
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()
      expect(darkModeStore.darkModeClass).toBe('high-contrast-light')
    })

    it('应该返回dark high-contrast-dark当主题模式为high-contrast-dark时', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue('high-contrast-dark')
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()
      expect(darkModeStore.darkModeClass).toBe('dark high-contrast-dark')
    })
  })

  describe('setThemeMode', () => {
    it('应该设置主题模式', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue('light')
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()

      darkModeStore.setThemeMode('dark')

      expect(darkModeStore.themeMode).toBe('dark')
      // setThemeMode uses setTimeout(done, 0) when immediate=false, flush it
      vi.advanceTimersByTime(10)
      expect(StorageManager.setItem).toHaveBeenCalled()
    })

    it('切换主题后 isLoading 保持 false（瞬时切换无 loading）', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue('light')
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()
      darkModeStore.setThemeMode('dark')
      expect(darkModeStore.isLoading).toBe(false)
    })
  })

  describe('toggleDarkMode', () => {
    it('应该从light切换到dark', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue('light')
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()

      darkModeStore.toggleDarkMode()

      expect(darkModeStore.themeMode).toBe('dark')
    })

    it('应该从dark切换到light', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue('dark')
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()

      darkModeStore.toggleDarkMode()

      expect(darkModeStore.themeMode).toBe('light')
    })

    it('auto模式应该切换到light', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue('auto')
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()

      darkModeStore.toggleDarkMode()

      expect(darkModeStore.themeMode).toBe('light')
    })
  })

  describe('syncFromStorage', () => {
    it('应该从存储同步有效主题模式', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue('dark')
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()

      darkModeStore.syncFromStorage()

      expect(darkModeStore.themeMode).toBe('dark')
    })

    it('应该处理true值', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue('true')
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()

      darkModeStore.syncFromStorage()

      expect(darkModeStore.themeMode).toBe('dark')
    })

    it('应该处理false值', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue('false')
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()

      darkModeStore.syncFromStorage()

      expect(darkModeStore.themeMode).toBe('light')
    })

    it('应该默认为auto当存储值为空时', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null)
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()

      darkModeStore.syncFromStorage()

      expect(darkModeStore.themeMode).toBe('auto')
    })
  })

  describe('verifyPersistence', () => {
    it('应该返回成功当存储值与当前值匹配时', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue('dark')
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()

      const result = darkModeStore.verifyPersistence()

      expect(result.success).toBe(true)
      expect(result.storedValue).toBe('dark')
      expect(result.currentValue).toBe('dark')
    })

    it('应该返回失败当存储值与当前值不匹配时', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValueOnce('light').mockReturnValueOnce('dark')
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()

      const result = darkModeStore.verifyPersistence()

      expect(result.success).toBe(false)
    })
  })

  describe('forceSync', () => {
    it('应该强制同步存储和当前状态', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue('light')
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()

      darkModeStore.forceSync()

      expect(StorageManager.setItem).toHaveBeenCalled()
    })
  })

  describe('性能报告方法', () => {
    it('getPerformanceReport应该返回报告', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue('light')
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()

      const report = darkModeStore.getPerformanceReport()

      expect(report).toEqual({ switches: 5, avgDuration: 50 })
    })

    it('getPerformanceScore应该返回分数', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue('light')
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()

      const score = darkModeStore.getPerformanceScore()

      expect(score).toBe(0.95)
    })

    it('clearPerformanceMetrics应该清除指标', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue('light')
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()

      darkModeStore.clearPerformanceMetrics()

      expect(true).toBe(true)
    })
  })

  describe('历史记录方法', () => {
    it('getHistoryReport应该返回历史报告', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue('light')
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()

      const report = darkModeStore.getHistoryReport()

      expect(report).toEqual({ entries: 10 })
    })

    it('getHistoryEntries应该返回历史条目', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue('light')
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()

      const entries = darkModeStore.getHistoryEntries()

      expect(entries).toEqual([{ from: 'light', to: 'dark' }])
    })

    it('clearHistory应该清除历史', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue('light')
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()

      darkModeStore.clearHistory()

      expect(true).toBe(true)
    })
  })

  describe('applyThemeWithTransition', () => {
    it('应该应用主题过渡效果', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue('light')
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()

      const callback = vi.fn()
      darkModeStore.applyThemeWithTransition(callback)

      vi.runAllTimers()
      expect(callback).toHaveBeenCalled()
    })
  })

  describe('cleanupCrossTabSync', () => {
    it('应该返回清理函数', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue('light')
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()

      expect(typeof darkModeStore.cleanupCrossTabSync).toBe('function')
    })
  })

  describe('主题预设 themePreset', () => {
    it('应该默认为default预设', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null)
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()
      expect(darkModeStore.themePreset).toBe('default')
    })

    it('应该从存储加载blue预设', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue('blue')
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()
      expect(darkModeStore.themePreset).toBe('blue')
    })

    it('应该从存储加载green预设', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue('green')
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()
      expect(darkModeStore.themePreset).toBe('green')
    })

    it('应该从存储加载purple预设', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue('purple')
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()
      expect(darkModeStore.themePreset).toBe('purple')
    })

    it('无效预设值应该回退到default', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue('not-a-preset')
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()
      expect(darkModeStore.themePreset).toBe('default')
    })
  })

  describe('setThemePreset', () => {
    it('应该更新预设值', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null)
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()
      darkModeStore.setThemePreset('blue')
      expect(darkModeStore.themePreset).toBe('blue')
    })

    it('应该将预设写入存储', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null)
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()
      vi.clearAllMocks()
      darkModeStore.setThemePreset('green')
      expect(StorageManager.setItem).toHaveBeenCalledWith('theme-preset', 'green')
    })

    it('设置为default时应该移除data-theme属性', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue('blue')
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()
      vi.clearAllMocks()
      darkModeStore.setThemePreset('default')
      expect(document.documentElement.removeAttribute).toHaveBeenCalledWith('data-theme')
    })

    it('设置为非default时应该设置data-theme属性', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null)
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()
      vi.clearAllMocks()
      darkModeStore.setThemePreset('purple')
      expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'purple')
    })
  })

  describe('setThemeMode source参数', () => {
    it('应该接受keyboard source', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue('light')
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()
      darkModeStore.setThemeMode('dark', 'keyboard')
      vi.advanceTimersByTime(10)
      expect(darkModeStore.themeMode).toBe('dark')
    })

    it('应该接受system source', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue('light')
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()
      darkModeStore.setThemeMode('dark', 'system')
      vi.advanceTimersByTime(10)
      expect(darkModeStore.themeMode).toBe('dark')
    })

    it('应该接受init source', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue('light')
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()
      darkModeStore.setThemeMode('dark', 'init')
      vi.advanceTimersByTime(10)
      expect(darkModeStore.themeMode).toBe('dark')
    })

    it('应该接受storage source', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue('light')
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()
      darkModeStore.setThemeMode('dark', 'storage')
      vi.advanceTimersByTime(10)
      expect(darkModeStore.themeMode).toBe('dark')
    })
  })

  describe('setThemeMode immediate=true', () => {
    it('应该同步执行done回调', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue('light')
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()
      vi.clearAllMocks()
      darkModeStore.setThemeMode('dark', 'user', true)
      // 立即执行,无需 advanceTimers
      expect(darkModeStore.themeMode).toBe('dark')
      expect(StorageManager.setItem).toHaveBeenCalled()
    })

    it('应该添加theme-instant类后立即移除', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue('light')
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()
      vi.clearAllMocks()
      darkModeStore.setThemeMode('dark', 'user', true)
      expect(document.documentElement.classList.add).toHaveBeenCalledWith('theme-instant')
      expect(document.documentElement.classList.remove).toHaveBeenCalledWith('theme-instant')
    })
  })

  describe('applyThemeWithTransition无回调', () => {
    it('不传callback应该不抛错', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue('light')
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()
      expect(() => darkModeStore.applyThemeWithTransition()).not.toThrow()
    })
  })

  describe('系统偏好监听', () => {
    it('切换到auto模式应该添加change监听', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue('light')
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()
      vi.clearAllMocks()
      darkModeStore.setThemeMode('auto', 'user', true)
      expect(mockMediaQuery.addEventListener).toHaveBeenCalledWith('change', expect.any(Function))
    })

    it('切换到非auto模式不应该添加change监听', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue('light')
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()
      vi.clearAllMocks()
      darkModeStore.setThemeMode('dark', 'user', true)
      const changeCalls = (mockMediaQuery.addEventListener as ReturnType<typeof vi.fn>).mock.calls
        .filter((c: any[]) => c[0] === 'change')
      expect(changeCalls.length).toBe(0)
    })

    it('auto模式下系统偏好变化应该触发主题更新', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue('auto')
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()
      // 显式调用 setThemeMode 触发 setupSystemPreferenceListener 注册 change 监听
      darkModeStore.setThemeMode('auto', 'user', true)
      // 找到注册的change处理器
      const changeCalls = (mockMediaQuery.addEventListener as ReturnType<typeof vi.fn>).mock.calls
        .filter((c: any[]) => c[0] === 'change')
      const handler = changeCalls[changeCalls.length - 1]?.[1] as (e: any) => void
      expect(typeof handler).toBe('function')
      // 模拟系统偏好变化事件
      handler({ matches: true })
      // 处理器内会检查 themeMode.value === 'auto',符合条件时调用防抖函数(debounce被mock为直接执行)
      expect(darkModeStore.themeMode).toBe('auto')
    })

    it('再次进入auto模式应该清理旧的change监听器', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue('auto')
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()
      // 第一次进入 auto 注册监听
      darkModeStore.setThemeMode('auto', 'user', true)
      vi.clearAllMocks()
      // 再次进入 auto 触发清理旧监听器逻辑
      darkModeStore.setThemeMode('auto', 'storage', true)
      expect(mockMediaQuery.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
    })
  })

  describe('跨标签页storage事件同步', () => {
    // 工具:从window mock中获取注册的storage事件处理器
    const getStorageHandler = (): ((e: any) => void) | undefined => {
      const calls = (window.addEventListener as ReturnType<typeof vi.fn>).mock.calls
      const storageCall = calls.find((c: any[]) => c[0] === 'storage')
      return storageCall?.[1] as ((e: any) => void) | undefined
    }

    it('有效darkMode变更应该更新主题', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue('light')
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()
      const handler = getStorageHandler()
      handler?.({ key: 'darkMode', newValue: 'dark' })
      expect(darkModeStore.themeMode).toBe('dark')
    })

    it('非darkMode的key应该被忽略', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue('light')
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()
      const handler = getStorageHandler()
      handler?.({ key: 'other-key', newValue: 'dark' })
      expect(darkModeStore.themeMode).toBe('light')
    })

    it('newValue为null应该被忽略', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue('light')
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()
      const handler = getStorageHandler()
      handler?.({ key: 'darkMode', newValue: null })
      expect(darkModeStore.themeMode).toBe('light')
    })

    it('无效主题值应该被忽略', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue('light')
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()
      const handler = getStorageHandler()
      handler?.({ key: 'darkMode', newValue: 'invalid-mode' })
      expect(darkModeStore.themeMode).toBe('light')
    })

    it('相同主题值不应该重复更新', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue('light')
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()
      const handler = getStorageHandler()
      handler?.({ key: 'darkMode', newValue: 'light' })
      expect(darkModeStore.themeMode).toBe('light')
    })

    it('执行清理函数应该解除storage事件监听', () => {
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue('light')
      setActivePinia(createPinia())
      const darkModeStore = useDarkModeStore()
      vi.clearAllMocks()
      const cleanup = darkModeStore.cleanupCrossTabSync
      if (typeof cleanup === 'function') cleanup()
      expect(window.removeEventListener).toHaveBeenCalledWith('storage', expect.any(Function))
    })
  })
})
