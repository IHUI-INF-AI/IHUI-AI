export type ThemeTransitionType = 'fade' | 'slide' | 'zoom' | 'flip' | 'ripple' | 'none'

export type ThemeTransitionDirection = 'left' | 'right' | 'up' | 'down' | 'center'

export type ThemeTransitionSpeed = 'slow' | 'normal' | 'fast' | 'instant'

export interface ThemeTransitionConfig {
  type: ThemeTransitionType
  direction: ThemeTransitionDirection
  speed: ThemeTransitionSpeed
  duration: number
  easing: string
  enableOverlay: boolean
  overlayColor?: string
}

export interface ThemeTransitionPreset {
  id: string
  name: string
  nameEn: string
  config: ThemeTransitionConfig
  isBuiltIn?: boolean
}

const STORAGE_KEY = 'theme-transition-config'

const SPEED_DURATIONS: Record<ThemeTransitionSpeed, number> = {
  slow: 600,
  normal: 300,
  fast: 150,
  instant: 0
}

const EASING_FUNCTIONS: Record<string, string> = {
  ease: 'ease',
  easeIn: 'ease-in',
  easeOut: 'ease-out',
  easeInOut: 'ease-in-out',
  linear: 'linear',
  bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
  swift: 'cubic-bezier(0.25, 0.1, 0.25, 1)'
}

const BUILTIN_PRESETS: ThemeTransitionPreset[] = [
  {
    id: 'default-fade',
    name: '默认淡入',
    nameEn: 'Default Fade',
    config: {
      type: 'fade',
      direction: 'center',
      speed: 'normal',
      duration: 300,
      easing: 'smooth',
      enableOverlay: false
    },
    isBuiltIn: true
  },
  {
    id: 'smooth-slide',
    name: '平滑滑动',
    nameEn: 'Smooth Slide',
    config: {
      type: 'slide',
      direction: 'right',
      speed: 'normal',
      duration: 300,
      easing: 'smooth',
      enableOverlay: false
    },
    isBuiltIn: true
  },
  {
    id: 'zoom-in',
    name: '缩放切换',
    nameEn: 'Zoom',
    config: {
      type: 'zoom',
      direction: 'center',
      speed: 'normal',
      duration: 300,
      easing: 'bounce',
      enableOverlay: true
    },
    isBuiltIn: true
  },
  {
    id: 'flip-effect',
    name: '翻转效果',
    nameEn: 'Flip',
    config: {
      type: 'flip',
      direction: 'center',
      speed: 'slow',
      duration: 600,
      easing: 'smooth',
      enableOverlay: false
    },
    isBuiltIn: true
  },
  {
    id: 'ripple-effect',
    name: '波纹扩散',
    nameEn: 'Ripple',
    config: {
      type: 'ripple',
      direction: 'center',
      speed: 'normal',
      duration: 400,
      easing: 'easeOut',
      enableOverlay: false
    },
    isBuiltIn: true
  },
  {
    id: 'instant-switch',
    name: '即时切换',
    nameEn: 'Instant',
    config: {
      type: 'none',
      direction: 'center',
      speed: 'instant',
      duration: 0,
      easing: 'linear',
      enableOverlay: false
    },
    isBuiltIn: true
  }
]

type TransitionCallback = () => void

class ThemeTransitionManager {
  private config: ThemeTransitionConfig
  private presets: ThemeTransitionPreset[] = [...BUILTIN_PRESETS]
  private overlay: HTMLDivElement | null = null
  private isTransitioning: boolean = false
  private callbacks: TransitionCallback[] = []

  constructor() {
    this.config = this.loadConfig()
  }

  private loadConfig(): ThemeTransitionConfig {
    if (typeof window === 'undefined') {
      return BUILTIN_PRESETS[0].config
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        return JSON.parse(stored)
      }
    } catch {
      // ignore
    }
    return BUILTIN_PRESETS[0].config
  }

  private saveConfig(): void {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config))
    } catch {
      // ignore
    }
  }

  getConfig(): ThemeTransitionConfig {
    return { ...this.config }
  }

  setConfig(config: Partial<ThemeTransitionConfig>): void {
    this.config = { ...this.config, ...config }
    if (config.speed && !config.duration) {
      this.config.duration = SPEED_DURATIONS[config.speed]
    }
    this.saveConfig()
  }

  setPreset(presetId: string): boolean {
    const preset = this.presets.find(p => p.id === presetId)
    if (preset) {
      this.config = { ...preset.config }
      this.saveConfig()
      return true
    }
    return false
  }

  getPresets(): ThemeTransitionPreset[] {
    return [...this.presets]
  }

  addPreset(preset: Omit<ThemeTransitionPreset, 'id' | 'isBuiltIn'>): ThemeTransitionPreset {
    const newPreset: ThemeTransitionPreset = {
      ...preset,
      id: `custom-${Date.now()}`,
      isBuiltIn: false
    }
    this.presets.push(newPreset)
    return newPreset
  }

  removePreset(presetId: string): boolean {
    const index = this.presets.findIndex(p => p.id === presetId && !p.isBuiltIn)
    if (index > -1) {
      this.presets.splice(index, 1)
      return true
    }
    return false
  }

  getDuration(): number {
    return this.config.duration || SPEED_DURATIONS[this.config.speed]
  }

  getEasing(): string {
    return EASING_FUNCTIONS[this.config.easing] || this.config.easing
  }

  private createOverlay(): HTMLDivElement {
    const overlay = document.createElement('div')
    overlay.id = 'theme-transition-overlay'
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: var(--z-max);
      pointer-events: none;
      opacity: 0;
    `
    document.body.appendChild(overlay)
    return overlay
  }

  private removeOverlay(): void {
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay)
      this.overlay = null
    }
  }

  private applyFadeTransition(overlay: HTMLDivElement, callback: TransitionCallback): void {
    const duration = this.getDuration()
    const easing = this.getEasing()
    const overlayColor = this.config.overlayColor || 'var(--color-black-30)'

    overlay.style.background = overlayColor
    overlay.style.transition = `opacity ${duration}ms ${easing}`

    requestAnimationFrame(() => {
      overlay.style.opacity = '1'
      setTimeout(() => {
        callback()
        overlay.style.opacity = '0'
        setTimeout(() => this.removeOverlay(), duration)
      }, duration)
    })
  }

  private applySlideTransition(overlay: HTMLDivElement, callback: TransitionCallback): void {
    const duration = this.getDuration()
    const easing = this.getEasing()
    const direction = this.config.direction

    const transforms: Record<ThemeTransitionDirection, string> = {
      left: 'translateX(-100%)',
      right: 'translateX(100%)',
      up: 'translateY(-100%)',
      down: 'translateY(100%)',
      center: 'scale(0.95)'
    }

    const overlayColor = this.config.overlayColor || 'var(--color-black-50)'
    overlay.style.background = overlayColor
    overlay.style.transform = transforms[direction]
    overlay.style.transition = `transform ${duration}ms ${easing}, opacity ${duration}ms ${easing}`

    requestAnimationFrame(() => {
      overlay.style.opacity = '1'
      overlay.style.transform = 'translateX(0) translateY(0) scale(1)'
      setTimeout(() => {
        callback()
        overlay.style.opacity = '0'
        overlay.style.transform = transforms[direction]
        setTimeout(() => this.removeOverlay(), duration)
      }, duration)
    })
  }

  private applyZoomTransition(overlay: HTMLDivElement, callback: TransitionCallback): void {
    const duration = this.getDuration()
    const easing = this.getEasing()

    overlay.style.background = this.config.overlayColor || 'var(--color-black-50)'
    overlay.style.transform = 'scale(0)'
    overlay.style.transition = `transform ${duration}ms ${easing}, opacity ${duration}ms ${easing}`

    requestAnimationFrame(() => {
      overlay.style.opacity = '1'
      overlay.style.transform = 'scale(1)'
      setTimeout(() => {
        callback()
        overlay.style.opacity = '0'
        overlay.style.transform = 'scale(1.5)'
        setTimeout(() => this.removeOverlay(), duration)
      }, duration)
    })
  }

  private applyFlipTransition(overlay: HTMLDivElement, callback: TransitionCallback): void {
    const duration = this.getDuration()
    const easing = this.getEasing()

    overlay.style.background = this.config.overlayColor || 'var(--color-black-30)'
    overlay.style.transform = 'perspective(1000px) rotateY(90deg)'
    overlay.style.transition = `transform ${duration}ms ${easing}, opacity ${duration}ms ${easing}`

    requestAnimationFrame(() => {
      overlay.style.opacity = '1'
      overlay.style.transform = 'perspective(1000px) rotateY(0deg)'
      setTimeout(() => {
        callback()
        overlay.style.opacity = '0'
        overlay.style.transform = 'perspective(1000px) rotateY(-90deg)'
        setTimeout(() => this.removeOverlay(), duration)
      }, duration)
    })
  }

  private applyRippleTransition(overlay: HTMLDivElement, callback: TransitionCallback): void {
    const duration = this.getDuration()
    const easing = this.getEasing()

    const rippleColor = this.config.overlayColor || 'color-mix(in srgb, var(--el-color-primary) 30%, transparent)'
    overlay.style.background = 'radial-gradient(circle at center, ' + rippleColor + ' 0%, transparent 70%)'
    overlay.style.transform = 'scale(0)'
    overlay.style.opacity = '1'
    overlay.style.transition = `transform ${duration}ms ${easing}`

    requestAnimationFrame(() => {
      overlay.style.transform = 'scale(3)'
      setTimeout(() => {
        callback()
        overlay.style.opacity = '0'
        setTimeout(() => this.removeOverlay(), duration / 2)
      }, duration * 0.7)
    })
  }

  async executeTransition(callback: TransitionCallback): Promise<void> {
    if (this.isTransitioning) {
      callback()
      return
    }

    if (this.config.type === 'none' || this.config.duration === 0) {
      callback()
      return
    }

    this.isTransitioning = true

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) {
      callback()
      this.isTransitioning = false
      return
    }

    this.overlay = this.createOverlay()

    return new Promise((resolve) => {
      const completeTransition = () => {
        this.isTransitioning = false
        this.callbacks.forEach(cb => cb())
        this.callbacks = []
        resolve()
      }

      const wrappedCallback = () => {
        callback()
        completeTransition()
      }

      switch (this.config.type) {
        case 'fade':
          this.applyFadeTransition(this.overlay!, wrappedCallback)
          break
        case 'slide':
          this.applySlideTransition(this.overlay!, wrappedCallback)
          break
        case 'zoom':
          this.applyZoomTransition(this.overlay!, wrappedCallback)
          break
        case 'flip':
          this.applyFlipTransition(this.overlay!, wrappedCallback)
          break
        case 'ripple':
          this.applyRippleTransition(this.overlay!, wrappedCallback)
          break
        default:
          callback()
          completeTransition()
      }
    })
  }

  onTransitionComplete(callback: TransitionCallback): () => void {
    this.callbacks.push(callback)
    return () => {
      this.callbacks = this.callbacks.filter(cb => cb !== callback)
    }
  }

  isCurrentlyTransitioning(): boolean {
    return this.isTransitioning
  }

  getTransitionCSS(): string {
    const duration = this.getDuration()
    const easing = this.getEasing()

    return `--theme-transition-duration: ${duration}ms; --theme-transition-timing: ${easing};`
  }

  applyTransitionToRoot(): void {
    const root = document.documentElement
    root.style.setProperty('--theme-transition-duration', `${this.getDuration()}ms`)
    root.style.setProperty('--theme-transition-timing', this.getEasing())
  }

  resetTransitionOnRoot(): void {
    const root = document.documentElement
    root.style.removeProperty('--theme-transition-duration')
    root.style.removeProperty('--theme-transition-timing')
  }
}

export const themeTransitionManager = new ThemeTransitionManager()
