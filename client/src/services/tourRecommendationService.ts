import { logger } from '@/utils/logger'

export interface RecommendationRule {
  id: string
  name: string
  description: string
  type: 'behavior' | 'context' | 'time' | 'segment' | 'ab_test'
  conditions: RecommendationCondition[]
  actions: RecommendationAction[]
  priority: number
  enabled: boolean
  createdAt: number
  updatedAt: number
}

export interface RecommendationCondition {
  field: string
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'in' | 'between'
  value: any
  valueMax?: any
  weight: number
}

export interface RecommendationAction {
  type: 'show_tour' | 'hide_tour' | 'change_order' | 'modify_content' | 'delay_show'
  tourId?: string
  params: Record<string, unknown>
}

export interface UserBehavior {
  userId: string
  pageViews: PageView[]
  tourInteractions: TourInteraction[]
  preferences: Record<string, unknown>
  segments: string[]
  lastActiveTime: number
  totalSessions: number
  avgSessionDuration: number
}

export interface PageView {
  path: string
  title: string
  duration: number
  timestamp: number
  referrer?: string
}

export interface TourInteraction {
  tourId: string
  action: 'start' | 'complete' | 'skip' | 'pause' | 'resume' | 'error'
  stepId?: string
  timestamp: number
  duration?: number
}

export interface UserSegment {
  id: string
  name: string
  description: string
  criteria: SegmentCriteria[]
  size: number
  createdAt: number
}

export interface SegmentCriteria {
  field: string
  operator: string
  value: any
}

export interface RecommendationResult {
  tourId: string
  score: number
  reason: string
  matchedRules: string[]
  confidence: number
}

export interface ABTestConfig {
  id: string
  name: string
  description: string
  variants: ABTestVariant[]
  trafficAllocation: number
  startDate: number
  endDate?: number
  status: 'draft' | 'running' | 'paused' | 'completed'
  metrics: string[]
  winner?: string
}

export interface ABTestVariant {
  id: string
  name: string
  config: Record<string, unknown>
  trafficPercentage: number
}

export interface ABTestResult {
  testId: string
  variantId: string
  impressions: number
  conversions: number
  conversionRate: number
  avgDuration: number
  errorRate: number
}

const STORAGE_KEY = 'tour_recommendations'

class TourRecommendationService {
  private rules: Map<string, RecommendationRule> = new Map()
  private userBehaviors: Map<string, UserBehavior> = new Map()
  private segments: Map<string, UserSegment> = new Map()
  private abTests: Map<string, ABTestConfig> = new Map()
  private abTestResults: Map<string, ABTestResult[]> = new Map()

  constructor() {
    this.loadFromStorage()
    this.initializeDefaultRules()
  }

  private initializeDefaultRules(): void {
    if (this.rules.size === 0) {
      const defaultRules: RecommendationRule[] = [
        {
          id: 'rule_new_user',
          name: '新用户引导',
          description: '为新用户显示入门引导',
          type: 'segment',
          conditions: [
            { field: 'totalSessions', operator: 'lte', value: 1, weight: 1 }
          ],
          actions: [
            { type: 'show_tour', params: { tourId: 'onboarding', priority: 100 } }
          ],
          priority: 100,
          enabled: true,
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        {
          id: 'rule_feature_discovery',
          name: '功能发现',
          description: '根据用户浏览行为推荐功能引导',
          type: 'behavior',
          conditions: [
            { field: 'pageViewCount', operator: 'gte', value: 3, weight: 0.5 },
            { field: 'tourCompleted', operator: 'eq', value: false, weight: 0.5 }
          ],
          actions: [
            { type: 'show_tour', params: { tourId: 'feature_discovery', delay: 5000 } }
          ],
          priority: 50,
          enabled: true,
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        {
          id: 'rule_returning_user',
          name: '回归用户',
          description: '为回归用户显示更新引导',
          type: 'time',
          conditions: [
            { field: 'daysSinceLastVisit', operator: 'gte', value: 7, weight: 1 }
          ],
          actions: [
            { type: 'show_tour', params: { tourId: 'whats_new', priority: 80 } }
          ],
          priority: 80,
          enabled: true,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      ]

      defaultRules.forEach(r => this.rules.set(r.id, r))
      this.saveToStorage()
    }
  }

  createRule(rule: Omit<RecommendationRule, 'id' | 'createdAt' | 'updatedAt'>): RecommendationRule {
    const newRule: RecommendationRule = {
      ...rule,
      id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    this.rules.set(newRule.id, newRule)
    this.saveToStorage()
    return newRule
  }

  updateRule(ruleId: string, updates: Partial<RecommendationRule>): RecommendationRule | null {
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
    if (result) this.saveToStorage()
    return result
  }

  getRule(ruleId: string): RecommendationRule | undefined {
    return this.rules.get(ruleId)
  }

  getAllRules(): RecommendationRule[] {
    return Array.from(this.rules.values()).sort((a, b) => b.priority - a.priority)
  }

  getEnabledRules(): RecommendationRule[] {
    return this.getAllRules().filter(r => r.enabled)
  }

  trackPageView(userId: string, view: Omit<PageView, 'timestamp'>): void {
    let behavior = this.userBehaviors.get(userId)
    if (!behavior) {
      behavior = this.createUserBehavior(userId)
    }

    behavior.pageViews.push({
      ...view,
      timestamp: Date.now()
    })

    if (behavior.pageViews.length > 100) {
      behavior.pageViews = behavior.pageViews.slice(-100)
    }

    behavior.lastActiveTime = Date.now()
    this.userBehaviors.set(userId, behavior)
    this.saveToStorage()
  }

  trackTourInteraction(userId: string, interaction: Omit<TourInteraction, 'timestamp'>): void {
    let behavior = this.userBehaviors.get(userId)
    if (!behavior) {
      behavior = this.createUserBehavior(userId)
    }

    behavior.tourInteractions.push({
      ...interaction,
      timestamp: Date.now()
    })

    if (behavior.tourInteractions.length > 50) {
      behavior.tourInteractions = behavior.tourInteractions.slice(-50)
    }

    this.userBehaviors.set(userId, behavior)
    this.saveToStorage()
  }

  getUserBehavior(userId: string): UserBehavior | undefined {
    return this.userBehaviors.get(userId)
  }

  private createUserBehavior(userId: string): UserBehavior {
    return {
      userId,
      pageViews: [],
      tourInteractions: [],
      preferences: {},
      segments: [],
      lastActiveTime: Date.now(),
      totalSessions: 1,
      avgSessionDuration: 0
    }
  }

  createSegment(segment: Omit<UserSegment, 'id' | 'createdAt'>): UserSegment {
    const newSegment: UserSegment = {
      ...segment,
      id: `seg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now()
    }

    this.segments.set(newSegment.id, newSegment)
    this.saveToStorage()
    return newSegment
  }

  getSegments(): UserSegment[] {
    return Array.from(this.segments.values())
  }

  assignUserToSegment(userId: string, segmentId: string): void {
    const behavior = this.userBehaviors.get(userId)
    if (!behavior) return

    if (!behavior.segments.includes(segmentId)) {
      behavior.segments.push(segmentId)
      this.userBehaviors.set(userId, behavior)
      this.saveToStorage()
    }
  }

  getRecommendations(userId: string, context: Record<string, unknown> = {}): RecommendationResult[] {
    const behavior = this.userBehaviors.get(userId)
    const results: RecommendationResult[] = []
    const enabledRules = this.getEnabledRules()

    for (const rule of enabledRules) {
      const matchResult = this.evaluateRule(rule, behavior, context)
      if (matchResult.matched) {
        for (const action of rule.actions) {
          if (action.type === 'show_tour' && action.tourId) {
            results.push({
              tourId: action.tourId,
              score: matchResult.score * rule.priority,
              reason: rule.name,
              matchedRules: [rule.id],
              confidence: matchResult.confidence
            })
          }
        }
      }
    }

    return results.sort((a, b) => b.score - a.score)
  }

  private evaluateRule(
    rule: RecommendationRule,
    behavior: UserBehavior | undefined,
    context: Record<string, unknown>
  ): { matched: boolean; score: number; confidence: number } {
    let totalWeight = 0
    let matchedWeight = 0

    for (const condition of rule.conditions) {
      totalWeight += condition.weight
      const value = this.getFieldValue(condition.field, behavior, context)

      if (this.evaluateCondition(condition, value)) {
        matchedWeight += condition.weight
      }
    }

    const score = totalWeight > 0 ? matchedWeight / totalWeight : 0
    return {
      matched: score >= 0.5,
      score,
      confidence: score
    }
  }

  private getFieldValue(field: string, behavior: UserBehavior | undefined, context: Record<string, unknown>): any {
    if (field.startsWith('context.')) {
      return context[field.replace('context.', '')]
    }

    if (!behavior) return undefined

    switch (field) {
      case 'totalSessions': return behavior.totalSessions
      case 'avgSessionDuration': return behavior.avgSessionDuration
      case 'daysSinceLastVisit':
        return Math.floor((Date.now() - behavior.lastActiveTime) / (24 * 60 * 60 * 1000))
      case 'pageViewCount': return behavior.pageViews.length
      case 'tourCompleted':
        return behavior.tourInteractions.some(i => i.action === 'complete')
      case 'tourStarted':
        return behavior.tourInteractions.some(i => i.action === 'start')
      default: return (behavior as unknown as Record<string, unknown>)[field]
    }
  }

  private evaluateCondition(condition: RecommendationCondition, value: any): boolean {
    switch (condition.operator) {
      case 'eq': return value === condition.value
      case 'neq': return value !== condition.value
      case 'gt': return typeof value === 'number' && value > (condition.value as number)
      case 'lt': return typeof value === 'number' && value < (condition.value as number)
      case 'gte': return typeof value === 'number' && value >= (condition.value as number)
      case 'lte': return typeof value === 'number' && value <= (condition.value as number)
      case 'contains': return typeof value === 'string' && value.includes(condition.value as string)
      case 'in': return Array.isArray(condition.value) && condition.value.includes(value)
      case 'between':
        return typeof value === 'number' && 
               value >= (condition.value as number) && 
               value <= (condition.valueMax as number)
      default: return false
    }
  }

  createABTest(test: Omit<ABTestConfig, 'id'>): ABTestConfig {
    const newTest: ABTestConfig = {
      ...test,
      id: `ab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }

    this.abTests.set(newTest.id, newTest)
    this.abTestResults.set(newTest.id, [])
    this.saveToStorage()
    return newTest
  }

  updateABTest(testId: string, updates: Partial<ABTestConfig>): ABTestConfig | null {
    const test = this.abTests.get(testId)
    if (!test) return null

    const updated = { ...test, ...updates, id: test.id }
    this.abTests.set(testId, updated)
    this.saveToStorage()
    return updated
  }

  getABTest(testId: string): ABTestConfig | undefined {
    return this.abTests.get(testId)
  }

  getAllABTests(): ABTestConfig[] {
    return Array.from(this.abTests.values())
  }

  getActiveABTests(): ABTestConfig[] {
    return this.getAllABTests().filter(t => t.status === 'running')
  }

  assignVariant(testId: string, userId: string): string | null {
    const test = this.abTests.get(testId)
    if (!test || test.status !== 'running') return null

    const hash = this.hashUserId(userId + testId)
    if (hash > test.trafficAllocation) return null

    let cumulative = 0
    for (const variant of test.variants) {
      cumulative += variant.trafficPercentage
      if (hash < cumulative) {
        return variant.id
      }
    }

    return test.variants[0]?.id || null
  }

  recordABTestImpression(testId: string, variantId: string): void {
    const results = this.abTestResults.get(testId) || []
    let result = results.find(r => r.variantId === variantId)

    if (!result) {
      result = {
        testId,
        variantId,
        impressions: 0,
        conversions: 0,
        conversionRate: 0,
        avgDuration: 0,
        errorRate: 0
      }
      results.push(result)
    }

    result.impressions++
    this.abTestResults.set(testId, results)
    this.saveToStorage()
  }

  recordABTestConversion(testId: string, variantId: string, duration: number = 0): void {
    const results = this.abTestResults.get(testId) || []
    const result = results.find(r => r.variantId === variantId)

    if (result) {
      result.conversions++
      result.conversionRate = result.impressions > 0 
        ? (result.conversions / result.impressions) * 100 
        : 0
      result.avgDuration = (result.avgDuration * (result.conversions - 1) + duration) / result.conversions
      this.abTestResults.set(testId, results)
      this.saveToStorage()
    }
  }

  getABTestResults(testId: string): ABTestResult[] {
    return this.abTestResults.get(testId) || []
  }

  analyzeABTestResults(testId: string): { winner: string | null; confidence: number } {
    const results = this.abTestResults.get(testId) || []
    if (results.length < 2) return { winner: null, confidence: 0 }

    const sorted = [...results].sort((a, b) => b.conversionRate - a.conversionRate)
    const best = sorted[0]
    const second = sorted[1]

    if (!best || !second) return { winner: null, confidence: 0 }

    const improvement = best.conversionRate - second.conversionRate
    const confidence = Math.min(1, improvement / 10)

    return {
      winner: confidence > 0.95 ? best.variantId : null,
      confidence
    }
  }

  private hashUserId(input: string): number {
    let hash = 0
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return Math.abs(hash) % 100
  }

  reset(): void {
    this.rules.clear()
    this.userBehaviors.clear()
    this.segments.clear()
    this.abTests.clear()
    this.abTestResults.clear()
    localStorage.removeItem(STORAGE_KEY)
    this.initializeDefaultRules()
  }

  private saveToStorage(): void {
    try {
      const data = {
        rules: Array.from(this.rules.entries()),
        behaviors: Array.from(this.userBehaviors.entries()),
        segments: Array.from(this.segments.entries()),
        abTests: Array.from(this.abTests.entries()),
        abResults: Array.from(this.abTestResults.entries())
      }
      const serialized = JSON.stringify(data)
      if (serialized.length > 3 * 1024 * 1024) {
        const behaviors = new Map<string, UserBehavior>()
        this.userBehaviors.forEach((v, k) => {
          behaviors.set(k, {
            ...v,
            pageViews: v.pageViews.slice(-50),
            tourInteractions: v.tourInteractions.slice(-25)
          })
        })
        const trimmedData = {
          rules: data.rules,
          behaviors: Array.from(behaviors.entries()),
          segments: data.segments,
          abTests: data.abTests,
          abResults: data.abResults
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedData))
      } else {
        localStorage.setItem(STORAGE_KEY, serialized)
      }
    } catch (e) {
      logger.error('Failed to save recommendation data:', e)
    }
  }

  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem(STORAGE_KEY)
      if (data) {
        const parsed = JSON.parse(data)
        this.rules = new Map(parsed.rules || [])
        this.userBehaviors = new Map(parsed.behaviors || [])
        this.segments = new Map(parsed.segments || [])
        this.abTests = new Map(parsed.abTests || [])
        this.abTestResults = new Map(parsed.abResults || [])
      }
    } catch (e) {
      logger.error('Failed to load recommendation data:', e)
    }
  }
}

export const tourRecommendationService = new TourRecommendationService()
