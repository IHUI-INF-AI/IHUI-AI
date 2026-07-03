import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { StorageManager, STORAGE_KEYS } from '@/utils/storage'
import { themePerformanceMonitor } from '@/utils/themePerformance'
import { themeHistoryManager } from '@/utils/themeHistory'
import { debounce } from '@/utils/optimization'

export type ThemeMode = 'light' | 'dark' | 'auto' | 'high-contrast-light' | 'high-contrast-dark'
export type ThemeSwitchSource = 'user' | 'system' | 'keyboard' | 'storage' | 'init'

// 主题预设类型:品牌色预设
export type ThemePreset = 'default' | 'blue' | 'green' | 'purple'

const HIGH_CONTRAST_MODES = ['high-contrast-light', 'high-contrast-dark']
const THEME_SWITCH_DEBOUNCE_MS = 100
const THEME_PRESET_STORAGE_KEY = 'theme-preset'

export const useDarkModeStore = defineStore('darkMode', () => {
  // 主题切换加载状态
  const isLoading = ref(false)
  
  // 主题模式：light | dark | auto
  const getInitialThemeMode = (): ThemeMode => {
    if (typeof window === 'undefined') return 'light'
    const saved = StorageManager.getItem<string>(STORAGE_KEYS.DARK_MODE)
    if (saved === 'light' || saved === 'dark' || saved === 'auto' || 
        saved === 'high-contrast-light' || saved === 'high-contrast-dark') {
      return saved
    }
    if (saved === 'true') return 'dark'
    if (saved === 'false') return 'light'
    return 'light'
  }
  const themeMode = ref<ThemeMode>(getInitialThemeMode())

  // 主题预设:品牌色预设 (default | blue | green | purple)
  const getInitialThemePreset = (): ThemePreset => {
    if (typeof window === 'undefined') return 'default'
    const saved = StorageManager.getItem<string>(THEME_PRESET_STORAGE_KEY)
    if (saved === 'default' || saved === 'blue' || saved === 'green' || saved === 'purple') {
      return saved
    }
    return 'default'
  }
  const themePreset = ref<ThemePreset>(getInitialThemePreset())

  // 应用主题预设到 html data-theme 属性
  const applyThemePreset = (preset: ThemePreset) => {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    if (preset === 'default') {
      root.removeAttribute('data-theme')
    } else {
      root.setAttribute('data-theme', preset)
    }
  }

  // 初始化时应用预设
  if (typeof document !== 'undefined') {
    applyThemePreset(themePreset.value)
  }

  // 设置主题预设
  function setThemePreset(preset: ThemePreset) {
    themePreset.value = preset
    applyThemePreset(preset)
    StorageManager.setItem(THEME_PRESET_STORAGE_KEY, preset)
  }

  // 获取系统偏好
  const getSystemPreference = (): boolean => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  }

  // 计算实际暗色模式状态
  const isDarkMode = computed(() => {
    if (themeMode.value === 'auto') {
      return getSystemPreference()
    }
    return themeMode.value === 'dark' || themeMode.value === 'high-contrast-dark'
  })

  const isHighContrast = computed(() => HIGH_CONTRAST_MODES.includes(themeMode.value))

  const darkModeClass = computed(() => {
    if (themeMode.value === 'high-contrast-light') return 'high-contrast-light'
    if (themeMode.value === 'high-contrast-dark') return 'dark high-contrast-dark'
    return isDarkMode.value ? 'dark' : ''
  })

  let darkBgStyleEl: HTMLStyleElement | null = null

  const applyTheme = () => {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    const base = (root.className || '').replace(/\b(?:dark|high-contrast-light|high-contrast-dark)\b/g, '').trim()
    const mode = themeMode.value
    const add = mode === 'high-contrast-light' ? 'high-contrast-light' : mode === 'high-contrast-dark' ? 'dark high-contrast-dark' : isDarkMode.value ? 'dark' : ''
    root.className = add ? (base ? `${base} ${add}` : add) : base
  }

  const applyThemeFromMode = (mode: ThemeMode) => {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    const base = (root.className || '').replace(/\b(?:dark|high-contrast-light|high-contrast-dark)\b/g, '').trim()
    const dark = mode === 'dark' || mode === 'high-contrast-dark' || (mode === 'auto' && getSystemPreference())
    const add = mode === 'high-contrast-light' ? 'high-contrast-light' : mode === 'high-contrast-dark' ? 'dark high-contrast-dark' : dark ? 'dark' : ''
    root.className = add ? (base ? `${base} ${add}` : add) : base
  }
  
  // 防抖版本的主题应用（用于快速切换场景）
  const debouncedApplyTheme = debounce(applyTheme, THEME_SWITCH_DEBOUNCE_MS)

  const DARK_BG_CSS = `
    :where(html.dark), :where(html.dark) html, :where(html.dark) body, :where(html.dark) #app, :where(html.dark) .app-container,
    :where(html.dark) .main-content, :where(html.dark) .page-container, :where(html.dark) .agents-container,
    :where(html.dark) .home-container, :where(html.dark) [class*="container"]:not(.brand-text-container, .app-container, .home-container, .ai-world-page__container, .logo-container, .form-container, .account-form-container, .phone-form-container, .icon-container, .chat-input-container, .prompt-templates-container),
    :where(html.dark) [id*="app"], :where(html.dark) [id*="page"], :where(html.dark) header, :where(html.dark) .glass-header,
    :where(html.dark) main, :where(html.dark) .page-section, :where(html.dark) #first-page, :where(html.dark) #second-page,
    :where(html.dark) #third-page, :where(html.dark) #fourth-page, :where(html.dark) #fifth-page, :where(html.dark) footer,
    :where(html.dark) .footer-container, :where(html.dark) .footer-main, :where(html.dark) .footer-section,
    :where(html.dark) .footer-container::before, :where(html.dark) .footer-main::before, :where(html.dark) .footer-section::before,
    :where(html.dark) footer::before {
      background-color: var(--page-bg-color, var(--el-bg-color));
      background: var(--page-bg-color, var(--el-bg-color));
    }
    :where(html.dark) .floating-chat-dialog-wrapper, :where(html.dark) .floating-chat-dialog-wrapper .el-dialog,
    :where(html.dark) .floating-chat-dialog-wrapper .el-dialog__body {
      background-color: var(--page-bg-color, var(--el-bg-color));
      background: var(--page-bg-color, var(--el-bg-color));
    }
    :where(html.dark) {
      --el-bg-color-page: var(--page-bg-color, var(--el-bg-color));
      --el-bg-color-overlay: var(--page-bg-color, var(--el-bg-color));
      --footer-background: var(--page-bg-color, var(--el-bg-color));
    }
  `
  const ensureDarkBgStyle = () => {
    if (darkBgStyleEl) return
    darkBgStyleEl = document.createElement('style')
    darkBgStyleEl.id = 'force-dark-background-runtime'
    darkBgStyleEl.textContent = DARK_BG_CSS
    document.head.appendChild(darkBgStyleEl)
  }
  if (typeof document !== 'undefined') ensureDarkBgStyle()

  const applyThemeWithTransition = (callback?: () => void) => {
    applyTheme()
    callback?.()
  }

  watch(themeMode, applyTheme, { immediate: true, flush: 'sync' })

  // 监听系统偏好变化（仅在auto模式下）
  let mediaQuery: MediaQueryList | null = null
  let mediaQueryHandler: ((e: MediaQueryListEvent) => void) | null = null

  const setupSystemPreferenceListener = () => {
    if (typeof window === 'undefined') return

    // 清理旧的监听器
    if (mediaQuery && mediaQueryHandler) {
      mediaQuery.removeEventListener('change', mediaQueryHandler)
    }

    // 只在auto模式下监听系统偏好
    if (themeMode.value === 'auto') {
      mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      mediaQueryHandler = (_e: MediaQueryListEvent) => {
        // 系统偏好变化时，如果当前是auto模式，自动更新（使用防抖）
        if (themeMode.value === 'auto') {
          debouncedApplyTheme()
        }
      }
      mediaQuery.addEventListener('change', mediaQueryHandler)
    }
  }

  function setThemeMode(mode: ThemeMode, source: ThemeSwitchSource = 'user', immediate = false) {
    const fromMode = themeMode.value
    const root = typeof document !== 'undefined' ? document.documentElement : null
    if (root) {
      root.classList.add('theme-instant')
      applyThemeFromMode(mode)
    }
    themeMode.value = mode
    const done = () => {
      if (root) root.classList.remove('theme-instant')
      StorageManager.setItem(STORAGE_KEYS.DARK_MODE, mode)
      setupSystemPreferenceListener()
      themePerformanceMonitor.startSwitch(fromMode)
      themeHistoryManager.addEntry(fromMode, mode, source)
      themePerformanceMonitor.endSwitch(mode)
    }
    if (immediate) {
      done()
    } else {
      setTimeout(done, 0)
    }
  }

  function toggleDarkMode() {
    if (themeMode.value === 'auto') {
      setThemeMode('light', 'user', true)
    } else if (themeMode.value === 'light') {
      setThemeMode('dark', 'user', true)
    } else {
      setThemeMode('light', 'user', true)
    }
  }

  // 从存储同步主题模式（纯读，供初始化/导航复用）；即时应用避免首屏延迟
  function syncFromStorage() {
    const saved = StorageManager.getItem(STORAGE_KEYS.DARK_MODE)
    const savedStr = saved == null ? '' : String(saved)
    const normalized = savedStr === 'true' ? 'true' : savedStr === 'false' ? 'false' : savedStr
    if (normalized === 'light' || normalized === 'dark' || normalized === 'auto' ||
        normalized === 'high-contrast-light' || normalized === 'high-contrast-dark') {
      setThemeMode(normalized, 'storage', true)
      return
    }
    if (normalized === 'true') {
      setThemeMode('dark', 'storage', true)
      return
    }
    if (normalized === 'false') {
      setThemeMode('light', 'storage', true)
      return
    }
    setThemeMode('auto', 'storage', true)
  }

  // 验证主题设置是否正确持久化
  function verifyPersistence(): { success: boolean; storedValue: string | null; currentValue: ThemeMode } {
    const storedValue = StorageManager.getItem<string>(STORAGE_KEYS.DARK_MODE)
    const success = storedValue === themeMode.value
    return {
      success,
      storedValue,
      currentValue: themeMode.value
    }
  }

  // 强制同步存储和当前状态
  function forceSync() {
    StorageManager.setItem(STORAGE_KEYS.DARK_MODE, themeMode.value)
    applyTheme()
  }

  // 跨标签页同步：监听 storage 事件
  const setupCrossTabSync = () => {
    if (typeof window === 'undefined') return

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEYS.DARK_MODE) return
      if (event.newValue === null) return

      const newMode = event.newValue as ThemeMode
      const validModes: ThemeMode[] = ['light', 'dark', 'auto', 'high-contrast-light', 'high-contrast-dark']
      if (validModes.includes(newMode)) {
        if (newMode !== themeMode.value) {
          themeMode.value = newMode
          applyTheme()
          setupSystemPreferenceListener()
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }

  // 初始化跨标签页同步
  const cleanupCrossTabSync = setupCrossTabSync()

  return {
    themeMode,
    themePreset,
    isDarkMode,
    isHighContrast,
    darkModeClass,
    isLoading,
    toggleDarkMode,
    setThemeMode,
    setThemePreset,
    syncFromStorage,
    applyThemeWithTransition,
    verifyPersistence,
    forceSync,
    cleanupCrossTabSync,
    getPerformanceReport: () => themePerformanceMonitor.getReport(),
    getPerformanceScore: () => themePerformanceMonitor.getPerformanceScore(),
    clearPerformanceMetrics: () => themePerformanceMonitor.clearMetrics(),
    getHistoryReport: () => themeHistoryManager.getReport(),
    getHistoryEntries: () => themeHistoryManager.getEntries(),
    clearHistory: () => themeHistoryManager.clearHistory(),
  }
}, {
  // P21: 启用 Pinia 持久化插件 (仅持久化 themeMode, 跨标签页同步)
  // 与现有 STORAGE_KEYS.DARK_MODE 双写保持兼容, persist key 为 pinia-darkMode
  persist: {
    paths: ['themeMode'],
    key: 'pinia-darkMode',
    crossTab: true,
    debounce: 200,
  },
})
