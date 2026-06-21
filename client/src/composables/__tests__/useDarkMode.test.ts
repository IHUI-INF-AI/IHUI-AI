import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockDarkModeStore = {
  isDarkMode: false,
  themeMode: 'light',
  toggleDarkMode: vi.fn(),
  setThemeMode: vi.fn(),
}

vi.mock('@/stores/darkMode', () => ({
  useDarkModeStore: vi.fn(() => mockDarkModeStore),
}))

vi.mock('vue', () => ({
  computed: vi.fn((fn: () => unknown) => ({ value: fn(), get: fn })),
  watch: vi.fn(() => vi.fn()),
  onMounted: vi.fn((callback: () => void) => callback()),
  onUnmounted: vi.fn(),
}))

describe('useDarkMode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDarkModeStore.isDarkMode = false
    mockDarkModeStore.themeMode = 'light'
  })

  describe('useDarkMode', () => {
    it('应该返回暗色模式状态', async () => {
      const { useDarkMode } = await import('../useDarkMode')
      const darkMode = useDarkMode()

      expect(darkMode.isDark.value).toBe(false)
      expect(darkMode.themeMode.value).toBe('light')
      expect(darkMode.isAuto.value).toBe(false)
    })

    it('应该返回切换方法', async () => {
      const { useDarkMode } = await import('../useDarkMode')
      const darkMode = useDarkMode()

      expect(typeof darkMode.toggle).toBe('function')
      expect(typeof darkMode.setLight).toBe('function')
      expect(typeof darkMode.setDark).toBe('function')
      expect(typeof darkMode.setAuto).toBe('function')
    })

    it('toggle应该调用store.toggleDarkMode', async () => {
      const { useDarkMode } = await import('../useDarkMode')
      const darkMode = useDarkMode()

      darkMode.toggle()

      expect(mockDarkModeStore.toggleDarkMode).toHaveBeenCalled()
    })

    it('setLight应该调用store.setThemeMode', async () => {
      const { useDarkMode } = await import('../useDarkMode')
      const darkMode = useDarkMode()

      darkMode.setLight()

      expect(mockDarkModeStore.setThemeMode).toHaveBeenCalledWith('light', 'user', true)
    })

    it('setDark应该调用store.setThemeMode', async () => {
      const { useDarkMode } = await import('../useDarkMode')
      const darkMode = useDarkMode()

      darkMode.setDark()

      expect(mockDarkModeStore.setThemeMode).toHaveBeenCalledWith('dark', 'user', true)
    })

    it('setAuto应该调用store.setThemeMode', async () => {
      const { useDarkMode } = await import('../useDarkMode')
      const darkMode = useDarkMode()

      darkMode.setAuto()

      expect(mockDarkModeStore.setThemeMode).toHaveBeenCalledWith('auto', 'user', true)
    })
  })

  describe('useDarkModeValue', () => {
    it('应该返回亮色值当isDark为false', async () => {
      const { useDarkModeValue } = await import('../useDarkMode')
      const result = useDarkModeValue('light-value', 'dark-value')

      expect(result.value).toBe('light-value')
    })
  })

  describe('useDarkModeClass', () => {
    it('应该返回空字符串当isDark为false', async () => {
      const { useDarkModeClass } = await import('../useDarkMode')
      const result = useDarkModeClass()

      expect(result.value).toBe('')
    })
  })

  describe('useDarkModeImage', () => {
    it('应该返回亮色图片当isDark为false', async () => {
      const { useDarkModeImage } = await import('../useDarkMode')
      const result = useDarkModeImage('light.png', 'dark.png')

      expect(result.value).toBe('light.png')
    })
  })
})
