import type { ThemeMode } from '@/stores/darkMode'
import { logger } from './logger'

type SpeechRecognitionLike = {
  start: () => void
  stop: () => void
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: any) => void) | null
  onerror: ((event: any) => void) | null
  onend: (() => void) | null
}

type SpeechRecognitionConstructor = {
  new (): SpeechRecognitionLike
}

export interface AccessibilityConfig {
  announceChanges: boolean
  announceMode: 'polite' | 'assertive'
  enableVoiceControl: boolean
  enableKeyboardNavigation: boolean
  focusIndicator: 'default' | 'high-contrast' | 'large'
  reducedMotion: boolean
  highContrastEnhancements: boolean
}

export interface VoiceCommand {
  command: string
  aliases: string[]
  action: () => void
  description: string
}

type AccessibilityListener = (mode: ThemeMode, source: string) => void

const DEFAULT_CONFIG: AccessibilityConfig = {
  announceChanges: true,
  announceMode: 'polite',
  enableVoiceControl: false,
  enableKeyboardNavigation: true,
  focusIndicator: 'default',
  reducedMotion: false,
  highContrastEnhancements: false
}

const THEME_MODE_NAMES: Record<ThemeMode, string> = {
  'light': '亮色模式',
  'dark': '暗色模式',
  'auto': '自动模式',
  'high-contrast-light': '高对比度亮色模式',
  'high-contrast-dark': '高对比度暗色模式'
}

class ThemeAccessibilityService {
  private config: AccessibilityConfig = DEFAULT_CONFIG
  private listeners: Set<AccessibilityListener> = new Set()
  private announcerElement: HTMLElement | null = null
  private recognition: SpeechRecognitionLike | null = null
  private voiceCommands: VoiceCommand[] = []
  private isListening: boolean = false
  private reducedMotionMql: MediaQueryList | null = null
  private reducedMotionHandler: ((e: MediaQueryListEvent) => void) | null = null
  private highContrastMql: MediaQueryList | null = null
  private highContrastHandler: ((e: MediaQueryListEvent) => void) | null = null

  constructor() {
    if (typeof window !== 'undefined') {
      this.checkReducedMotion()
      this.checkHighContrast()
    }
  }

  private checkReducedMotion(): void {
    if (typeof window === 'undefined') return
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    this.config.reducedMotion = prefersReducedMotion

    this.reducedMotionMql = window.matchMedia('(prefers-reduced-motion: reduce)')
    this.reducedMotionHandler = (e: MediaQueryListEvent) => {
      this.config.reducedMotion = e.matches
    }
    this.reducedMotionMql.addEventListener('change', this.reducedMotionHandler)
  }

  private checkHighContrast(): void {
    if (typeof window === 'undefined') return
    const prefersHighContrast = window.matchMedia('(prefers-contrast: more)').matches
    this.config.highContrastEnhancements = prefersHighContrast

    this.highContrastMql = window.matchMedia('(prefers-contrast: more)')
    this.highContrastHandler = (e: MediaQueryListEvent) => {
      this.config.highContrastEnhancements = e.matches
    }
    this.highContrastMql.addEventListener('change', this.highContrastHandler)
  }

  setConfig(config: Partial<AccessibilityConfig>): void {
    this.config = { ...this.config, ...config }
  }

  getConfig(): AccessibilityConfig {
    return { ...this.config }
  }

  subscribe(listener: AccessibilityListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notifyListeners(mode: ThemeMode, source: string): void {
    this.listeners.forEach(listener => {
      try {
        listener(mode, source)
      } catch {
        // Ignore listener errors
      }
    })
  }

  initAnnouncer(): void {
    if (typeof window === 'undefined') return
    if (this.announcerElement) return

    this.announcerElement = document.createElement('div')
    this.announcerElement.setAttribute('role', 'status')
    this.announcerElement.setAttribute('aria-live', this.config.announceMode)
    this.announcerElement.setAttribute('aria-atomic', 'true')
    this.announcerElement.className = 'theme-announcer sr-only'
    this.announcerElement.style.cssText = `
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
    document.body.appendChild(this.announcerElement)
  }

  announce(message: string): void {
    if (!this.config.announceChanges) return
    if (!this.announcerElement) this.initAnnouncer()

    if (this.announcerElement) {
      this.announcerElement.textContent = ''
      setTimeout(() => {
        if (this.announcerElement) {
          this.announcerElement.textContent = message
        }
      }, 100)
    }
  }

  announceThemeChange(mode: ThemeMode): void {
    const modeName = THEME_MODE_NAMES[mode]
    this.announce(`主题已切换为${modeName}`)
  }

  registerVoiceCommand(command: VoiceCommand): void {
    this.voiceCommands.push(command)
  }

  startVoiceControl(): Promise<boolean> {
    if (typeof window === 'undefined') return Promise.resolve(false)

    const SpeechRecognitionAPI = (window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }).SpeechRecognition || 
      (window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition
    if (!SpeechRecognitionAPI) {
      logger.warn('Speech recognition not supported')
      return Promise.resolve(false)
    }

    this.recognition = new SpeechRecognitionAPI()
    this.recognition.continuous = true
    this.recognition.interimResults = false
    this.recognition.lang = 'zh-CN'

    this.recognition.onresult = (event: any) => {
      const results = (event as { results: { length: number; [key: number]: { [key: number]: { transcript: string } } } }).results
      const last = results.length - 1
      const transcript = results[last][0].transcript.trim().toLowerCase()

      for (const cmd of this.voiceCommands) {
        if (transcript.includes(cmd.command.toLowerCase()) ||
            cmd.aliases.some(alias => transcript.includes(alias.toLowerCase()))) {
          cmd.action()
          this.announce(`已执行: ${cmd.description}`)
          break
        }
      }
    }

    this.recognition.onerror = (event: any) => {
      logger.error('Speech recognition error:', (event as { error: string }).error)
      this.isListening = false
    }

    this.recognition.onend = () => {
      if (this.isListening) {
        this.recognition?.start()
      }
    }

    return new Promise((resolve) => {
      this.recognition?.start()
      this.isListening = true
      resolve(true)
    })
  }

  stopVoiceControl(): void {
    if (this.recognition) {
      this.isListening = false
      this.recognition.stop()
    }
  }

  isVoiceControlActive(): boolean {
    return this.isListening
  }

  setupKeyboardNavigation(element: HTMLElement, onActivate: () => void): () => void {
    const handleKeydown = (event: KeyboardEvent) => {
      if (!this.config.enableKeyboardNavigation) return

      switch (event.key) {
        case 'Enter':
        case ' ':
          event.preventDefault()
          onActivate()
          break
        case 'ArrowUp':
        case 'ArrowRight':
          event.preventDefault()
          this.announce('下一个主题')
          break
        case 'ArrowDown':
        case 'ArrowLeft':
          event.preventDefault()
          this.announce('上一个主题')
          break
      }
    }

    element.addEventListener('keydown', handleKeydown)
    return () => element.removeEventListener('keydown', handleKeydown)
  }

  applyFocusIndicator(element: HTMLElement): void {
    const indicators: Record<string, string> = {
      'default': '2px solid var(--el-color-primary)',
      'high-contrast': '3px solid currentColor',
      'large': '4px solid var(--el-color-primary), 0 0 0 2px var(--el-color-primary-light-5)'
    }

    element.style.outline = indicators[this.config.focusIndicator] || indicators['default']
    element.style.outlineOffset = '2px'
  }

  getReducedMotion(): boolean {
    return this.config.reducedMotion
  }

  getHighContrastEnhancements(): boolean {
    return this.config.highContrastEnhancements
  }

  applyAccessibilityStyles(): void {
    if (typeof window === 'undefined') return

    const root = document.documentElement

    if (this.config.reducedMotion) {
      root.style.setProperty('--theme-transition-duration', '0ms')
    } else {
      root.style.removeProperty('--theme-transition-duration')
    }

    if (this.config.highContrastEnhancements) {
      root.style.setProperty('--theme-focus-width', '3px')
      root.style.setProperty('--theme-focus-style', 'solid')
    } else {
      root.style.removeProperty('--theme-focus-width')
      root.style.removeProperty('--theme-focus-style')
    }
  }

  generateA11yReport(): {
    issues: string[]
    recommendations: string[]
    score: number
  } {
    const issues: string[] = []
    const recommendations: string[] = []
    let score = 100

    if (!this.config.announceChanges) {
      issues.push('主题切换通知未启用')
      recommendations.push('启用主题切换通知以支持屏幕阅读器用户')
      score -= 10
    }

    if (!this.config.enableKeyboardNavigation) {
      issues.push('键盘导航未启用')
      recommendations.push('启用键盘导航以支持键盘用户')
      score -= 15
    }

    if (this.config.reducedMotion && !this.checkReducedMotionStyles()) {
      issues.push('减少动画偏好未正确应用')
      recommendations.push('确保所有动画都尊重 prefers-reduced-motion 设置')
      score -= 10
    }

    return {
      issues,
      recommendations,
      score: Math.max(0, score)
    }
  }

  private checkReducedMotionStyles(): boolean {
    if (typeof window === 'undefined') return true
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!prefersReducedMotion) return true

    const root = document.documentElement
    const transitionDuration = getComputedStyle(root).transitionDuration
    return transitionDuration === '0s' || transitionDuration === '0ms'
  }

  destroy(): void {
    this.stopVoiceControl()
    if (this.announcerElement && this.announcerElement.parentNode) {
      this.announcerElement.parentNode.removeChild(this.announcerElement)
      this.announcerElement = null
    }
    this.listeners.clear()
    if (this.reducedMotionMql && this.reducedMotionHandler) {
      this.reducedMotionMql.removeEventListener('change', this.reducedMotionHandler)
      this.reducedMotionMql = null
      this.reducedMotionHandler = null
    }
    if (this.highContrastMql && this.highContrastHandler) {
      this.highContrastMql.removeEventListener('change', this.highContrastHandler)
      this.highContrastMql = null
      this.highContrastHandler = null
    }
  }
}

export const themeAccessibility = new ThemeAccessibilityService()
