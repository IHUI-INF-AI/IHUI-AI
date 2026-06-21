 
import type { ThemeMode } from '@/stores/darkMode'
import { logger } from '@/utils/logger'

type CSSStyleRuleLike = {
  selectorText: string
  cssText: string
}

export interface CSSVariableInfo {
  name: string
  value: string
  computedValue: string
  source: 'inline' | 'stylesheet' | 'default'
  category: string
}

export interface ThemeDebugInfo {
  currentMode: ThemeMode
  htmlClasses: string[]
  cssVariables: CSSVariableInfo[]
  localStorageData: Record<string, unknown>
  performanceMetrics: {
    lastSwitchDuration: number
    averageSwitchDuration: number
    totalSwitches: number
  }
  issues: ThemeIssue[]
}

export interface ThemeIssue {
  type: 'error' | 'warning' | 'info'
  message: string
  suggestion: string
  details?: any
}

type DebugListener = (info: ThemeDebugInfo) => void

class ThemeDebugService {
  private listeners: Set<DebugListener> = new Set()
  private isDebugMode: boolean = false

  subscribe(listener: DebugListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notifyListeners(info: ThemeDebugInfo): void {
    this.listeners.forEach(listener => {
      try {
        listener(info)
      } catch {
        // Ignore listener errors
      }
    })
  }

  setDebugMode(enabled: boolean): void {
    this.isDebugMode = enabled
  }

  getDebugMode(): boolean {
    return this.isDebugMode
  }

  getCSSVariables(): CSSVariableInfo[] {
    if (typeof window === 'undefined') return []

    const root = document.documentElement
    const styles = getComputedStyle(root)
    const variables: CSSVariableInfo[] = []

    const styleSheets = Array.from(document.styleSheets)
    const definedVars = new Set<string>()

    for (const sheet of styleSheets) {
      try {
        const rules = Array.from(sheet.cssRules || [])
        for (const rule of rules) {
          const styleRule = rule as unknown as CSSStyleRuleLike
          if (styleRule.selectorText === ':root') {
            const cssText = styleRule.cssText
            const varMatches = cssText.matchAll(/--[\w-]+/g)
            for (const match of varMatches) {
              definedVars.add(match[0])
            }
          }
        }
      } catch {
        // Ignore CORS-protected stylesheets
      }
    }

    const elVars = new Set<string>()
    const inlineStyle = root.getAttribute('style') || ''
    const inlineMatches = inlineStyle.matchAll(/--[\w-]+/g)
    for (const match of inlineMatches) {
      elVars.add(match[0])
    }

    const allVars = new Set([...elVars, ...definedVars])

    const categories: Record<string, string[]> = {
      '背景色': ['bg-color', 'background', 'fill-color'],
      '文字颜色': ['text-color', 'font-color'],
      '边框颜色': ['border-color'],
      '主题色': ['color-primary', 'color-success', 'color-warning', 'color-danger', 'color-info'],
      '尺寸': ['size', 'width', 'height', 'radius', 'spacing', 'padding', 'margin'],
      '阴影': ['shadow', 'box-shadow'],
      '过渡': ['transition', 'duration', 'timing']
    }

    for (const varName of allVars) {
      const value = styles.getPropertyValue(varName).trim()
      if (!value) continue

      let category = '其他'
      for (const [cat, keywords] of Object.entries(categories)) {
        if (keywords.some(kw => varName.toLowerCase().includes(kw))) {
          category = cat
          break
        }
      }

      variables.push({
        name: varName,
        value,
        computedValue: value,
        source: elVars.has(varName) ? 'inline' : definedVars.has(varName) ? 'stylesheet' : 'default',
        category
      })
    }

    return variables.sort((a, b) => a.name.localeCompare(b.name))
  }

  getHTMLClasses(): string[] {
    if (typeof window === 'undefined') return []
    return Array.from(document.documentElement.classList)
  }

  getLocalStorageData(): Record<string, unknown> {
    if (typeof window === 'undefined') return {}

    const themeKeys = [
      'darkMode',
      'theme-presets',
      'theme-performance-metrics',
      'theme-usage-stats',
      'theme-scheduled-switches',
      'theme-cloud-sync',
      'theme-device-id'
    ]

    const data: Record<string, unknown> = {}

    for (const key of themeKeys) {
      const value = localStorage.getItem(key)
      if (value) {
        try {
          data[key] = JSON.parse(value)
        } catch {
          data[key] = value
        }
      }
    }

    return data
  }

  detectIssues(): ThemeIssue[] {
    const issues: ThemeIssue[] = []

    if (typeof window === 'undefined') return issues

    const root = document.documentElement
    const classes = Array.from(root.classList)

    if (classes.includes('dark') && classes.includes('light')) {
      issues.push({
        type: 'error',
        message: '同时存在 dark 和 light 类',
        suggestion: '检查主题切换逻辑，确保只应用一个主题类'
      })
    }

    if (classes.includes('dark') && classes.includes('high-contrast-light')) {
      issues.push({
        type: 'warning',
        message: '同时存在 dark 和 high-contrast-light 类',
        suggestion: '检查高对比度模式切换逻辑'
      })
    }

    const styles = getComputedStyle(root)
    const bgColor = styles.getPropertyValue('--el-bg-color').trim()
    const textColor = styles.getPropertyValue('--el-text-color-primary').trim()

    if (bgColor && textColor) {
      const bgLuminance = this.getLuminance(bgColor)
      const textLuminance = this.getLuminance(textColor)
      const contrastRatio = (Math.max(bgLuminance, textLuminance) + 0.05) / 
                           (Math.min(bgLuminance, textLuminance) + 0.05)

      if (contrastRatio < 4.5) {
        issues.push({
          type: 'warning',
          message: `对比度不足 (${contrastRatio.toFixed(2)}:1)`,
          suggestion: 'WCAG AA 标准要求对比度至少为 4.5:1',
          details: { bgColor, textColor, contrastRatio }
        })
      }
    }

    const savedTheme = localStorage.getItem('darkMode')
    const currentThemeClass = classes.find(c => 
      ['dark', 'light', 'high-contrast-light', 'high-contrast-dark'].includes(c)
    )

    if (savedTheme && currentThemeClass) {
      const expectedClass = savedTheme === 'dark' ? 'dark' : 
                           savedTheme === 'light' ? 'light' :
                           savedTheme
      if (!classes.includes(expectedClass) && !savedTheme.startsWith('high-contrast')) {
        issues.push({
          type: 'info',
          message: '保存的主题与当前应用的主题不一致',
          suggestion: '可能是自动模式或系统偏好影响了主题',
          details: { savedTheme, currentClass: currentThemeClass }
        })
      }
    }

    return issues
  }

  private getLuminance(color: string): number {
    const hex = color.replace('#', '')
    const r = parseInt(hex.substr(0, 2), 16) / 255
    const g = parseInt(hex.substr(2, 2), 16) / 255
    const b = parseInt(hex.substr(4, 2), 16) / 255

    const [rs, gs, bs] = [r, g, b].map(c => 
      c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    )

    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
  }

  getDebugInfo(currentMode: ThemeMode): ThemeDebugInfo {
    return {
      currentMode,
      htmlClasses: this.getHTMLClasses(),
      cssVariables: this.getCSSVariables(),
      localStorageData: this.getLocalStorageData(),
      performanceMetrics: {
        lastSwitchDuration: 0,
        averageSwitchDuration: 0,
        totalSwitches: 0
      },
      issues: this.detectIssues()
    }
  }

  setCSSVariable(name: string, value: string): void {
    if (typeof window === 'undefined') return
    document.documentElement.style.setProperty(name, value)
  }

  removeCSSVariable(name: string): void {
    if (typeof window === 'undefined') return
    document.documentElement.style.removeProperty(name)
  }

  exportDebugReport(currentMode: ThemeMode): string {
    const info = this.getDebugInfo(currentMode)
    return JSON.stringify(info, null, 2)
  }

  measureRenderTime(callback: () => void): number {
    const start = performance.now()
    callback()
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const end = performance.now()
        return end - start
      })
    })
    return 0
  }

  logThemeState(currentMode: ThemeMode): void {
    if (!this.isDebugMode) return

    const info = this.getDebugInfo(currentMode)
    logger.debug('🎨 Theme Debug Info')
    logger.debug('Current Mode:', info.currentMode)
    logger.debug('HTML Classes:', info.htmlClasses)
    logger.debug('CSS Variables:', info.cssVariables.length, 'variables')
    logger.debug('Local Storage:', info.localStorageData)
    logger.debug('Issues:', info.issues)
  }
}

export const themeDebug = new ThemeDebugService()
