import { useDarkModeStore, type ThemeMode } from '@/stores/darkMode'
import { logger } from '@/utils/logger'

export interface ThemeShortcut {
  id: string
  key: string
  modifiers: ('ctrl' | 'alt' | 'shift' | 'meta')[]
  action: ThemeShortcutAction
  description: string
  descriptionEn: string
  enabled: boolean
}

export type ThemeShortcutAction =
  | 'toggle-dark'
  | 'cycle-theme'
  | 'set-light'
  | 'set-dark'
  | 'set-auto'
  | 'set-high-contrast-light'
  | 'set-high-contrast-dark'
  | 'toggle-high-contrast'

type ThemeActionHandler = () => void

const STORAGE_KEY = 'theme-shortcuts-config'

const DEFAULT_SHORTCUTS: ThemeShortcut[] = [
  {
    id: 'toggle-dark',
    key: 'd',
    modifiers: ['ctrl', 'shift'],
    action: 'toggle-dark',
    description: '切换暗色模式',
    descriptionEn: 'Toggle Dark Mode',
    enabled: true
  },
  {
    id: 'cycle-theme',
    key: 't',
    modifiers: ['ctrl', 'shift'],
    action: 'cycle-theme',
    description: '循环切换主题',
    descriptionEn: 'Cycle Theme',
    enabled: true
  },
  {
    id: 'set-light',
    key: '1',
    modifiers: ['alt'],
    action: 'set-light',
    description: '切换到亮色模式',
    descriptionEn: 'Set Light Mode',
    enabled: true
  },
  {
    id: 'set-dark',
    key: '2',
    modifiers: ['alt'],
    action: 'set-dark',
    description: '切换到暗色模式',
    descriptionEn: 'Set Dark Mode',
    enabled: true
  },
  {
    id: 'set-auto',
    key: '3',
    modifiers: ['alt'],
    action: 'set-auto',
    description: '切换到自动模式',
    descriptionEn: 'Set Auto Mode',
    enabled: true
  },
  {
    id: 'toggle-high-contrast',
    key: 'h',
    modifiers: ['ctrl', 'shift'],
    action: 'toggle-high-contrast',
    description: '切换高对比度模式',
    descriptionEn: 'Toggle High Contrast',
    enabled: true
  }
]

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

class ThemeShortcutManager {
  private shortcuts: ThemeShortcut[] = []
  private isInitialized: boolean = false
  private keydownHandler: ((event: KeyboardEvent) => void) | null = null
  private actionHandlers: Map<ThemeShortcutAction, ThemeActionHandler> = new Map()
  private notificationCallback: ((message: string) => void) | null = null

  constructor() {
    this.shortcuts = this.loadShortcuts()
    this.registerDefaultHandlers()
  }

  private loadShortcuts(): ThemeShortcut[] {
    if (typeof window === 'undefined') {
      return [...DEFAULT_SHORTCUTS]
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        return this.mergeWithDefaults(parsed)
      }
    } catch {
      // ignore
    }
    return [...DEFAULT_SHORTCUTS]
  }

  private mergeWithDefaults(stored: ThemeShortcut[]): ThemeShortcut[] {
    const merged = [...DEFAULT_SHORTCUTS]
    stored.forEach(storedShortcut => {
      const index = merged.findIndex(s => s.id === storedShortcut.id)
      if (index > -1) {
        merged[index] = { ...merged[index], ...storedShortcut }
      }
    })
    return merged
  }

  private saveShortcuts(): void {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.shortcuts))
    } catch {
      // ignore
    }
  }

  private registerDefaultHandlers(): void {
    this.actionHandlers.set('toggle-dark', () => {
      const store = useDarkModeStore()
      const isDark = store.themeMode === 'dark' || store.themeMode === 'high-contrast-dark'
      const newMode: ThemeMode = isDark ? 'light' : 'dark'
      store.setThemeMode(newMode, 'keyboard', true)
      this.showNotification(newMode)
    })

    this.actionHandlers.set('cycle-theme', () => {
      const store = useDarkModeStore()
      const currentIndex = THEME_CYCLE_ORDER.indexOf(store.themeMode)
      const nextIndex = (currentIndex + 1) % THEME_CYCLE_ORDER.length
      const nextMode = THEME_CYCLE_ORDER[nextIndex]
      store.setThemeMode(nextMode, 'keyboard', true)
      this.showNotification(nextMode)
    })

    this.actionHandlers.set('set-light', () => {
      const store = useDarkModeStore()
      store.setThemeMode('light', 'keyboard', true)
      this.showNotification('light')
    })

    this.actionHandlers.set('set-dark', () => {
      const store = useDarkModeStore()
      store.setThemeMode('dark', 'keyboard', true)
      this.showNotification('dark')
    })

    this.actionHandlers.set('set-auto', () => {
      const store = useDarkModeStore()
      store.setThemeMode('auto', 'keyboard', true)
      this.showNotification('auto')
    })

    this.actionHandlers.set('set-high-contrast-light', () => {
      const store = useDarkModeStore()
      store.setThemeMode('high-contrast-light', 'keyboard', true)
      this.showNotification('high-contrast-light')
    })

    this.actionHandlers.set('set-high-contrast-dark', () => {
      const store = useDarkModeStore()
      store.setThemeMode('high-contrast-dark', 'keyboard', true)
      this.showNotification('high-contrast-dark')
    })

    this.actionHandlers.set('toggle-high-contrast', () => {
      const store = useDarkModeStore()
      const isHighContrast = store.themeMode.includes('high-contrast')
      let newMode: ThemeMode
      if (isHighContrast) {
        newMode = store.themeMode === 'high-contrast-light' ? 'light' : 'dark'
      } else {
        newMode = store.themeMode === 'dark' ? 'high-contrast-dark' : 'high-contrast-light'
      }
      store.setThemeMode(newMode, 'keyboard', true)
      this.showNotification(newMode)
    })
  }

  private showNotification(mode: ThemeMode): void {
    const message = this.getModeName(mode)
    if (this.notificationCallback) {
      this.notificationCallback(message)
    } else {
      this.showDefaultNotification(message)
    }
  }

  private getModeName(mode: ThemeMode): string {
    try {
      const i18n = (window as unknown as { __VUE_I18N__?: { global?: { t?: (k: string) => string } } }).__VUE_I18N__
      if (i18n?.global?.t) {
        return i18n.global.t(THEME_I18N_KEYS[mode])
      }
    } catch {
      // ignore
    }
    const fallbacks: Record<ThemeMode, string> = {
      'light': 'Light Mode',
      'dark': 'Dark Mode',
      'auto': 'Follow System',
      'high-contrast-light': 'High Contrast Light',
      'high-contrast-dark': 'High Contrast Dark'
    }
    return fallbacks[mode] || mode
  }

  private showDefaultNotification(message: string): void {
    const notification = document.createElement('div')
    notification.className = 'theme-shortcut-notification'
    notification.textContent = message
    notification.setAttribute('role', 'status')
    notification.setAttribute('aria-live', 'polite')

    document.body.appendChild(notification)

    requestAnimationFrame(() => {
      notification.classList.add('show')
    })

    setTimeout(() => {
      notification.classList.remove('show')
      setTimeout(() => notification.remove(), 300)
    }, 1500)
  }

  private handleKeydown = (event: KeyboardEvent): void => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return
    }

    for (const shortcut of this.shortcuts) {
      if (!shortcut.enabled) continue

      const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase()
      const ctrlMatch = shortcut.modifiers.includes('ctrl') ? (event.ctrlKey || event.metaKey) : true
      const altMatch = shortcut.modifiers.includes('alt') ? event.altKey : !event.altKey
      const shiftMatch = shortcut.modifiers.includes('shift') ? event.shiftKey : !event.shiftKey
      const metaOnly = shortcut.modifiers.includes('meta') && !shortcut.modifiers.includes('ctrl')
        ? event.metaKey && !event.ctrlKey
        : true

      if (keyMatch && ctrlMatch && altMatch && shiftMatch && metaOnly) {
        event.preventDefault()
        event.stopPropagation()

        const handler = this.actionHandlers.get(shortcut.action)
        if (handler) {
          try {
            handler()
            logger.info(`[ThemeShortcut] Executed action: ${shortcut.action}`)
          } catch (error) {
            logger.error(`[ThemeShortcut] Failed to execute action: ${shortcut.action}`, error)
          }
        }
        return
      }
    }
  }

  init(): () => void {
    if (this.isInitialized) {
      return () => {}
    }

    if (typeof window === 'undefined') {
      return () => {}
    }

    this.addNotificationStyles()

    this.keydownHandler = this.handleKeydown
    window.addEventListener('keydown', this.keydownHandler)

    this.isInitialized = true
    logger.info('[ThemeShortcut] Initialized with shortcuts:', this.shortcuts.filter(s => s.enabled).length)

    return () => {
      if (this.keydownHandler) {
        window.removeEventListener('keydown', this.keydownHandler)
        this.keydownHandler = null
      }
      this.isInitialized = false
    }
  }

  private addNotificationStyles(): void {
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
        color: var(--el-bg-color);
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

  getShortcuts(): ThemeShortcut[] {
    return [...this.shortcuts]
  }

  getShortcut(id: string): ThemeShortcut | undefined {
    return this.shortcuts.find(s => s.id === id)
  }

  updateShortcut(id: string, updates: Partial<ThemeShortcut>): boolean {
    const index = this.shortcuts.findIndex(s => s.id === id)
    if (index === -1) return false

    this.shortcuts[index] = { ...this.shortcuts[index], ...updates }
    this.saveShortcuts()
    return true
  }

  enableShortcut(id: string): boolean {
    return this.updateShortcut(id, { enabled: true })
  }

  disableShortcut(id: string): boolean {
    return this.updateShortcut(id, { enabled: false })
  }

  toggleShortcut(id: string): boolean {
    const shortcut = this.getShortcut(id)
    if (!shortcut) return false
    return this.updateShortcut(id, { enabled: !shortcut.enabled })
  }

  resetShortcuts(): void {
    this.shortcuts = [...DEFAULT_SHORTCUTS]
    this.saveShortcuts()
  }

  isInitializedStatus(): boolean {
    return this.isInitialized
  }

  setNotificationCallback(callback: ((message: string) => void) | null): void {
    this.notificationCallback = callback
  }

  formatShortcut(shortcut: ThemeShortcut): string {
    const parts: string[] = []
    if (shortcut.modifiers.includes('ctrl')) parts.push('Ctrl')
    if (shortcut.modifiers.includes('alt')) parts.push('Alt')
    if (shortcut.modifiers.includes('shift')) parts.push('Shift')
    if (shortcut.modifiers.includes('meta')) parts.push('⌘')
    parts.push(shortcut.key.toUpperCase())
    return parts.join(' + ')
  }

  checkConflict(newShortcut: Omit<ThemeShortcut, 'id'>): ThemeShortcut | null {
    for (const existing of this.shortcuts) {
      if (!existing.enabled) continue

      const sameKey = existing.key.toLowerCase() === newShortcut.key.toLowerCase()
      const sameModifiers =
        existing.modifiers.length === newShortcut.modifiers.length &&
        existing.modifiers.every(m => newShortcut.modifiers.includes(m))

      if (sameKey && sameModifiers) {
        return existing
      }
    }
    return null
  }

  registerAction(action: ThemeShortcutAction, handler: ThemeActionHandler): void {
    this.actionHandlers.set(action, handler)
  }

  unregisterAction(action: ThemeShortcutAction): void {
    this.actionHandlers.delete(action)
  }
}

export const themeShortcutManager = new ThemeShortcutManager()

export function initThemeShortcut(): () => void {
  return themeShortcutManager.init()
}

export function getThemeShortcutInfo(): { key: string; modifiers: string[] } {
  const shortcut = themeShortcutManager.getShortcut('cycle-theme')
  if (shortcut) {
    return {
      key: shortcut.key.toUpperCase(),
      modifiers: shortcut.modifiers
    }
  }
  return { key: 'T', modifiers: ['ctrl', 'shift'] }
}

export function isThemeShortcutInitialized(): boolean {
  return themeShortcutManager.isInitializedStatus()
}
