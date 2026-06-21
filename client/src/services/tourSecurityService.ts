import { StorageManager } from '@/utils/storage'

export interface SecurityRule {
  id: string
  type: 'content' | 'xss' | 'injection' | 'access'
  pattern: string
  action: 'block' | 'sanitize' | 'warn' | 'log'
  enabled: boolean
  severity: 'low' | 'medium' | 'high' | 'critical'
}

export interface AuditLog {
  id: string
  timestamp: number
  action: string
  userId?: string
  tourId?: string
  details: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  result: 'success' | 'denied' | 'warning'
}

export interface SecurityScanResult {
  safe: boolean
  issues: SecurityIssue[]
  sanitizedContent?: string
}

export interface SecurityIssue {
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  location?: string
  recommendation: string
}

export interface SensitivePattern {
  name: string
  pattern: RegExp
  replacement: string
}

const RULES_KEY = 'tour_security_rules'
const AUDIT_KEY = 'tour_audit_logs'
const SETTINGS_KEY = 'tour_security_settings'

const DEFAULT_RULES: SecurityRule[] = [
  { id: 'xss-script', type: 'xss', pattern: '<script', action: 'block', enabled: true, severity: 'critical' },
  { id: 'xss-event', type: 'xss', pattern: 'on\\w+\\s*=', action: 'sanitize', enabled: true, severity: 'high' },
  { id: 'xss-iframe', type: 'xss', pattern: '<iframe', action: 'block', enabled: true, severity: 'high' },
  { id: 'injection-sql', type: 'injection', pattern: "(SELECT|INSERT|UPDATE|DELETE|DROP|UNION)", action: 'sanitize', enabled: true, severity: 'critical' },
  { id: 'injection-eval', type: 'injection', pattern: '(eval|Function)\\s*\\(', action: 'block', enabled: true, severity: 'critical' },
  { id: 'content-link', type: 'content', pattern: 'javascript:', action: 'sanitize', enabled: true, severity: 'high' },
  { id: 'content-data', type: 'content', pattern: 'data:text/html', action: 'block', enabled: true, severity: 'medium' },
]

const SENSITIVE_PATTERNS: SensitivePattern[] = [
  { name: 'email', pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: '***@***.***' },
  { name: 'phone', pattern: /\b\d{3}[-.]?\d{4}[-.]?\d{4}\b/g, replacement: '***-****-****' },
  { name: 'idcard', pattern: /\b\d{17}[\dXx]\b/g, replacement: '******************' },
  { name: 'creditcard', pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, replacement: '****-****-****-****' },
  { name: 'apikey', pattern: /(?:api[_-]?key|token|secret)[=:]\s*['"]?[\w-]{20,}['"]?/gi, replacement: 'API_KEY_REDACTED' },
]

class TourSecurityService {
  private rules: SecurityRule[] = []
  private auditLogs: AuditLog[] = []
  private settings: { enabled: boolean; logLevel: 'all' | 'warnings' | 'denied' } = { enabled: true, logLevel: 'all' }

  constructor() {
    this.load()
  }

  private load(): void {
    this.rules = StorageManager.getItem<SecurityRule[]>(RULES_KEY) || DEFAULT_RULES
    this.auditLogs = StorageManager.getItem<AuditLog[]>(AUDIT_KEY) || []
    this.settings = StorageManager.getItem<{ enabled: boolean; logLevel: 'all' | 'warnings' | 'denied' }>(SETTINGS_KEY) || this.settings
  }

  private save(): void {
    StorageManager.setItem(RULES_KEY, this.rules)
    StorageManager.setItem(AUDIT_KEY, this.auditLogs.slice(-1000))
    StorageManager.setItem(SETTINGS_KEY, this.settings)
  }

  scanContent(content: string): SecurityScanResult {
    const issues: SecurityIssue[] = []
    let sanitizedContent = content
    let safe = true

    this.rules.filter(r => r.enabled).forEach(rule => {
      const regex = new RegExp(rule.pattern, 'gi')
      const matches = content.match(regex)

      if (matches) {
        safe = false
        issues.push({
          type: rule.type,
          severity: rule.severity,
          message: `检测到潜在的${rule.type}风险: ${matches[0].substring(0, 50)}...`,
          recommendation: this.getRecommendation(rule.type),
        })

        if (rule.action === 'block') {
          sanitizedContent = sanitizedContent.replace(regex, '[BLOCKED]')
        } else if (rule.action === 'sanitize') {
          sanitizedContent = this.sanitizeMatch(sanitizedContent, regex)
        }
      }
    })

    return { safe, issues, sanitizedContent: safe ? undefined : sanitizedContent }
  }

  private sanitizeMatch(content: string, pattern: RegExp): string {
    return content.replace(pattern, (match) => {
      return match
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
    })
  }

  private getRecommendation(type: string): string {
    const recommendations: Record<string, string> = {
      xss: '移除或转义HTML标签和事件处理器',
      injection: '避免使用动态代码执行，使用参数化查询',
      content: '检查链接协议，避免javascript:和data:协议',
      access: '验证用户权限，确保访问控制正确',
    }
    return recommendations[type] || '检查内容安全性'
  }

  filterSensitive(content: string): string {
    let filtered = content

    SENSITIVE_PATTERNS.forEach(({ pattern, replacement }) => {
      filtered = filtered.replace(pattern, replacement)
    })

    return filtered
  }

  logAudit(data: {
    action: string
    userId?: string
    tourId?: string
    details: Record<string, unknown>
    result: 'success' | 'denied' | 'warning'
  }): void {
    if (!this.settings.enabled) return
    if (this.settings.logLevel === 'warnings' && data.result === 'success') return
    if (this.settings.logLevel === 'denied' && data.result !== 'denied') return

    const log: AuditLog = {
      id: `audit-${Date.now()}`,
      timestamp: Date.now(),
      action: data.action,
      userId: data.userId,
      tourId: data.tourId,
      details: this.filterSensitiveObject(data.details),
      userAgent: navigator.userAgent,
      result: data.result,
    }

    this.auditLogs.push(log)
    this.save()
  }

  private filterSensitiveObject(obj: Record<string, unknown>): Record<string, unknown> {
    const filtered: Record<string, unknown> = {}
    
    Object.entries(obj).forEach(([key, value]) => {
      if (typeof value === 'string') {
        filtered[key] = this.filterSensitive(value)
      } else if (typeof value === 'object' && value !== null) {
        filtered[key] = this.filterSensitiveObject(value as Record<string, unknown>)
      } else {
        filtered[key] = value
      }
    })

    return filtered
  }

  getAuditLogs(filters?: {
    userId?: string
    tourId?: string
    action?: string
    result?: 'success' | 'denied' | 'warning'
    startDate?: number
    endDate?: number
  }): AuditLog[] {
    let logs = [...this.auditLogs]

    if (filters) {
      if (filters.userId) {
        logs = logs.filter(l => l.userId === filters.userId)
      }
      if (filters.tourId) {
        logs = logs.filter(l => l.tourId === filters.tourId)
      }
      if (filters.action) {
        logs = logs.filter(l => l.action.includes(filters.action!))
      }
      if (filters.result) {
        logs = logs.filter(l => l.result === filters.result)
      }
      if (filters.startDate) {
        logs = logs.filter(l => l.timestamp >= filters.startDate!)
      }
      if (filters.endDate) {
        logs = logs.filter(l => l.timestamp <= filters.endDate!)
      }
    }

    return logs.sort((a, b) => b.timestamp - a.timestamp)
  }

  getRules(): SecurityRule[] {
    return [...this.rules]
  }

  addRule(rule: Omit<SecurityRule, 'id'>): SecurityRule {
    const newRule: SecurityRule = {
      ...rule,
      id: `rule-${Date.now()}`,
    }
    this.rules.push(newRule)
    this.save()
    return newRule
  }

  updateRule(id: string, updates: Partial<SecurityRule>): SecurityRule | null {
    const index = this.rules.findIndex(r => r.id === id)
    if (index === -1) return null

    this.rules[index] = { ...this.rules[index], ...updates }
    this.save()
    return this.rules[index]
  }

  deleteRule(id: string): boolean {
    const index = this.rules.findIndex(r => r.id === id)
    if (index === -1) return false

    this.rules.splice(index, 1)
    this.save()
    return true
  }

  toggleRule(id: string): boolean {
    const rule = this.rules.find(r => r.id === id)
    if (!rule) return false

    rule.enabled = !rule.enabled
    this.save()
    return true
  }

  getSettings(): { enabled: boolean; logLevel: 'all' | 'warnings' | 'denied' } {
    return { ...this.settings }
  }

  updateSettings(settings: Partial<{ enabled: boolean; logLevel: 'all' | 'warnings' | 'denied' }>): void {
    this.settings = { ...this.settings, ...settings }
    this.save()
  }

  getSecurityReport(): {
    totalLogs: number
    deniedCount: number
    warningCount: number
    topActions: { action: string; count: number }[]
    recentIssues: SecurityIssue[]
  } {
    const deniedCount = this.auditLogs.filter(l => l.result === 'denied').length
    const warningCount = this.auditLogs.filter(l => l.result === 'warning').length

    const actionCounts: Record<string, number> = {}
    this.auditLogs.forEach(log => {
      actionCounts[log.action] = (actionCounts[log.action] || 0) + 1
    })

    const topActions = Object.entries(actionCounts)
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    const recentIssues: SecurityIssue[] = []
    this.auditLogs.slice(-20).forEach(log => {
      if (log.result !== 'success' && log.details.issues) {
        recentIssues.push(...(log.details.issues as SecurityIssue[]))
      }
    })

    return {
      totalLogs: this.auditLogs.length,
      deniedCount,
      warningCount,
      topActions,
      recentIssues: recentIssues.slice(-10),
    }
  }

  clearAuditLogs(): void {
    this.auditLogs = []
    this.save()
  }

  exportAuditLogs(): string {
    return JSON.stringify({
      exportedAt: Date.now(),
      logs: this.auditLogs,
    }, null, 2)
  }

  validateAccess(userId: string, tourId: string, action: string): { allowed: boolean; reason?: string } {
    this.logAudit({
      action: `access:${action}`,
      userId,
      tourId,
      details: { action },
      result: 'success',
    })

    return { allowed: true }
  }
}

export const tourSecurityService = new TourSecurityService()
