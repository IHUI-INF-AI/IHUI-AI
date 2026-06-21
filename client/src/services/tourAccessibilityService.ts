import { StorageManager } from '@/utils/storage'

export interface AccessibilityConfig {
  keyboardNavigation: boolean
  screenReaderSupport: boolean
  highContrastMode: boolean
  reducedMotion: boolean
  focusIndicators: boolean
  ariaLive: boolean
  fontSize: 'normal' | 'large' | 'xlarge'
  colorScheme: 'default' | 'high-contrast' | 'dark-high-contrast'
}

export interface KeyboardShortcut {
  key: string
  modifiers: ('ctrl' | 'alt' | 'shift' | 'meta')[]
  action: string
  description: string
}

export interface AccessibilityAnnouncement {
  message: string
  priority: 'polite' | 'assertive'
  timestamp: number
}

const CONFIG_KEY = 'tour_accessibility_config'
const SHORTCUTS_KEY = 'tour_keyboard_shortcuts'

const DEFAULT_CONFIG: AccessibilityConfig = {
  keyboardNavigation: true,
  screenReaderSupport: true,
  highContrastMode: false,
  reducedMotion: false,
  focusIndicators: true,
  ariaLive: true,
  fontSize: 'normal',
  colorScheme: 'default',
}

const DEFAULT_SHORTCUTS: KeyboardShortcut[] = [
  { key: 'ArrowRight', modifiers: [], action: 'next', description: '下一步' },
  { key: 'ArrowLeft', modifiers: [], action: 'prev', description: '上一步' },
  { key: 'Enter', modifiers: [], action: 'confirm', description: '确认' },
  { key: 'Escape', modifiers: [], action: 'skip', description: '跳过' },
  { key: 'Tab', modifiers: [], action: 'focusNext', description: '下一个焦点' },
  { key: 'Tab', modifiers: ['shift'], action: 'focusPrev', description: '上一个焦点' },
  { key: 'h', modifiers: [], action: 'help', description: '帮助' },
  { key: 'r', modifiers: [], action: 'restart', description: '重新开始' },
]

class TourAccessibilityService {
  private config: AccessibilityConfig
  private shortcuts: KeyboardShortcut[]
  private liveRegion: HTMLElement | null = null
  private focusStack: HTMLElement[] = []
  private announcementQueue: AccessibilityAnnouncement[] = []
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null
  private actionHandlers: Map<string, () => void> = new Map()

  constructor() {
    this.config = this.loadConfig()
    this.shortcuts = this.loadShortcuts()
  }

  private loadConfig(): AccessibilityConfig {
    const stored = StorageManager.getItem<AccessibilityConfig>(CONFIG_KEY)
    return stored ? { ...DEFAULT_CONFIG, ...stored } : DEFAULT_CONFIG
  }

  private saveConfig(): void {
    StorageManager.setItem(CONFIG_KEY, this.config)
  }

  private loadShortcuts(): KeyboardShortcut[] {
    const stored = StorageManager.getItem<KeyboardShortcut[]>(SHORTCUTS_KEY)
    return stored || DEFAULT_SHORTCUTS
  }

  private saveShortcuts(): void {
    StorageManager.setItem(SHORTCUTS_KEY, this.shortcuts)
  }

  configure(config: Partial<AccessibilityConfig>): void {
    this.config = { ...this.config, ...config }
    this.saveConfig()
    this.applyConfig()
  }

  getConfig(): AccessibilityConfig {
    return { ...this.config }
  }

  private applyConfig(): void {
    const root = document.documentElement

    if (this.config.highContrastMode) {
      root.classList.add('tour-high-contrast')
    } else {
      root.classList.remove('tour-high-contrast')
    }

    if (this.config.reducedMotion) {
      root.classList.add('tour-reduced-motion')
    } else {
      root.classList.remove('tour-reduced-motion')
    }

    root.setAttribute('data-tour-font-size', this.config.fontSize)
    root.setAttribute('data-tour-color-scheme', this.config.colorScheme)
  }

  initialize(): void {
    this.createLiveRegion()
    this.setupKeyboardNavigation()
    this.applyConfig()
  }

  private createLiveRegion(): void {
    if (!this.config.ariaLive) return

    this.liveRegion = document.createElement('div')
    this.liveRegion.setAttribute('role', 'status')
    this.liveRegion.setAttribute('aria-live', 'polite')
    this.liveRegion.setAttribute('aria-atomic', 'true')
    this.liveRegion.className = 'tour-sr-only'
    this.liveRegion.style.cssText = `
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    `
    document.body.appendChild(this.liveRegion)
  }

  private setupKeyboardNavigation(): void {
    if (!this.config.keyboardNavigation) return

    this.keydownHandler = (e: KeyboardEvent) => {
      const shortcut = this.findShortcut(e)
      if (shortcut) {
        e.preventDefault()
        this.executeAction(shortcut.action)
      }
    }

    document.addEventListener('keydown', this.keydownHandler)
  }

  private findShortcut(e: KeyboardEvent): KeyboardShortcut | undefined {
    return this.shortcuts.find(s => {
      if (s.key.toLowerCase() !== e.key.toLowerCase()) return false

      const hasCtrl = s.modifiers.includes('ctrl')
      const hasAlt = s.modifiers.includes('alt')
      const hasShift = s.modifiers.includes('shift')
      const hasMeta = s.modifiers.includes('meta')

      return (
        e.ctrlKey === hasCtrl &&
        e.altKey === hasAlt &&
        e.shiftKey === hasShift &&
        e.metaKey === hasMeta
      )
    })
  }

  private executeAction(action: string): void {
    const handler = this.actionHandlers.get(action)
    if (handler) {
      handler()
    }
  }

  registerAction(action: string, handler: () => void): void {
    this.actionHandlers.set(action, handler)
  }

  unregisterAction(action: string): void {
    this.actionHandlers.delete(action)
  }

  getShortcuts(): KeyboardShortcut[] {
    return [...this.shortcuts]
  }

  updateShortcut(action: string, shortcut: Partial<KeyboardShortcut>): boolean {
    const index = this.shortcuts.findIndex(s => s.action === action)
    if (index === -1) return false

    this.shortcuts[index] = { ...this.shortcuts[index], ...shortcut }
    this.saveShortcuts()
    return true
  }

  announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    if (!this.config.screenReaderSupport || !this.liveRegion) return

    const announcement: AccessibilityAnnouncement = {
      message,
      priority,
      timestamp: Date.now(),
    }

    this.announcementQueue.push(announcement)
    this.processAnnouncementQueue()
  }

  private processAnnouncementQueue(): void {
    if (!this.liveRegion || this.announcementQueue.length === 0) return

    const announcement = this.announcementQueue.shift()!
    this.liveRegion.setAttribute('aria-live', announcement.priority)
    this.liveRegion.textContent = announcement.message

    setTimeout(() => {
      if (this.liveRegion) {
        this.liveRegion.textContent = ''
      }
      this.processAnnouncementQueue()
    }, 1000)
  }

  pushFocus(element: HTMLElement): void {
    this.focusStack.push(element)
    element.focus()
  }

  popFocus(): void {
    this.focusStack.pop()
    const previousElement = this.focusStack[this.focusStack.length - 1]
    if (previousElement) {
      previousElement.focus()
    }
  }

  trapFocus(container: HTMLElement): () => void {
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault()
          lastElement?.focus()
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault()
          firstElement?.focus()
        }
      }
    }

    container.addEventListener('keydown', handleTabKey)
    firstElement?.focus()

    return () => {
      container.removeEventListener('keydown', handleTabKey)
    }
  }

  getHighContrastStyles(): Record<string, string> {
    if (!this.config.highContrastMode) return {}

    return {
      backgroundColor: 'var(--el-text-color-primary)',
      color: 'var(--el-bg-color)',
      borderColor: 'var(--el-bg-color)',
      outline: '2px solid var(--el-bg-color)',
    }
  }

  getFocusIndicatorStyles(): Record<string, string> {
    if (!this.config.focusIndicators) return {}

    return {
      outline: '3px solid var(--el-text-color-primary)',
      outlineOffset: '2px',
    }
  }

  getReducedMotionStyles(): Record<string, string> {
    if (!this.config.reducedMotion) return {}

    return {
      transition: 'none',
      animation: 'none',
    }
  }

  getFontSizeStyles(): Record<string, string> {
    switch (this.config.fontSize) {
      case 'large':
        return { fontSize: '18px' }
      case 'xlarge':
        return { fontSize: '22px' }
      default:
        return {}
    }
  }

  generateAriaLabel(step: { title: string; content: string; current?: number; total?: number }): string {
    let label = step.title
    
    if (step.current !== undefined && step.total !== undefined) {
      label = `步骤 ${step.current} / ${step.total}: ${label}`
    }
    
    label += `. ${step.content}`
    
    return label
  }

  generateAriaDescribedBy(content: string): string {
    const id = `tour-desc-${Date.now()}`
    const descElement = document.createElement('div')
    descElement.id = id
    descElement.className = 'tour-sr-only'
    descElement.textContent = content
    descElement.style.cssText = `
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    `
    document.body.appendChild(descElement)
    
    return id
  }

  removeAriaDescribedBy(id: string): void {
    const element = document.getElementById(id)
    if (element) {
      element.remove()
    }
  }

  destroy(): void {
    if (this.keydownHandler) {
      document.removeEventListener('keydown', this.keydownHandler)
    }

    if (this.liveRegion) {
      this.liveRegion.remove()
      this.liveRegion = null
    }

    this.focusStack = []
    this.announcementQueue = []
    this.actionHandlers.clear()
  }

  detectUserPreferences(): Partial<AccessibilityConfig> {
    const preferences: Partial<AccessibilityConfig> = {}

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      preferences.reducedMotion = true
    }

    if (window.matchMedia('(prefers-contrast: more)').matches) {
      preferences.highContrastMode = true
    }

    if (window.matchMedia('(forced-colors: active)').matches) {
      preferences.highContrastMode = true
    }

    return preferences
  }

  applyDetectedPreferences(): void {
    const detected = this.detectUserPreferences()
    this.configure(detected)
  }

  getAccessibilityScore(): {
    score: number
    issues: string[]
    recommendations: string[]
  } {
    const issues: string[] = []
    const recommendations: string[] = []
    let score = 100

    if (!this.config.keyboardNavigation) {
      issues.push('键盘导航未启用')
      score -= 20
    }

    if (!this.config.screenReaderSupport) {
      issues.push('屏幕阅读器支持未启用')
      score -= 20
    }

    if (!this.config.focusIndicators) {
      issues.push('焦点指示器未启用')
      score -= 15
    }

    if (!this.config.ariaLive) {
      issues.push('ARIA实时区域未启用')
      score -= 10
    }

    if (this.config.fontSize === 'normal') {
      recommendations.push('考虑为视力不佳的用户提供更大的字体选项')
    }

    if (!this.config.highContrastMode) {
      recommendations.push('考虑为需要高对比度的用户提供支持')
    }

    return {
      score: Math.max(0, score),
      issues,
      recommendations,
    }
  }
}

export const tourAccessibilityService = new TourAccessibilityService()
