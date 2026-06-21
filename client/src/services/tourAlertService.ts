import { logger } from '@/utils/logger'

export interface AlertRule {
  id: string
  name: string
  description: string
  metric: string
  condition: AlertCondition
  severity: 'info' | 'warning' | 'critical'
  enabled: boolean
  cooldown: number
  channels: NotificationChannel[]
  labels: Record<string, string>
  createdAt: number
  updatedAt: number
}

export interface AlertCondition {
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq' | 'neq' | 'between' | 'outside'
  threshold: number
  thresholdMax?: number
  duration: number
  aggregation: 'avg' | 'sum' | 'max' | 'min' | 'count' | 'rate'
  groupBy?: string[]
}

export interface NotificationChannel {
  id: string
  type: 'email' | 'webhook' | 'slack' | 'dingtalk' | 'wechat' | 'sms'
  config: Record<string, unknown>
  enabled: boolean
}

export interface AlertInstance {
  id: string
  ruleId: string
  ruleName: string
  status: 'firing' | 'resolved' | 'silenced'
  severity: 'info' | 'warning' | 'critical'
  value: number
  threshold: number
  message: string
  labels: Record<string, string>
  startsAt: number
  endsAt?: number
  acknowledgedAt?: number
  acknowledgedBy?: string
  silencedAt?: number
  silencedUntil?: number
  notifications: NotificationRecord[]
}

export interface NotificationRecord {
  channelId: string
  channelType: string
  sentAt: number
  success: boolean
  error?: string
}

export interface AlertHistory {
  id: string
  ruleId: string
  ruleName: string
  firedAt: number
  resolvedAt?: number
  duration: number
  severity: string
  value: number
  threshold: number
}

export interface AlertStats {
  totalRules: number
  enabledRules: number
  activeAlerts: number
  firingAlerts: number
  resolvedAlerts: number
  silencedAlerts: number
  notificationsSent: number
  notificationsFailed: number
}

const STORAGE_KEY = 'tour_alerts'

class TourAlertService {
  private rules: Map<string, AlertRule> = new Map()
  private alerts: Map<string, AlertInstance> = new Map()
  private history: AlertHistory[] = []
  private notificationChannels: Map<string, NotificationChannel> = new Map()
  private checkInterval: number | null = null
  private lastFired: Map<string, number> = new Map()

  constructor() {
    this.loadFromStorage()
    this.initializeDefaultChannels()
  }

  createRule(rule: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>): AlertRule {
    const newRule: AlertRule = {
      ...rule,
      id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    this.rules.set(newRule.id, newRule)
    this.saveToStorage()
    return newRule
  }

  updateRule(ruleId: string, updates: Partial<AlertRule>): AlertRule | null {
    const rule = this.rules.get(ruleId)
    if (!rule) return null

    const updated = {
      ...rule,
      ...updates,
      id: rule.id,
      createdAt: rule.createdAt,
      updatedAt: Date.now()
    }

    this.rules.set(ruleId, updated)
    this.saveToStorage()
    return updated
  }

  deleteRule(ruleId: string): boolean {
    const result = this.rules.delete(ruleId)
    if (result) {
      for (const [alertId, alert] of this.alerts) {
        if (alert.ruleId === ruleId) {
          this.alerts.delete(alertId)
        }
      }
      this.saveToStorage()
    }
    return result
  }

  getRule(ruleId: string): AlertRule | undefined {
    return this.rules.get(ruleId)
  }

  getAllRules(): AlertRule[] {
    return Array.from(this.rules.values())
  }

  getEnabledRules(): AlertRule[] {
    return this.getAllRules().filter(r => r.enabled)
  }

  startChecking(): void {
    if (this.checkInterval) return

    this.checkInterval = window.setInterval(() => {
      this.checkAllRules()
    }, 10000)
  }

  stopChecking(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
  }

  checkRule(ruleId: string, metricValue: number, labels: Record<string, string> = {}): AlertInstance | null {
    const rule = this.rules.get(ruleId)
    if (!rule || !rule.enabled) return null

    const lastFire = this.lastFired.get(ruleId) || 0
    if (Date.now() - lastFire < rule.cooldown) return null

    const isFiring = this.evaluateCondition(rule.condition, metricValue)
    const existingAlert = this.findActiveAlert(ruleId, labels)

    if (isFiring && !existingAlert) {
      return this.fireAlert(rule, metricValue, labels)
    } else if (!isFiring && existingAlert) {
      return this.resolveAlert(existingAlert.id)
    } else if (isFiring && existingAlert) {
      existingAlert.value = metricValue
      this.alerts.set(existingAlert.id, existingAlert)
    }

    return null
  }

  private checkAllRules(): void {
    for (const rule of this.getEnabledRules()) {
      const metricValue = this.getMetricValue(rule.metric)
      if (metricValue !== null) {
        this.checkRule(rule.id, metricValue)
      }
    }
  }

  private evaluateCondition(condition: AlertCondition, value: number): boolean {
    switch (condition.operator) {
      case 'gt': return value > condition.threshold
      case 'lt': return value < condition.threshold
      case 'gte': return value >= condition.threshold
      case 'lte': return value <= condition.threshold
      case 'eq': return value === condition.threshold
      case 'neq': return value !== condition.threshold
      case 'between': 
        return value >= condition.threshold && value <= (condition.thresholdMax || condition.threshold)
      case 'outside':
        return value < condition.threshold || value > (condition.thresholdMax || condition.threshold)
      default: return false
    }
  }

  private fireAlert(rule: AlertRule, value: number, labels: Record<string, string>): AlertInstance {
    const alert: AlertInstance = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ruleId: rule.id,
      ruleName: rule.name,
      status: 'firing',
      severity: rule.severity,
      value,
      threshold: rule.condition.threshold,
      message: this.generateAlertMessage(rule, value),
      labels: { ...rule.labels, ...labels },
      startsAt: Date.now(),
      notifications: []
    }

    this.alerts.set(alert.id, alert)
    this.lastFired.set(rule.id, Date.now())
    void this.sendNotifications(alert, rule)
    this.saveToStorage()

    return alert
  }

  resolveAlert(alertId: string): AlertInstance | null {
    const alert = this.alerts.get(alertId)
    if (!alert || alert.status !== 'firing') return null

    alert.status = 'resolved'
    alert.endsAt = Date.now()

    const historyEntry: AlertHistory = {
      id: `history_${Date.now()}`,
      ruleId: alert.ruleId,
      ruleName: alert.ruleName,
      firedAt: alert.startsAt,
      resolvedAt: alert.endsAt,
      duration: alert.endsAt - alert.startsAt,
      severity: alert.severity,
      value: alert.value,
      threshold: alert.threshold
    }

    this.history.push(historyEntry)
    if (this.history.length > 1000) {
      this.history = this.history.slice(-1000)
    }

    this.saveToStorage()
    return alert
  }

  silenceAlert(alertId: string, duration: number): AlertInstance | null {
    const alert = this.alerts.get(alertId)
    if (!alert) return null

    alert.status = 'silenced'
    alert.silencedAt = Date.now()
    alert.silencedUntil = Date.now() + duration

    this.alerts.set(alertId, alert)
    this.saveToStorage()
    return alert
  }

  acknowledgeAlert(alertId: string, acknowledgedBy: string): AlertInstance | null {
    const alert = this.alerts.get(alertId)
    if (!alert) return null

    alert.acknowledgedAt = Date.now()
    alert.acknowledgedBy = acknowledgedBy

    this.alerts.set(alertId, alert)
    this.saveToStorage()
    return alert
  }

  getAlert(alertId: string): AlertInstance | undefined {
    return this.alerts.get(alertId)
  }

  getActiveAlerts(): AlertInstance[] {
    return Array.from(this.alerts.values()).filter(a => a.status === 'firing')
  }

  getAllAlerts(): AlertInstance[] {
    return Array.from(this.alerts.values())
  }

  getAlertHistory(limit: number = 100): AlertHistory[] {
    return this.history.slice(-limit)
  }

  getStats(): AlertStats {
    const alerts = Array.from(this.alerts.values())
    let notificationsSent = 0
    let notificationsFailed = 0

    for (const alert of alerts) {
      for (const notif of alert.notifications) {
        if (notif.success) notificationsSent++
        else notificationsFailed++
      }
    }

    return {
      totalRules: this.rules.size,
      enabledRules: this.getEnabledRules().length,
      activeAlerts: alerts.filter(a => a.status === 'firing' || a.status === 'silenced').length,
      firingAlerts: alerts.filter(a => a.status === 'firing').length,
      resolvedAlerts: alerts.filter(a => a.status === 'resolved').length,
      silencedAlerts: alerts.filter(a => a.status === 'silenced').length,
      notificationsSent,
      notificationsFailed
    }
  }

  addNotificationChannel(channel: Omit<NotificationChannel, 'id'>): NotificationChannel {
    const newChannel: NotificationChannel = {
      ...channel,
      id: `channel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }

    this.notificationChannels.set(newChannel.id, newChannel)
    this.saveToStorage()
    return newChannel
  }

  updateNotificationChannel(channelId: string, updates: Partial<NotificationChannel>): NotificationChannel | null {
    const channel = this.notificationChannels.get(channelId)
    if (!channel) return null

    const updated = { ...channel, ...updates, id: channel.id }
    this.notificationChannels.set(channelId, updated)
    this.saveToStorage()
    return updated
  }

  deleteNotificationChannel(channelId: string): boolean {
    const result = this.notificationChannels.delete(channelId)
    if (result) {
      this.saveToStorage()
    }
    return result
  }

  getNotificationChannels(): NotificationChannel[] {
    return Array.from(this.notificationChannels.values())
  }

  testNotificationChannel(channelId: string): Promise<boolean> {
    const channel = this.notificationChannels.get(channelId)
    if (!channel) return Promise.resolve(false)

    return this.sendToChannel(channel, {
      title: '测试通知',
      message: '这是一条测试通知消息',
      severity: 'info',
      timestamp: Date.now()
    })
  }

  reset(): void {
    this.stopChecking()
    this.rules.clear()
    this.alerts.clear()
    this.history = []
    this.notificationChannels.clear()
    this.lastFired.clear()
    localStorage.removeItem(STORAGE_KEY)
  }

  private findActiveAlert(ruleId: string, labels: Record<string, string>): AlertInstance | undefined {
    for (const alert of this.alerts.values()) {
      if (alert.ruleId === ruleId && alert.status === 'firing') {
        const labelsMatch = Object.keys(labels).every(
          key => alert.labels[key] === labels[key]
        )
        if (labelsMatch) return alert
      }
    }
    return undefined
  }

  private getMetricValue(_metricName: string): number | null {
    return Math.random() * 100
  }

  private generateAlertMessage(rule: AlertRule, value: number): string {
    const operatorText: Record<string, string> = {
      gt: '大于',
      lt: '小于',
      gte: '大于等于',
      lte: '小于等于',
      eq: '等于',
      neq: '不等于',
      between: '在范围内',
      outside: '在范围外'
    }

    return `告警规则 "${rule.name}" 触发: 指标 ${rule.metric} 当前值 ${value.toFixed(2)} ${operatorText[rule.condition.operator]} 阈值 ${rule.condition.threshold}`
  }

  private async sendNotifications(alert: AlertInstance, rule: AlertRule): Promise<void> {
    for (const channelConfig of rule.channels) {
      const channel = this.notificationChannels.get(channelConfig.id)
      if (!channel || !channel.enabled) continue

      const success = await this.sendToChannel(channel, {
        title: `[${alert.severity.toUpperCase()}] ${alert.ruleName}`,
        message: alert.message,
        severity: alert.severity,
        timestamp: alert.startsAt
      })

      alert.notifications.push({
        channelId: channel.id,
        channelType: channel.type,
        sentAt: Date.now(),
        success
      })
    }

    this.alerts.set(alert.id, alert)
  }

  private async sendToChannel(channel: NotificationChannel, data: {
    title: string
    message: string
    severity: string
    timestamp: number
  }): Promise<boolean> {
    try {
      switch (channel.type) {
        case 'webhook':
          if (!channel.config.url) return false
          await fetch(channel.config.url as string, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          })
          return true
        case 'email':
          if (!channel.config.to) return false
          logger.info('Sending email:', channel.config.to, data)
          return true
        case 'slack':
          if (!channel.config.webhookUrl) return false
          logger.info('Sending Slack:', channel.config.webhookUrl, data)
          return true
        case 'dingtalk':
          if (!channel.config.webhookUrl) return false
          logger.info('Sending DingTalk:', channel.config.webhookUrl, data)
          return true
        case 'wechat':
          if (!channel.config.corpId) return false
          logger.info('Sending WeChat:', channel.config.corpId, data)
          return true
        case 'sms':
          if (!channel.config.phone) return false
          logger.info('Sending SMS:', channel.config.phone, data)
          return true
        default:
          return false
      }
    } catch (e) {
      logger.error('Failed to send notification:', e)
      return false
    }
  }

  private initializeDefaultChannels(): void {
    if (this.notificationChannels.size === 0) {
      this.addNotificationChannel({
        type: 'webhook',
        config: { url: '' },
        enabled: false
      })
    }
  }

  private saveToStorage(): void {
    try {
      const data = {
        rules: Array.from(this.rules.entries()),
        alerts: Array.from(this.alerts.entries()),
        history: this.history,
        channels: Array.from(this.notificationChannels.entries())
      }
      const serialized = JSON.stringify(data)
      if (serialized.length > 2 * 1024 * 1024) {
        this.history = this.history.slice(-500)
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        rules: data.rules,
        alerts: data.alerts,
        history: this.history,
        channels: data.channels
      }))
    } catch (e) {
      logger.error('Failed to save alert data:', e)
    }
  }

  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem(STORAGE_KEY)
      if (data) {
        const parsed = JSON.parse(data)
        this.rules = new Map(parsed.rules || [])
        this.alerts = new Map(parsed.alerts || [])
        this.history = parsed.history || []
        this.notificationChannels = new Map(parsed.channels || [])
      }
    } catch (e) {
      logger.error('Failed to load alert data:', e)
    }
  }
}

export const tourAlertService = new TourAlertService()
