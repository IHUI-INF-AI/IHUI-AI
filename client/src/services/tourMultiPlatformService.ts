import { logger } from '@/utils/logger'

export interface PlatformConfig {
  id: string
  type: 'web' | 'mobile' | 'wechat' | 'app' | 'miniprogram'
  name: string
  enabled: boolean
  settings: PlatformSettings
  theme: ThemeConfig
  features: string[]
}

export interface PlatformSettings {
  maxWidth: number
  minWidth: number
  breakpoint: number
  orientation: 'portrait' | 'landscape' | 'both'
  touchEnabled: boolean
  gestureEnabled: boolean
  keyboardEnabled: boolean
  scrollBehavior: 'smooth' | 'auto'
  animationDuration: number
}

export interface ThemeConfig {
  primaryColor: string
  backgroundColor: string
  textColor: string
  borderRadius: number
  shadowEnabled: boolean
  compact: boolean
}

export interface DeviceInfo {
  type: 'desktop' | 'tablet' | 'mobile'
  os: 'windows' | 'macos' | 'ios' | 'android' | 'linux' | 'unknown'
  browser: 'chrome' | 'firefox' | 'safari' | 'edge' | 'wechat' | 'unknown'
  screenWidth: number
  screenHeight: number
  pixelRatio: number
  touchSupport: boolean
  orientation: 'portrait' | 'landscape'
  language: string
  timezone: string
}

export interface AdaptationRule {
  id: string
  platform: string
  conditions: AdaptationCondition[]
  adjustments: TourAdjustment[]
  priority: number
  enabled: boolean
}

export interface AdaptationCondition {
  field: 'screenWidth' | 'screenHeight' | 'pixelRatio' | 'orientation' | 'touchSupport'
  operator: 'lt' | 'gt' | 'eq' | 'between'
  value: number | string | boolean
  valueMax?: number
}

export interface TourAdjustment {
  type: 'position' | 'size' | 'animation' | 'content' | 'timing'
  property: string
  value: any
}

export interface SyncData {
  tourId: string
  userId: string
  progress: number
  completedSteps: string[]
  lastActiveTime: number
  preferences: Record<string, unknown>
}

const STORAGE_KEY = 'tour_multiplatform'

class TourMultiPlatformService {
  private platforms: Map<string, PlatformConfig> = new Map()
  private adaptationRules: Map<string, AdaptationRule> = new Map()
  private currentDevice: DeviceInfo | null = null
  private currentPlatform: PlatformConfig | null = null
  private syncQueue: SyncData[] = []
  private syncInterval: number | null = null

  constructor() {
    this.loadFromStorage()
    this.initializeDefaultPlatforms()
    this.detectDevice()
  }

  private initializeDefaultPlatforms(): void {
    if (this.platforms.size === 0) {
      const defaultPlatforms: PlatformConfig[] = [
        {
          id: 'web_desktop',
          type: 'web',
          name: 'Web桌面端',
          enabled: true,
          settings: {
            maxWidth: 1920,
            minWidth: 1200,
            breakpoint: 1200,
            orientation: 'landscape',
            touchEnabled: false,
            gestureEnabled: false,
            keyboardEnabled: true,
            scrollBehavior: 'smooth',
            animationDuration: 300
          },
          theme: {
            primaryColor: 'var(--color-primary)',
            backgroundColor: 'var(--el-bg-color)',
            textColor: 'var(--color-gray-303133)',
            borderRadius: 4,
            shadowEnabled: true,
            compact: false
          },
          features: ['keyboard', 'mouse', 'hover', 'tooltip']
        },
        {
          id: 'web_mobile',
          type: 'mobile',
          name: 'Web移动端',
          enabled: true,
          settings: {
            maxWidth: 768,
            minWidth: 320,
            breakpoint: 768,
            orientation: 'portrait',
            touchEnabled: true,
            gestureEnabled: true,
            keyboardEnabled: false,
            scrollBehavior: 'smooth',
            animationDuration: 200
          },
          theme: {
            primaryColor: 'var(--color-primary)',
            backgroundColor: 'var(--el-bg-color)',
            textColor: 'var(--color-gray-303133)',
            borderRadius: 8,
            shadowEnabled: false,
            compact: true
          },
          features: ['touch', 'swipe', 'pinch', 'longpress']
        },
        {
          id: 'wechat_miniprogram',
          type: 'miniprogram',
          name: '微信小程序',
          enabled: true,
          settings: {
            maxWidth: 750,
            minWidth: 320,
            breakpoint: 750,
            orientation: 'portrait',
            touchEnabled: true,
            gestureEnabled: true,
            keyboardEnabled: false,
            scrollBehavior: 'smooth',
            animationDuration: 150
          },
          theme: {
            primaryColor: 'var(--el-text-color-primary)',
            backgroundColor: 'var(--el-text-color-primary)',
            textColor: 'var(--color-gray-333)',
            borderRadius: 8,
            shadowEnabled: false,
            compact: true
          },
          features: ['touch', 'swipe', 'wechat-api']
        },
        {
          id: 'app_ios',
          type: 'app',
          name: 'iOS App',
          enabled: true,
          settings: {
            maxWidth: 828,
            minWidth: 320,
            breakpoint: 828,
            orientation: 'both',
            touchEnabled: true,
            gestureEnabled: true,
            keyboardEnabled: false,
            scrollBehavior: 'smooth',
            animationDuration: 250
          },
          theme: {
            primaryColor: 'var(--el-text-color-primary)',
            backgroundColor: 'var(--el-text-color-primary)',
            textColor: 'var(--el-text-color-primary)',
            borderRadius: 12,
            shadowEnabled: true,
            compact: false
          },
          features: ['touch', 'swipe', 'haptic', 'siri']
        },
        {
          id: 'app_android',
          type: 'app',
          name: 'Android App',
          enabled: true,
          settings: {
            maxWidth: 1080,
            minWidth: 320,
            breakpoint: 1080,
            orientation: 'both',
            touchEnabled: true,
            gestureEnabled: true,
            keyboardEnabled: false,
            scrollBehavior: 'smooth',
            animationDuration: 200
          },
          theme: {
            primaryColor: 'var(--el-text-color-primary)',
            backgroundColor: 'var(--el-bg-color)',
            textColor: 'var(--el-text-color-primary)',
            borderRadius: 8,
            shadowEnabled: true,
            compact: false
          },
          features: ['touch', 'swipe', 'haptic', 'widgets']
        }
      ]

      defaultPlatforms.forEach(p => this.platforms.set(p.id, p))
      this.saveToStorage()
    }
  }

  detectDevice(): DeviceInfo {
    const ua = navigator.userAgent
    const width = window.innerWidth
    const height = window.innerHeight

    let type: DeviceInfo['type'] = 'desktop'
    if (width < 768) type = 'mobile'
    else if (width < 1024) type = 'tablet'

    let os: DeviceInfo['os'] = 'unknown'
    if (ua.includes('Windows')) os = 'windows'
    else if (ua.includes('Mac')) os = 'macos'
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'ios'
    else if (ua.includes('Android')) os = 'android'
    else if (ua.includes('Linux')) os = 'linux'

    let browser: DeviceInfo['browser'] = 'unknown'
    if (ua.includes('MicroMessenger')) browser = 'wechat'
    else if (ua.includes('Edg')) browser = 'edge'
    else if (ua.includes('Chrome')) browser = 'chrome'
    else if (ua.includes('Firefox')) browser = 'firefox'
    else if (ua.includes('Safari')) browser = 'safari'

    this.currentDevice = {
      type,
      os,
      browser,
      screenWidth: width,
      screenHeight: height,
      pixelRatio: window.devicePixelRatio || 1,
      touchSupport: 'ontouchstart' in window,
      orientation: width > height ? 'landscape' : 'portrait',
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    }

    this.currentPlatform = this.matchPlatform()
    return this.currentDevice
  }

  private matchPlatform(): PlatformConfig {
    if (!this.currentDevice) {
      return Array.from(this.platforms.values())[0]
    }

    const device = this.currentDevice
    let bestMatch: PlatformConfig | null = null
    let bestScore = 0

    for (const platform of this.platforms.values()) {
      if (!platform.enabled) continue

      let score = 0
      if (platform.type === 'web' && device.type === 'desktop') score += 3
      if (platform.type === 'mobile' && device.type === 'mobile') score += 3
      if (platform.type === 'miniprogram' && device.browser === 'wechat') score += 5
      if (platform.type === 'app' && device.os === 'ios' && platform.id.includes('ios')) score += 5
      if (platform.type === 'app' && device.os === 'android' && platform.id.includes('android')) score += 5

      if (score > bestScore) {
        bestScore = score
        bestMatch = platform
      }
    }

    return bestMatch || Array.from(this.platforms.values())[0]
  }

  getCurrentDevice(): DeviceInfo | null {
    return this.currentDevice
  }

  getCurrentPlatform(): PlatformConfig | null {
    return this.currentPlatform
  }

  getPlatform(platformId: string): PlatformConfig | undefined {
    return this.platforms.get(platformId)
  }

  getAllPlatforms(): PlatformConfig[] {
    return Array.from(this.platforms.values())
  }

  updatePlatform(platformId: string, updates: Partial<PlatformConfig>): PlatformConfig | null {
    const platform = this.platforms.get(platformId)
    if (!platform) return null

    const updated = { ...platform, ...updates, id: platform.id }
    this.platforms.set(platformId, updated)
    this.saveToStorage()
    return updated
  }

  createAdaptationRule(rule: Omit<AdaptationRule, 'id'>): AdaptationRule {
    const newRule: AdaptationRule = {
      ...rule,
      id: `adapt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }

    this.adaptationRules.set(newRule.id, newRule)
    this.saveToStorage()
    return newRule
  }

  updateAdaptationRule(ruleId: string, updates: Partial<AdaptationRule>): AdaptationRule | null {
    const rule = this.adaptationRules.get(ruleId)
    if (!rule) return null

    const updated = { ...rule, ...updates, id: rule.id }
    this.adaptationRules.set(ruleId, updated)
    this.saveToStorage()
    return updated
  }

  deleteAdaptationRule(ruleId: string): boolean {
    const result = this.adaptationRules.delete(ruleId)
    if (result) this.saveToStorage()
    return result
  }

  getAdaptationRules(platformId?: string): AdaptationRule[] {
    const rules = Array.from(this.adaptationRules.values())
    if (platformId) {
      return rules.filter(r => r.platform === platformId)
    }
    return rules.sort((a, b) => b.priority - a.priority)
  }

  applyAdaptations(tourConfig: Record<string, unknown>): Record<string, unknown> {
    if (!this.currentDevice || !this.currentPlatform) return tourConfig

    const rules = this.getAdaptationRules(this.currentPlatform.id)
    let adapted = { ...tourConfig }

    for (const rule of rules) {
      if (!rule.enabled) continue
      if (!this.matchesConditions(rule.conditions)) continue

      for (const adjustment of rule.adjustments) {
        adapted = this.applyAdjustment(adapted, adjustment)
      }
    }

    return adapted
  }

  private matchesConditions(conditions: AdaptationCondition[]): boolean {
    if (!this.currentDevice) return false

    for (const condition of conditions) {
      const deviceValue = this.currentDevice[condition.field as keyof DeviceInfo]
      
      switch (condition.operator) {
        case 'lt':
          if (typeof deviceValue === 'number' && typeof condition.value === 'number' && deviceValue >= condition.value) return false
          break
        case 'gt':
          if (typeof deviceValue === 'number' && typeof condition.value === 'number' && deviceValue <= condition.value) return false
          break
        case 'eq':
          if (deviceValue !== condition.value) return false
          break
        case 'between':
          if (typeof deviceValue === 'number' && typeof condition.value === 'number' && (deviceValue < condition.value || deviceValue > (condition.valueMax || condition.value))) return false
          break
      }
    }

    return true
  }

  private applyAdjustment(config: Record<string, unknown>, adjustment: TourAdjustment): Record<string, unknown> {
    const result = { ...config }
    const keys = adjustment.property.split('.')
    let current: Record<string, unknown> = result

    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {}
      }
      current = current[keys[i]] as Record<string, unknown>
    }

    current[keys[keys.length - 1]] = adjustment.value
    return result
  }

  startSync(interval: number = 30000): void {
    if (this.syncInterval) return

    this.syncInterval = window.setInterval(() => {
      void this.syncAll()
    }, interval)
  }

  stopSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
    }
  }

  queueSync(data: SyncData): void {
    const existing = this.syncQueue.findIndex(d => d.tourId === data.tourId && d.userId === data.userId)
    if (existing >= 0) {
      this.syncQueue[existing] = data
    } else {
      this.syncQueue.push(data)
    }
  }

  private async syncAll(): Promise<void> {
    if (this.syncQueue.length === 0) return

    const dataToSync = [...this.syncQueue]
    this.syncQueue = []

    try {
      logger.info('Syncing data:', dataToSync)
    } catch (e) {
      logger.error('Sync failed:', e)
      this.syncQueue = [...dataToSync, ...this.syncQueue]
    }
  }

  isMobile(): boolean {
    return this.currentDevice?.type === 'mobile'
  }

  isTablet(): boolean {
    return this.currentDevice?.type === 'tablet'
  }

  isDesktop(): boolean {
    return this.currentDevice?.type === 'desktop'
  }

  isTouchDevice(): boolean {
    return this.currentDevice?.touchSupport ?? false
  }

  getBreakpoint(): string {
    if (!this.currentDevice) return 'desktop'
    const width = this.currentDevice.screenWidth
    if (width < 576) return 'xs'
    if (width < 768) return 'sm'
    if (width < 992) return 'md'
    if (width < 1200) return 'lg'
    return 'xl'
  }

  reset(): void {
    this.stopSync()
    this.platforms.clear()
    this.adaptationRules.clear()
    this.syncQueue = []
    this.currentDevice = null
    this.currentPlatform = null
    localStorage.removeItem(STORAGE_KEY)
    this.initializeDefaultPlatforms()
  }

  private saveToStorage(): void {
    try {
      const data = {
        platforms: Array.from(this.platforms.entries()),
        rules: Array.from(this.adaptationRules.entries())
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (e) {
      logger.error('Failed to save multi-platform config:', e)
    }
  }

  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem(STORAGE_KEY)
      if (data) {
        const parsed = JSON.parse(data)
        this.platforms = new Map(parsed.platforms || [])
        this.adaptationRules = new Map(parsed.rules || [])
      }
    } catch (e) {
      logger.error('Failed to load multi-platform config:', e)
    }
  }
}

export const tourMultiPlatformService = new TourMultiPlatformService()
