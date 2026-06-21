import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { themeHistoryManager, type ThemeHistoryEntry } from '../themeHistory'

describe('themeHistory', () => {
  interface MockStorage {
    store: Record<string, string>
    getItem(key: string): string | null
    setItem(key: string, value: string): void
    removeItem(key: string): void
    clear(): void
    get length(): number
    key(index: number): string | null
  }

  let localStorageMock: MockStorage

  beforeEach(() => {
    localStorageMock = {
      store: {},
      getItem(key: string) {
        return this.store[key] || null
      },
      setItem(key: string, value: string) {
        this.store[key] = value
      },
      removeItem(key: string) {
        delete this.store[key]
      },
      clear() {
        this.store = {}
      },
      get length() {
        return Object.keys(this.store).length
      },
      key(index: number) {
        return Object.keys(this.store)[index] || null
      },
    }

    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
      configurable: true,
    })

    themeHistoryManager.clearHistory()
  })

  afterEach(() => {
    themeHistoryManager.clearHistory()
    vi.clearAllMocks()
  })

  describe('addEntry', () => {
    it('应该添加主题切换记录', () => {
      const entry = themeHistoryManager.addEntry('light', 'dark', 'user')
      expect(entry.fromMode).toBe('light')
      expect(entry.toMode).toBe('dark')
      expect(entry.source).toBe('user')
      expect(entry.timestamp).toBeDefined()
    })

    it('应该使用默认source', () => {
      const entry = themeHistoryManager.addEntry('light', 'dark')
      expect(entry.source).toBe('user')
    })

    it('应该支持不同的source类型', () => {
      const sources: ThemeHistoryEntry['source'][] = ['user', 'system', 'keyboard', 'storage', 'init']
      sources.forEach(source => {
        const entry = themeHistoryManager.addEntry('light', 'dark', source)
        expect(entry.source).toBe(source)
      })
    })
  })

  describe('getEntries', () => {
    it('应该返回所有记录', () => {
      themeHistoryManager.addEntry('light', 'dark', 'user')
      themeHistoryManager.addEntry('dark', 'light', 'system')
      const entries = themeHistoryManager.getEntries()
      expect(entries).toHaveLength(2)
    })

    it('应该返回记录的副本', () => {
      themeHistoryManager.addEntry('light', 'dark', 'user')
      const entries1 = themeHistoryManager.getEntries()
      const entries2 = themeHistoryManager.getEntries()
      expect(entries1).not.toBe(entries2)
      expect(entries1).toEqual(entries2)
    })
  })

  describe('getReport', () => {
    it('应该返回空报告当没有记录', () => {
      const report = themeHistoryManager.getReport()
      expect(report.totalSwitches).toBe(0)
      expect(report.lastSwitch).toBeNull()
      expect(report.mostUsedMode).toBe('light')
    })

    it('应该返回正确的报告', () => {
      themeHistoryManager.addEntry('light', 'dark', 'user')
      themeHistoryManager.addEntry('dark', 'light', 'user')
      themeHistoryManager.addEntry('light', 'dark', 'system')

      const report = themeHistoryManager.getReport()
      expect(report.totalSwitches).toBe(3)
      expect(report.lastSwitch?.toMode).toBe('dark')
      expect(report.mostUsedMode).toBe('dark')
    })

    it('应该计算今日切换次数', () => {
      themeHistoryManager.addEntry('light', 'dark', 'user')
      themeHistoryManager.addEntry('dark', 'light', 'user')

      const report = themeHistoryManager.getReport()
      expect(report.switchesToday).toBe(2)
    })

    it('应该计算本周切换次数', () => {
      themeHistoryManager.addEntry('light', 'dark', 'user')
      themeHistoryManager.addEntry('dark', 'light', 'user')
      themeHistoryManager.addEntry('light', 'dark', 'system')

      const report = themeHistoryManager.getReport()
      expect(report.switchesThisWeek).toBe(3)
    })
  })

  describe('clearHistory', () => {
    it('应该清空所有记录', () => {
      themeHistoryManager.addEntry('light', 'dark', 'user')
      themeHistoryManager.addEntry('dark', 'light', 'user')
      themeHistoryManager.clearHistory()
      expect(themeHistoryManager.getEntries()).toHaveLength(0)
    })

    it('应该从localStorage删除记录', () => {
      themeHistoryManager.addEntry('light', 'dark', 'user')
      themeHistoryManager.clearHistory()
      expect(localStorageMock.getItem('theme-history')).toBeNull()
    })
  })

  describe('getEntriesBySource', () => {
    it('应该按source过滤记录', () => {
      themeHistoryManager.addEntry('light', 'dark', 'user')
      themeHistoryManager.addEntry('dark', 'light', 'system')
      themeHistoryManager.addEntry('light', 'dark', 'user')

      const userEntries = themeHistoryManager.getEntriesBySource('user')
      expect(userEntries).toHaveLength(2)

      const systemEntries = themeHistoryManager.getEntriesBySource('system')
      expect(systemEntries).toHaveLength(1)
    })
  })

  describe('getEntriesByMode', () => {
    it('应该按目标模式过滤记录', () => {
      themeHistoryManager.addEntry('light', 'dark', 'user')
      themeHistoryManager.addEntry('dark', 'light', 'user')
      themeHistoryManager.addEntry('light', 'dark', 'system')

      const darkEntries = themeHistoryManager.getEntriesByMode('dark')
      expect(darkEntries).toHaveLength(2)

      const lightEntries = themeHistoryManager.getEntriesByMode('light')
      expect(lightEntries).toHaveLength(1)
    })
  })

  describe('持久化', () => {
    it('应该保存到localStorage', () => {
      themeHistoryManager.addEntry('light', 'dark', 'user')
      const stored = localStorageMock.getItem('theme-history')
      expect(stored).not.toBeNull()
      const parsed = JSON.parse(stored!)
      expect(parsed).toHaveLength(1)
    })
  })

  describe('最大记录数限制', () => {
    it('应该限制最大记录数为50', () => {
      for (let i = 0; i < 60; i++) {
        themeHistoryManager.addEntry('light', 'dark', 'user')
      }
      const entries = themeHistoryManager.getEntries()
      expect(entries.length).toBeLessThanOrEqual(50)
    })
  })
})
