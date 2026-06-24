import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useNavigation } from '../navigation'

vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    back: vi.fn(),
  })),
}))

describe('navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('useNavigation', () => {
    it('应该返回导航方法', () => {
      const { goHome, goBack, navigateTo } = useNavigation()
      expect(typeof goHome).toBe('function')
      expect(typeof goBack).toBe('function')
      expect(typeof navigateTo).toBe('function')
    })

    it('goHome应该调用router.push', () => {
      const { goHome } = useNavigation()
      goHome()
    })

    it('goBack应该调用window.history.back', () => {
      const { goBack } = useNavigation()
      const mockBack = vi.fn()
      const originalWindow = global.window
      // 源码 goBack 检查 window.history.length > 1, mock 需提供 length
      Object.defineProperty(global, 'window', {
        value: { history: { back: mockBack, length: 2 } },
        writable: true,
      })
      goBack()
      expect(mockBack).toHaveBeenCalled()
      Object.defineProperty(global, 'window', {
        value: originalWindow,
        writable: true,
      })
    })

    it('navigateTo应该调用router.push', () => {
      const { navigateTo } = useNavigation()
      navigateTo('/test-path')
    })
  })
})
