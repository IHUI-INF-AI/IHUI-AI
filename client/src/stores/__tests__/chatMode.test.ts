import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useChatModeStore } from '../chatMode'

vi.mock('@/utils/storage', () => ({
  StorageManager: {
    getItem: vi.fn(),
    setItem: vi.fn(),
  },
}))

describe('chatMode store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  describe('初始状态', () => {
    it('应该有默认模式', () => {
      const store = useChatModeStore()
      expect(store.mode).toBe('dialog')
    })

    it('应该显示模式切换器', () => {
      const store = useChatModeStore()
      expect(store.showModeSwitcher).toBe(true)
    })
  })

  describe('setMode', () => {
    it('应该能够设置模式', () => {
      const store = useChatModeStore()
      store.setMode('global')
      expect(store.mode).toBe('global')
    })

    it('应该能够设置为agent模式', () => {
      const store = useChatModeStore()
      store.setMode('agent')
      expect(store.mode).toBe('agent')
    })
  })

  describe('toggleMode', () => {
    it('应该能够切换模式', () => {
      const store = useChatModeStore()
      expect(store.mode).toBe('dialog')
      store.toggleMode()
      expect(store.mode).toBe('agent')
      store.toggleMode()
      expect(store.mode).toBe('global')
      store.toggleMode()
      expect(store.mode).toBe('dialog')
    })
  })

  describe('setShowModeSwitcher', () => {
    it('应该能够设置显示模式切换器', () => {
      const store = useChatModeStore()
      store.setShowModeSwitcher(false)
      expect(store.showModeSwitcher).toBe(false)
    })
  })
})
