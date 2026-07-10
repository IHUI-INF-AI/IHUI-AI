export interface AlertRule {
  id: string
  name: string
  description?: string
  metric: string
  condition: string | Record<string, any>
  threshold: number
  enabled: boolean
  severity?: string
  cooldown?: number
  channels?: any[]
  labels?: Record<string, any>
  [key: string]: unknown
}

export interface AlertStats {
  total: number
  active: number
  triggered: number
  [key: string]: unknown
}

class TourAlertService {
  private rules: AlertRule[] = []
  private checking = false

  addRule(rule: AlertRule): void {
    this.rules.push(rule)
  }

  removeRule(id: string): void {
    this.rules = this.rules.filter(r => r.id !== id)
  }

  getRules(): AlertRule[] {
    return this.rules
  }

  getAllRules(): AlertRule[] {
    return this.rules
  }

  createRule(rule: Partial<AlertRule>): AlertRule {
    const newRule: AlertRule = {
      id: Date.now().toString(),
      name: rule.name || '',
      description: rule.description || '',
      metric: rule.metric || '',
      condition: rule.condition || '',
      threshold: rule.threshold || 0,
      enabled: rule.enabled ?? true,
      severity: rule.severity || 'warning',
      cooldown: rule.cooldown || 300,
      channels: rule.channels || [],
      labels: rule.labels || {},
    }
    this.rules.push(newRule)
    return newRule
  }

  updateRule(id: string, update: Partial<AlertRule>): void {
    const idx = this.rules.findIndex(r => r.id === id)
    if (idx >= 0) {
      this.rules[idx] = { ...this.rules[idx], ...update }
    }
  }

  getStats(): AlertStats {
    return {
      total: this.rules.length,
      active: this.rules.filter(r => r.enabled).length,
      triggered: 0,
    }
  }

  checkAlerts(): void {
  }

  startChecking(): void {
    this.checking = true
  }

  stopChecking(): void {
    this.checking = false
  }
}

export const tourAlertService = new TourAlertService()
export default tourAlertService
