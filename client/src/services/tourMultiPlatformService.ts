export interface DeviceInfo {
  type: 'mobile' | 'tablet' | 'desktop'
  os: string
  browser: string
  screenWidth: number
  screenHeight: number
  pixelRatio: number
  touchSupport: boolean
  orientation: 'portrait' | 'landscape'
  breakpoint: string
}

export interface PlatformConfig {
  id: string
  name: string
  type: string
  platform: string
  version: string
  features: string[]
  enabled: boolean
  [key: string]: unknown
}

export interface AdaptationRule {
  id: string
  name: string
  platform: string
  priority: number
  enabled: boolean
  condition: Record<string, any>
  action: Record<string, any>
  conditions: Array<{
    field: string
    operator: string
    value: unknown
  }>
  adjustments: Array<Record<string, any>>
  [key: string]: unknown
}

class TourMultiPlatformService {
  private currentDevice: DeviceInfo | null = null
  private platforms: PlatformConfig[] = []
  private rules: AdaptationRule[] = []

  detectDevice(): DeviceInfo {
    const ua = navigator.userAgent
    const isMobile = /Mobile|Android|iPhone/i.test(ua)
    const isTablet = /iPad|Tablet/i.test(ua)
    const sw = window.screen.width
    const sh = window.screen.height
    this.currentDevice = {
      type: isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop',
      os: /Android/i.test(ua) ? 'android' : /iPhone|iPad|iOS/i.test(ua) ? 'ios' : 'unknown',
      browser: /Chrome/i.test(ua) ? 'chrome' : /Firefox/i.test(ua) ? 'firefox' : /Safari/i.test(ua) ? 'safari' : 'unknown',
      screenWidth: sw,
      screenHeight: sh,
      pixelRatio: window.devicePixelRatio || 1,
      touchSupport: 'ontouchstart' in window,
      orientation: sw > sh ? 'landscape' : 'portrait',
      breakpoint: sw < 768 ? 'sm' : sw < 1024 ? 'md' : sw < 1280 ? 'lg' : 'xl',
    }
    return this.currentDevice
  }

  getPlatformConfig(platform: string): PlatformConfig {
    return { id: platform, name: platform, type: platform, platform, version: '1.0', features: [], enabled: true }
  }

  getAllPlatforms(): PlatformConfig[] {
    return this.platforms
  }

  updatePlatform(id: string, update: Partial<PlatformConfig>): void {
    const idx = this.platforms.findIndex(p => p.id === id)
    if (idx >= 0) {
      this.platforms[idx] = { ...this.platforms[idx], ...update }
    }
  }

  getAdaptationRules(): AdaptationRule[] {
    return this.rules
  }

  updateAdaptationRule(id: string, update: Partial<AdaptationRule>): void {
    const idx = this.rules.findIndex(r => r.id === id)
    if (idx >= 0) {
      this.rules[idx] = { ...this.rules[idx], ...update }
    }
  }

  deleteAdaptationRule(id: string): void {
    this.rules = this.rules.filter(r => r.id !== id)
  }

  createAdaptationRule(rule: Partial<AdaptationRule>): AdaptationRule {
    const newRule: AdaptationRule = {
      id: Date.now().toString(),
      name: rule.name || '',
      platform: rule.platform || 'mobile',
      priority: rule.priority || 50,
      enabled: rule.enabled ?? true,
      condition: rule.condition || {},
      action: rule.action || {},
      conditions: rule.conditions || [],
      adjustments: rule.adjustments || [],
    }
    this.rules.push(newRule)
    return newRule
  }
}

export const tourMultiPlatformService = new TourMultiPlatformService()
export default tourMultiPlatformService
