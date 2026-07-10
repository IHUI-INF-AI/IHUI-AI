export interface RecommendationRule {
  id: string
  name: string
  type?: string
  segment: string
  priority: number
  enabled: boolean
  description?: string
  conditions?: any[]
  actions?: any[]
  [key: string]: unknown
}

export interface UserSegment {
  id: string
  name: string
  criteria: Record<string, any>
  userCount?: number
  createdAt?: string
  [key: string]: unknown
}

export interface ABTestConfig {
  id: string
  name: string
  variantA: string
  variantB: string
  trafficSplit: number
  trafficAllocation?: number
  status?: string
  [key: string]: unknown
}

export interface ABTestResult {
  variantId: string
  conversionRate: number
  [key: string]: unknown
}

export interface UserBehavior {
  userId: string
  totalSessions?: number
  pageViews?: unknown[]
  tourInteractions?: unknown[]
  lastActive?: string
  avgSessionDuration?: number
  [key: string]: unknown
}

export interface Recommendation {
  id: string
  tourId?: string
  score?: number
  reason?: string
  confidence?: number
  [key: string]: unknown
}

class TourRecommendationService {
  private rules: RecommendationRule[] = []
  private segments: UserSegment[] = []
  private abTests: ABTestConfig[] = []

  getRules(): RecommendationRule[] {
    return this.rules
  }

  getAllRules(): RecommendationRule[] {
    return this.rules
  }

  getSegments(): UserSegment[] {
    return this.segments
  }

  getABTests(): ABTestConfig[] {
    return this.abTests
  }

  getAllABTests(): ABTestConfig[] {
    return this.abTests
  }

  addRule(rule: RecommendationRule): void {
    this.rules.push(rule)
  }

  createRule(rule: Partial<RecommendationRule>): RecommendationRule {
    const newRule: RecommendationRule = {
      id: Date.now().toString(),
      name: rule.name || '',
      type: rule.type || 'behavior',
      segment: rule.segment || '',
      priority: rule.priority || 50,
      enabled: rule.enabled ?? true,
      description: rule.description || '',
      conditions: rule.conditions || [],
      actions: rule.actions || [],
    }
    this.rules.push(newRule)
    return newRule
  }

  updateRule(id: string, update: Partial<RecommendationRule>): void {
    const idx = this.rules.findIndex(r => r.id === id)
    if (idx >= 0) {
      this.rules[idx] = { ...this.rules[idx], ...update }
    }
  }

  deleteRule(id: string): void {
    this.rules = this.rules.filter(r => r.id !== id)
  }

  addSegment(segment: UserSegment): void {
    this.segments.push(segment)
  }

  addABTest(test: ABTestConfig): void {
    this.abTests.push(test)
  }

  updateABTest(id: string, update: Partial<ABTestConfig>): void {
    const idx = this.abTests.findIndex(t => t.id === id)
    if (idx >= 0) {
      this.abTests[idx] = { ...this.abTests[idx], ...update }
    }
  }

  getABTestResults(id: string): ABTestResult[] | null {
    return []
  }

  getUserBehavior(userId: string): UserBehavior | null {
    return { userId, totalSessions: 0, pageViews: [], tourInteractions: [], lastActive: '', avgSessionDuration: 0 }
  }

  getRecommendations(userId: string): Recommendation[] {
    return []
  }
}

export const tourRecommendationService = new TourRecommendationService()
export default tourRecommendationService
