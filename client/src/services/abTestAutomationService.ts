import { StorageManager } from '@/utils/storage'

export interface ABTestVariant {
  id: string
  name: string
  traffic: number
  config: Record<string, unknown>
}

export interface ABTestResult {
  variantId: string
  impressions: number
  conversions: number
  conversionRate: number
  confidence: number
  isWinner: boolean
}

export interface MultiVariateTest {
  id: string
  name: string
  factors: TestFactor[]
  combinations: TestCombination[]
  status: 'running' | 'paused' | 'completed'
  startDate: number
  endDate?: number
  winner?: string
}

export interface TestFactor {
  name: string
  levels: string[]
}

export interface TestCombination {
  id: string
  factors: Record<string, string>
  impressions: number
  conversions: number
}

export interface StatisticalResult {
  chiSquare: number
  pValue: number
  isSignificant: boolean
  confidenceLevel: number
  recommendation: string
}

const STORAGE_KEY = 'tour_ab_automation'
const RESULTS_KEY = 'tour_ab_results'

class ABTestAutomationService {
  private tests: Map<string, MultiVariateTest> = new Map()
  private results: Map<string, ABTestResult[]> = new Map()

  constructor() {
    this.loadData()
  }

  private loadData(): void {
    const tests = StorageManager.getItem<Record<string, MultiVariateTest>>(STORAGE_KEY)
    if (tests) {
      Object.entries(tests).forEach(([id, test]) => {
        this.tests.set(id, test)
      })
    }

    const results = StorageManager.getItem<Record<string, ABTestResult[]>>(RESULTS_KEY)
    if (results) {
      Object.entries(results).forEach(([id, data]) => {
        this.results.set(id, data)
      })
    }
  }

  private saveData(): void {
    const testsObj: Record<string, MultiVariateTest> = {}
    this.tests.forEach((test, id) => {
      testsObj[id] = test
    })
    StorageManager.setItem(STORAGE_KEY, testsObj)

    const resultsObj: Record<string, ABTestResult[]> = {}
    this.results.forEach((result, id) => {
      resultsObj[id] = result
    })
    StorageManager.setItem(RESULTS_KEY, resultsObj)
  }

  createTest(config: {
    name: string
    factors: TestFactor[]
    traffic?: number
  }): MultiVariateTest {
    const combinations = this.generateCombinations(config.factors)
    
    const test: MultiVariateTest = {
      id: `test-${Date.now()}`,
      name: config.name,
      factors: config.factors,
      combinations: combinations.map((c, i) => ({
        id: `combo-${i}`,
        factors: c,
        impressions: 0,
        conversions: 0,
      })),
      status: 'running',
      startDate: Date.now(),
    }

    this.tests.set(test.id, test)
    this.results.set(test.id, [])
    this.saveData()
    return test
  }

  private generateCombinations(factors: TestFactor[]): Record<string, string>[] {
    if (factors.length === 0) return [{}]
    
    const [first, ...rest] = factors
    const restCombinations = this.generateCombinations(rest)
    
    const combinations: Record<string, string>[] = []
    first.levels.forEach(level => {
      restCombinations.forEach(restCombo => {
        combinations.push({
          [first.name]: level,
          ...restCombo,
        })
      })
    })
    
    return combinations
  }

  assignVariant(testId: string): TestCombination | null {
    const test = this.tests.get(testId)
    if (!test || test.status !== 'running') return null

    const _totalImpressions = test.combinations.reduce((sum, c) => sum + c.impressions, 0)
    const minImpressions = Math.min(...test.combinations.map(c => c.impressions))
    
    const underExposed = test.combinations.filter(c => c.impressions === minImpressions)
    const selected = underExposed[Math.floor(Math.random() * underExposed.length)]
    
    selected.impressions++
    this.saveData()
    
    return selected
  }

  recordConversion(testId: string, combinationId: string): void {
    const test = this.tests.get(testId)
    if (!test) return

    const combination = test.combinations.find(c => c.id === combinationId)
    if (combination) {
      combination.conversions++
      this.saveData()
      this.checkForWinner(testId)
    }
  }

  private checkForWinner(testId: string): void {
    const test = this.tests.get(testId)
    if (!test || test.status !== 'running') return

    const totalImpressions = test.combinations.reduce((sum, c) => sum + c.impressions, 0)
    if (totalImpressions < 100) return

    const stats = this.calculateStatistics(testId)
    if (stats.isSignificant) {
      const winner = this.determineWinner(testId)
      if (winner) {
        test.winner = winner.id
        test.status = 'completed'
        test.endDate = Date.now()
        this.saveData()
      }
    }
  }

  calculateStatistics(testId: string): StatisticalResult {
    const test = this.tests.get(testId)
    if (!test) {
      return {
        chiSquare: 0,
        pValue: 1,
        isSignificant: false,
        confidenceLevel: 0,
        recommendation: '测试不存在',
      }
    }

    const combinations = test.combinations.filter(c => c.impressions > 0)
    if (combinations.length < 2) {
      return {
        chiSquare: 0,
        pValue: 1,
        isSignificant: false,
        confidenceLevel: 0,
        recommendation: '需要更多数据',
      }
    }

    const chiSquare = this.calculateChiSquare(combinations)
    const pValue = this.calculatePValue(chiSquare, combinations.length - 1)
    const isSignificant = pValue < 0.05
    const confidenceLevel = (1 - pValue) * 100

    let recommendation = ''
    if (isSignificant) {
      const winner = this.determineWinner(testId)
      recommendation = winner 
        ? `建议采用组合 ${winner.id}，置信度 ${confidenceLevel.toFixed(1)}%`
        : '结果显著，但无法确定最佳组合'
    } else {
      recommendation = '暂无显著差异，建议继续测试'
    }

    return {
      chiSquare,
      pValue,
      isSignificant,
      confidenceLevel,
      recommendation,
    }
  }

  private calculateChiSquare(combinations: TestCombination[]): number {
    const totalImpressions = combinations.reduce((sum, c) => sum + c.impressions, 0)
    const totalConversions = combinations.reduce((sum, c) => sum + c.conversions, 0)
    const overallRate = totalImpressions > 0 ? totalConversions / totalImpressions : 0

    let chiSquare = 0
    combinations.forEach(c => {
      const expectedConversions = c.impressions * overallRate
      const expectedNonConversions = c.impressions * (1 - overallRate)
      
      if (expectedConversions > 0 && expectedNonConversions > 0) {
        const observedConversions = c.conversions
        const observedNonConversions = c.impressions - c.conversions
        
        chiSquare += Math.pow(observedConversions - expectedConversions, 2) / expectedConversions
        chiSquare += Math.pow(observedNonConversions - expectedNonConversions, 2) / expectedNonConversions
      }
    })

    return chiSquare
  }

  private calculatePValue(chiSquare: number, df: number): number {
    const pValue = this.chiSquarePValue(chiSquare, df)
    return pValue
  }

  private chiSquarePValue(chiSquare: number, df: number): number {
    if (chiSquare <= 0) return 1
    
    const gamma = this.incompleteGamma(df / 2, chiSquare / 2)
    return 1 - gamma
  }

  private incompleteGamma(a: number, x: number): number {
    if (x < 0 || a <= 0) return 0
    if (x < a + 1) {
      return this.gammaSeries(a, x)
    }
    return 1 - this.gammaContinuedFraction(a, x)
  }

  private gammaSeries(a: number, x: number): number {
    const maxIterations = 200
    const eps = 1e-10
    
    let sum = 1 / a
    let term = sum
    
    for (let n = 1; n < maxIterations; n++) {
      term *= x / (a + n)
      sum += term
      if (Math.abs(term) < Math.abs(sum) * eps) break
    }
    
    return sum * Math.exp(-x + a * Math.log(x) - this.logGamma(a))
  }

  private gammaContinuedFraction(a: number, x: number): number {
    const maxIterations = 200
    const eps = 1e-10
    
    let b = x + 1 - a
    let c = 1 / 1e-30
    let d = 1 / b
    let h = d
    
    for (let n = 1; n < maxIterations; n++) {
      const an = -n * (n - a)
      b = b + 2
      d = an * d + b
      if (Math.abs(d) < 1e-30) d = 1e-30
      c = b + an / c
      if (Math.abs(c) < 1e-30) c = 1e-30
      d = 1 / d
      const delta = d * c
      h *= delta
      if (Math.abs(delta - 1) < eps) break
    }
    
    return Math.exp(-x + a * Math.log(x) - this.logGamma(a)) * h
  }

  private logGamma(x: number): number {
    const cof = [
      76.1800917294715,
      -86.5053203294168,
      24.0140982408309,
      -1.23173957245016,
      1.208650973866179e-3,
      -5.395239384953e-6,
    ]
    
    let y = x
    let tmp = x + 5.5
    tmp -= (x + 0.5) * Math.log(tmp)
    
    let ser = 1.000000000190015
    for (let j = 0; j < 6; j++) {
      y += 1
      ser += cof[j] / y
    }
    
    return -tmp + Math.log(2.5066282746310002 * ser / x)
  }

  private determineWinner(testId: string): TestCombination | null {
    const test = this.tests.get(testId)
    if (!test) return null

    const validCombinations = test.combinations.filter(c => c.impressions >= 30)
    if (validCombinations.length === 0) return null

    return validCombinations.reduce((best, current) => {
      const currentRate = current.impressions > 0 ? current.conversions / current.impressions : 0
      const bestRate = best.impressions > 0 ? best.conversions / best.impressions : 0
      return currentRate > bestRate ? current : best
    })
  }

  getTest(testId: string): MultiVariateTest | undefined {
    return this.tests.get(testId)
  }

  getAllTests(): MultiVariateTest[] {
    return Array.from(this.tests.values())
  }

  pauseTest(testId: string): boolean {
    const test = this.tests.get(testId)
    if (!test || test.status !== 'running') return false
    
    test.status = 'paused'
    this.saveData()
    return true
  }

  resumeTest(testId: string): boolean {
    const test = this.tests.get(testId)
    if (!test || test.status !== 'paused') return false
    
    test.status = 'running'
    this.saveData()
    return true
  }

  deleteTest(testId: string): boolean {
    if (!this.tests.has(testId)) return false
    
    this.tests.delete(testId)
    this.results.delete(testId)
    this.saveData()
    return true
  }

  getTestResults(testId: string): ABTestResult[] {
    const test = this.tests.get(testId)
    if (!test) return []

    return test.combinations.map(c => ({
      variantId: c.id,
      impressions: c.impressions,
      conversions: c.conversions,
      conversionRate: c.impressions > 0 ? c.conversions / c.impressions : 0,
      confidence: this.calculateConfidence(test, c),
      isWinner: test.winner === c.id,
    }))
  }

  private calculateConfidence(test: MultiVariateTest, combination: TestCombination): number {
    if (combination.impressions < 30) return 0

    const rate = combination.impressions > 0 
      ? combination.conversions / combination.impressions 
      : 0
    
    const se = Math.sqrt(rate * (1 - rate) / combination.impressions)
    const z = 1.96
    
    return Math.min(95, (rate / (rate + z * se)) * 100)
  }

  autoSelectWinner(testId: string): TestCombination | null {
    const stats = this.calculateStatistics(testId)
    if (!stats.isSignificant) return null

    return this.determineWinner(testId)
  }

  getRecommendations(testId: string): string[] {
    const test = this.tests.get(testId)
    if (!test) return ['测试不存在']

    const recommendations: string[] = []
    const stats = this.calculateStatistics(testId)

    if (test.combinations.some(c => c.impressions < 30)) {
      recommendations.push('建议继续收集数据，部分组合样本量不足')
    }

    if (stats.isSignificant) {
      const winner = this.determineWinner(testId)
      if (winner) {
        recommendations.push(`组合 ${winner.id} 表现最佳，建议采用`)
      }
    } else {
      recommendations.push('暂无显著统计差异')
    }

    const totalImpressions = test.combinations.reduce((sum, c) => sum + c.impressions, 0)
    if (totalImpressions > 1000 && !stats.isSignificant) {
      recommendations.push('样本量充足但无显著差异，建议结束测试')
    }

    return recommendations
  }
}

export const abTestAutomationService = new ABTestAutomationService()
