import { StorageManager } from '@/utils/storage'

export type TriggerType = 'page_load' | 'first_visit' | 'role_based' | 'visit_count' | 'behavior' | 'manual'
export type UserRole = 'new_user' | 'regular' | 'premium' | 'admin'

export interface TriggerRule {
  id: string
  tourId: string
  type: TriggerType
  enabled: boolean
  priority: number
  conditions: TriggerCondition[]
  createdAt: number
  updatedAt: number
}

export interface TriggerCondition {
  field: string
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'in' | 'not_in'
  value: string | number | string[] | number[]
}

export interface TriggerConfig {
  rules: TriggerRule[]
  defaultRule: {
    type: TriggerType
    enabled: boolean
  }
}

const STORAGE_KEY = 'tour_trigger_rules'

class TourTriggerService {
  private config: TriggerConfig

  constructor() {
    this.config = this.loadConfig()
  }

  private loadConfig(): TriggerConfig {
    const stored = StorageManager.getItem<TriggerConfig>(STORAGE_KEY)
    if (stored) {
      return stored
    }
    return {
      rules: this.getDefaultRules(),
      defaultRule: {
        type: 'first_visit',
        enabled: true,
      },
    }
  }

  private getDefaultRules(): TriggerRule[] {
    return [
      {
        id: 'rule-visit-count',
        tourId: 'feature-tour',
        type: 'visit_count',
        enabled: true,
        priority: 80,
        conditions: [
          { field: 'visitCount', operator: 'greater_than', value: 3 },
          { field: 'tourCompleted', operator: 'not_equals', value: 'feature-tour' },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]
  }

  private saveConfig(): void {
    StorageManager.setItem(STORAGE_KEY, this.config)
  }

  getAllRules(): TriggerRule[] {
    return [...this.config.rules].sort((a, b) => b.priority - a.priority)
  }

  getRuleById(id: string): TriggerRule | undefined {
    return this.config.rules.find(r => r.id === id)
  }

  getRulesByTourId(tourId: string): TriggerRule[] {
    return this.config.rules.filter(r => r.tourId === tourId)
  }

  createRule(rule: Omit<TriggerRule, 'id' | 'createdAt' | 'updatedAt'>): TriggerRule {
    const newRule: TriggerRule = {
      ...rule,
      id: `rule-${Date.now()}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    this.config.rules.push(newRule)
    this.saveConfig()
    return newRule
  }

  updateRule(id: string, updates: Partial<Omit<TriggerRule, 'id' | 'createdAt'>>): TriggerRule | null {
    const index = this.config.rules.findIndex(r => r.id === id)
    if (index === -1) return null

    this.config.rules[index] = {
      ...this.config.rules[index],
      ...updates,
      updatedAt: Date.now(),
    }
    this.saveConfig()
    return this.config.rules[index]
  }

  deleteRule(id: string): boolean {
    const index = this.config.rules.findIndex(r => r.id === id)
    if (index === -1) return false

    this.config.rules.splice(index, 1)
    this.saveConfig()
    return true
  }

  toggleRule(id: string): boolean {
    const rule = this.getRuleById(id)
    if (!rule) return false
    return this.updateRule(id, { enabled: !rule.enabled }) !== null
  }

  evaluateRules(context: {
    userRole?: UserRole
    visitCount?: number
    currentPage?: string
    completedTours?: string[]
    behaviors?: string[]
  }): string | null {
    const sortedRules = this.getAllRules()

    for (const rule of sortedRules) {
      if (!rule.enabled) continue

      const matched = this.evaluateConditions(rule.conditions, context)
      if (matched) {
        return rule.tourId
      }
    }

    return null
  }

  private evaluateConditions(
    conditions: TriggerCondition[],
    context: {
      userRole?: UserRole
      visitCount?: number
      currentPage?: string
      completedTours?: string[]
      behaviors?: string[]
    }
  ): boolean {
    return conditions.every(condition => {
      let fieldValue: any

      switch (condition.field) {
        case 'userRole':
          fieldValue = context.userRole
          break
        case 'visitCount':
          fieldValue = context.visitCount
          break
        case 'currentPage':
          fieldValue = context.currentPage
          break
        case 'tourCompleted':
          fieldValue = context.completedTours?.includes(condition.value as string)
          break
        case 'behavior':
          fieldValue = context.behaviors
          break
        default:
          return false
      }

      return this.compareValues(fieldValue, condition.operator, condition.value)
    })
  }

  private compareValues(fieldValue: any, operator: string, conditionValue: any): boolean {
    switch (operator) {
      case 'equals':
        return fieldValue === conditionValue
      case 'not_equals':
        return fieldValue !== conditionValue
      case 'greater_than':
        return typeof fieldValue === 'number' && typeof conditionValue === 'number' && fieldValue > conditionValue
      case 'less_than':
        return typeof fieldValue === 'number' && typeof conditionValue === 'number' && fieldValue < conditionValue
      case 'contains':
        return typeof fieldValue === 'string' && typeof conditionValue === 'string' && fieldValue.includes(conditionValue)
      case 'in':
        return Array.isArray(conditionValue) && conditionValue.includes(fieldValue as string | number)
      case 'not_in':
        return Array.isArray(conditionValue) && !conditionValue.includes(fieldValue as string | number)
      default:
        return false
    }
  }

  getTriggerTypes(): { value: TriggerType; label: string }[] {
    return [
      { value: 'page_load', label: '页面加载时' },
      { value: 'first_visit', label: '首次访问时' },
      { value: 'role_based', label: '基于用户角色' },
      { value: 'visit_count', label: '基于访问次数' },
      { value: 'behavior', label: '基于用户行为' },
      { value: 'manual', label: '手动触发' },
    ]
  }

  getOperators(): { value: string; label: string }[] {
    return [
      { value: 'equals', label: '等于' },
      { value: 'not_equals', label: '不等于' },
      { value: 'greater_than', label: '大于' },
      { value: 'less_than', label: '小于' },
      { value: 'contains', label: '包含' },
      { value: 'in', label: '在列表中' },
      { value: 'not_in', label: '不在列表中' },
    ]
  }

  getConditionFields(): { value: string; label: string }[] {
    return [
      { value: 'userRole', label: '用户角色' },
      { value: 'visitCount', label: '访问次数' },
      { value: 'currentPage', label: '当前页面' },
      { value: 'tourCompleted', label: '已完成的引导' },
      { value: 'behavior', label: '用户行为' },
    ]
  }

  getUserRoles(): { value: UserRole; label: string }[] {
    return [
      { value: 'new_user', label: '新用户' },
      { value: 'regular', label: '普通用户' },
      { value: 'premium', label: '高级用户' },
      { value: 'admin', label: '管理员' },
    ]
  }

  exportRules(): string {
    return JSON.stringify(this.config, null, 2)
  }

  importRules(json: string): boolean {
    try {
      const config = JSON.parse(json) as TriggerConfig
      if (!config.rules || !Array.isArray(config.rules)) {
        return false
      }
      this.config = config
      this.saveConfig()
      return true
    } catch {
      return false
    }
  }
}

export const tourTriggerService = new TourTriggerService()
