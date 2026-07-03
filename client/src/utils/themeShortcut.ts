import { useDarkModeStore, type ThemeMode } from '@/stores/darkMode'
import { logger } from '@/utils/logger'

const THEME_SHORTCUT_KEY = 't'

const THEME_CYCLE_ORDER: ThemeMode[] = [
  'light',
  'dark',
  'auto',
  'high-contrast-light',
  'high-contrast-dark'
]

const THEME_I18N_KEYS: Record<ThemeMode, string> = {
  'light': 'themeToggle.lightMode',
  'dark': 'themeToggle.darkMode',
  'auto': 'themeToggle.autoMode',
  'high-contrast-light': 'themeToggle.highContrastLight',
  'high-contrast-dark': 'themeToggle.highContrastDark'
}

let isInitialized = false
let keydownHandler: ((event: KeyboardEvent) => void) | null = null

function getNextTheme(currentMode: ThemeMode): ThemeMode {
  const currentIndex = THEME_CYCLE_ORDER.indexOf(currentMode)
  const nextIndex = (currentIndex + 1) % THEME_CYCLE_ORDER.length
  return THEME_CYCLE_ORDER[nextIndex]
}

function getI18nTranslation(key: string): string {
  try {
    const i18n = (window as unknown as { __VUE_I18N__?: { global?: { t?: (k: string) => string } } }).__VUE_I18N__
    if (i18n?.global?.t) {
      return i18n.global.t(key)
    }
  } catch {
    // i18n not available, use fallback
  }
  const fallbacks: Record<string, string> = {
    'themeToggle.lightMode': 'Light Mode',
    'themeToggle.darkMode': 'Dark Mode',
    'themeToggle.autoMode': 'Follow System',
    'themeToggle.highContrastLight': 'High Contrast Light',
    'themeToggle.highContrastDark': 'High Contrast Dark',
    'themeToggle.themeChanged': 'Theme Changed'
  }
  return fallbacks[key] || key
}

function handleThemeShortcut(event: KeyboardEvent): void {
  const isCtrlPressed = event.ctrlKey || event.metaKey
  const isShiftPressed = event.shiftKey
  const isCorrectKey = event.key.toLowerCase() === THEME_SHORTCUT_KEY

  if (isCtrlPressed && isShiftPressed && isCorrectKey) {
    event.preventDefault()
    event.stopPropagation()

    try {
      const darkModeStore = useDarkModeStore()
      const currentMode = darkModeStore.themeMode
      const nextMode = getNextTheme(currentMode)

      darkModeStore.setThemeMode(nextMode, 'keyboard', true)

      logger.info(`[ThemeShortcut] Theme switched via keyboard: ${currentMode} -> ${nextMode}`)

      showThemeChangeNotification(nextMode)
    } catch (error) {
      logger.error('[ThemeShortcut] Failed to switch theme:', error)
    }
  }
}

function showThemeChangeNotification(mode: ThemeMode): void {
  const modeName = getI18nTranslation(THEME_I18N_KEYS[mode])

  const notification = document.createElement('div')
  notification.className = 'theme-shortcut-notification'
  notification.textContent = modeName
  notification.setAttribute('role', 'status')
  notification.setAttribute('aria-live', 'polite')

  document.body.appendChild(notification)

  requestAnimationFrame(() => {
    notification.classList.add('show')
  })

  setTimeout(() => {
    notification.classList.remove('show')
    setTimeout(() => {
      notification.remove()
    }, 300)
  }, 1500)
}

function addNotificationStyles(): void {
  if (document.getElementById('theme-shortcut-notification-styles')) {
    return
  }

  const style = document.createElement('style')
  style.id = 'theme-shortcut-notification-styles'
  style.textContent = `
    .theme-shortcut-notification {
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%) translateY(20px);
      padding: 12px 24px;
      background: var(--el-bg-color-overlay, var(--color-black-80));
      color: var(--el-text-color-primary, var(--el-bg-color));
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 12px var(--color-black-15);
      opacity: 0;
      transition: opacity 0.3s ease, transform 0.3s ease;
      z-index: var(--z-notification);
      pointer-events: none;
    }

    .theme-shortcut-notification.show {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }

    html.dark .theme-shortcut-notification {
      background: var(--color-white-90);
      color: var(--el-text-color-primary);
    }

    html.high-contrast-light .theme-shortcut-notification {
      background: var(--el-text-color-primary);
      color: var(--app-button-text-on-primary);
      border: 2px solid var(--el-text-color-primary);
    }

    html.high-contrast-dark .theme-shortcut-notification {
      background: var(--el-bg-color);
      color: var(--el-text-color-primary);
      border: 2px solid var(--el-bg-color);
    }
  `
  document.head.appendChild(style)
}

export function initThemeShortcut(): () => void {
  if (isInitialized) {
    logger.warn('[ThemeShortcut] Already initialized')
    return () => {}
  }

  if (typeof window === 'undefined') {
    return () => {}
  }

  addNotificationStyles()

  keydownHandler = handleThemeShortcut
  window.addEventListener('keydown', keydownHandler)

  isInitialized = true
  logger.info('[ThemeShortcut] Initialized. Press Ctrl+Shift+T to cycle themes.')

  return () => {
    if (keydownHandler) {
      window.removeEventListener('keydown', keydownHandler)
      keydownHandler = null
    }
    isInitialized = false
  }
}
