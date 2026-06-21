import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
}

const mockDocumentElement = {
  style: {
    setProperty: vi.fn(),
  },
}

describe('font store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.stubGlobal('localStorage', mockLocalStorage)
    vi.stubGlobal('document', {
      documentElement: mockDocumentElement,
    })
  })

  describe('状态', () => {
    it('应该返回当前字体', async () => {
      const { useFontStore } = await import('../font')
      const fontStore = useFontStore()
      expect(fontStore.currentFont).toBe('HarmonyOS Sans SC')
    })
  })

  describe('setFont', () => {
    it('应该设置字体', async () => {
      const { useFontStore } = await import('../font')
      const fontStore = useFontStore()
      
      fontStore.setFont('Custom Font')
      
      expect(fontStore.currentFont).toBe('Custom Font')
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('font', 'Custom Font')
      expect(mockDocumentElement.style.setProperty).toHaveBeenCalledWith(
        '--font-family-chinese',
        "'HarmonyOS Sans SC'",
        'important'
      )
    })
  })

  describe('initFont', () => {
    it('应该使用存储的字体', async () => {
      mockLocalStorage.getItem.mockReturnValue('Saved Font')
      
      const { useFontStore } = await import('../font')
      const fontStore = useFontStore()
      fontStore.initFont()
      
      expect(fontStore.currentFont).toBe('Saved Font')
      expect(mockDocumentElement.style.setProperty).toHaveBeenCalled()
    })

    it('应该使用默认字体当没有存储时', async () => {
      mockLocalStorage.getItem.mockReturnValue(null)
      
      const { useFontStore } = await import('../font')
      const fontStore = useFontStore()
      fontStore.initFont()
      
      expect(fontStore.currentFont).toBe('HarmonyOS Sans SC')
      expect(mockDocumentElement.style.setProperty).toHaveBeenCalled()
    })
  })
})
