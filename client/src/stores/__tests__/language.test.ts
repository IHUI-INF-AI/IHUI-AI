import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/utils/storage', () => ({
  StorageManager: {
    getItem: vi.fn(),
    setItem: vi.fn(),
  },
  STORAGE_KEYS: {
    LANGUAGE: 'language',
  },
}))

vi.mock('@/locales', () => ({
  setLanguage: vi.fn(),
}))

describe('language store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.stubGlobal('navigator', { language: 'zh-CN' })
  })

  describe('状态', () => {
    it('应该返回当前语言', async () => {
      const { useLanguageStore } = await import('../language')
      const languageStore = useLanguageStore()
      expect(languageStore.currentLanguage).toBe('zh-CN')
    })
  })

  describe('setLanguage', () => {
    it('应该设置语言', async () => {
      const { useLanguageStore } = await import('../language')
      const { StorageManager } = await import('@/utils/storage')
      const { setLanguage: applyI18nLanguage } = await import('@/locales')
      const languageStore = useLanguageStore()
      
      languageStore.setLanguage('en')
      
      expect(languageStore.currentLanguage).toBe('en')
      expect(StorageManager.setItem).toHaveBeenCalled()
      expect(applyI18nLanguage).toHaveBeenCalledWith('en')
    })
  })

  describe('initLanguage', () => {
    it('应该使用存储的语言', async () => {
      const { useLanguageStore } = await import('../language')
      const { StorageManager } = await import('@/utils/storage')
      const { setLanguage: applyI18nLanguage } = await import('@/locales')
      ;(StorageManager.getItem as ReturnType<typeof vi.fn>).mockReturnValue('en')
      
      const languageStore = useLanguageStore()
      languageStore.initLanguage()
      
      expect(languageStore.currentLanguage).toBe('en')
      expect(applyI18nLanguage).toHaveBeenCalledWith('en')
    })
  })
})
