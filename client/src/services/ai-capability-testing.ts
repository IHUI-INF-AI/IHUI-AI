/**
 * AI 能力测试和验证工具
 * 提供能力测试、验证和基准测试功能
 */

import { ref } from 'vue'
import { AICapabilityType, type AICapabilityRequest } from './unified-ai-orchestrator'
import { getUnifiedAIOrchestrator } from './unified-ai-orchestrator'

// 测试用例
export interface TestCase {
  id: string
  name: string
  description?: string
  input: Record<string, unknown>
  expectedOutput?: Record<string, unknown>
  expectedPattern?: RegExp
  validation?: (output: Record<string, unknown>) => boolean
  timeout?: number
}

// 测试结果
export interface TestResult {
  testCaseId: string
  testCaseName: string
  success: boolean
  actualOutput?: Record<string, unknown>
  error?: string
  latency: number
  timestamp: number
}

// 测试套件
export interface TestSuite {
  id: string
  name: string
  description?: string
  capabilityType: AICapabilityType
  capabilityId?: string
  testCases: TestCase[]
  createdAt: number
}

// 测试报告
export interface TestReport {
  suiteId: string
  suiteName: string
  totalTests: number
  passedTests: number
  failedTests: number
  averageLatency: number
  results: TestResult[]
  timestamp: number
}

// 基准测试配置
export interface BenchmarkConfig {
  capabilityType: AICapabilityType
  capabilityId?: string
  testCases: TestCase[]
  iterations: number
  concurrency?: number
  timeout?: number
}

// 基准测试结果
export interface BenchmarkResult {
  capabilityId: string
  totalTests: number
  totalIterations: number
  successRate: number
  averageLatency: number
  p50Latency: number
  p95Latency: number
  p99Latency: number
  minLatency: number
  maxLatency: number
  throughput: number // 每秒处理数
  errorRate: number
  results: TestResult[]
  timestamp: number
}

/**
 * AI 能力测试系统
 */
export class AICapabilityTesting {
  private orchestrator = getUnifiedAIOrchestrator()
  private testSuites = ref<Map<string, TestSuite>>(new Map())
  private testReports = ref<Map<string, TestReport[]>>(new Map())

  /**
   * 创建测试套件
   */
  createTestSuite(suite: Omit<TestSuite, 'id' | 'createdAt'>): TestSuite {
    const id = `suite-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const now = Date.now()

    const newSuite: TestSuite = {
      ...suite,
      id,
      createdAt: now,
    }

    this.testSuites.value.set(id, newSuite)
    return newSuite
  }

  /**
   * 运行测试套件
   */
  async runTestSuite(suiteId: string): Promise<TestReport> {
    const suite = this.testSuites.value.get(suiteId)
    if (!suite) {
      throw new Error(`测试套件 ${suiteId} 不存在`)
    }

    const results: TestResult[] = []

    for (const testCase of suite.testCases) {
      const result = await this.runTestCase(suite, testCase)
      results.push(result)
    }

    const passedTests = results.filter(r => r.success).length
    const failedTests = results.length - passedTests
    const averageLatency = results.reduce((sum, r) => sum + r.latency, 0) / results.length

    const report: TestReport = {
      suiteId,
      suiteName: suite.name,
      totalTests: results.length,
      passedTests,
      failedTests,
      averageLatency,
      results,
      timestamp: Date.now(),
    }

    // 保存报告
    if (!this.testReports.value.has(suiteId)) {
      this.testReports.value.set(suiteId, [])
    }
    this.testReports.value.get(suiteId)!.unshift(report)

    return report
  }

  /**
   * 运行单个测试用例
   */
  private async runTestCase(suite: TestSuite, testCase: TestCase): Promise<TestResult> {
    const startTime = performance.now()

    try {
      const request: AICapabilityRequest = {
        type: suite.capabilityType,
        capabilityId: suite.capabilityId,
        input: testCase.input,
        options: {
          timeout: testCase.timeout || 30000,
        },
      }

      const response = await this.orchestrator.invokeCapability(request)
      const latency = performance.now() - startTime

      // 验证结果
      let success = response.success

      if (success && testCase.expectedOutput !== undefined) {
        success = this.deepEqual(response.data, testCase.expectedOutput)
      }

      if (success && testCase.expectedPattern) {
        const outputStr = JSON.stringify(response.data)
        success = testCase.expectedPattern.test(outputStr)
      }

      if (success && testCase.validation) {
        success = testCase.validation(response.data as Record<string, unknown>)
      }

      return {
        testCaseId: testCase.id,
        testCaseName: testCase.name,
        success,
        actualOutput: response.data as Record<string, unknown>,
        latency,
        timestamp: Date.now(),
      }
    } catch (error: any) {
      const err = error as { message?: string }
      const latency = performance.now() - startTime

      return {
        testCaseId: testCase.id,
        testCaseName: testCase.name,
        success: false,
        error: err?.message || String(error),
        latency,
        timestamp: Date.now(),
      }
    }
  }

  /**
   * 运行基准测试
   */
  async runBenchmark(config: BenchmarkConfig): Promise<BenchmarkResult> {
    const allResults: TestResult[] = []
    const latencies: number[] = []
    let errors: number = 0

    const iterations = config.iterations || 10
    const concurrency = config.concurrency || 1

    // 创建测试套件
    const suite: TestSuite = {
      id: `benchmark-${Date.now()}`,
      name: '基准测试',
      capabilityType: config.capabilityType,
      capabilityId: config.capabilityId,
      testCases: config.testCases,
      createdAt: Date.now(),
    }

    // 运行多次迭代
    for (let i = 0; i < iterations; i++) {
      const batchResults: Promise<TestResult>[] = []

      // 并发执行
      for (let j = 0; j < concurrency; j++) {
        for (const testCase of config.testCases) {
          batchResults.push(this.runTestCase(suite, testCase))
        }
      }

      const batch = await Promise.all(batchResults)
      allResults.push(...batch)

      // 收集延迟数据
      for (const result of batch) {
        if (result.success) {
          latencies.push(result.latency)
        } else {
          errors++
        }
      }
    }

    // 计算统计信息
    latencies.sort((a, b) => a - b)
    const totalTests = allResults.length
    const successCount = allResults.filter(r => r.success).length
    const successRate = successCount / totalTests
    const errorRate = errors / totalTests

    const averageLatency = latencies.reduce((sum, l) => sum + l, 0) / latencies.length
    const p50Latency = latencies[Math.floor(latencies.length * 0.5)] || 0
    const p95Latency = latencies[Math.floor(latencies.length * 0.95)] || 0
    const p99Latency = latencies[Math.floor(latencies.length * 0.99)] || 0
    const minLatency = latencies[0] || 0
    const maxLatency = latencies[latencies.length - 1] || 0

    const totalTime = allResults.reduce((sum, r) => sum + r.latency, 0)
    const throughput = (totalTests / totalTime) * 1000 // 每秒处理数

    return {
      capabilityId: config.capabilityId || 'unknown',
      totalTests,
      totalIterations: iterations,
      successRate,
      averageLatency,
      p50Latency,
      p95Latency,
      p99Latency,
      minLatency,
      maxLatency,
      throughput,
      errorRate,
      results: allResults,
      timestamp: Date.now(),
    }
  }

  /**
   * 获取测试套件
   */
  getTestSuite(suiteId: string): TestSuite | null {
    return this.testSuites.value.get(suiteId) || null
  }

  /**
   * 获取所有测试套件
   */
  getAllTestSuites(): TestSuite[] {
    return Array.from(this.testSuites.value.values())
  }

  /**
   * 获取测试报告
   */
  getTestReports(suiteId: string, limit?: number): TestReport[] {
    const reports = this.testReports.value.get(suiteId) || []
    return limit ? reports.slice(0, limit) : reports
  }

  /**
   * 深度比较
   */
  private deepEqual(a: any, b: any): boolean {
    if (a === b) return true
    if (a == null || b == null) return false
    if (typeof a !== typeof b) return false

    if (typeof a === 'object' && a !== null && typeof b === 'object' && b !== null) {
      const keysA = Object.keys(a)
      const keysB = Object.keys(b)
      const objA = a as Record<string, unknown>
      const objB = b as Record<string, unknown>

      if (keysA.length !== keysB.length) return false

      for (const key of keysA) {
        if (!keysB.includes(key)) return false
        if (!this.deepEqual(objA[key], objB[key])) return false
      }

      return true
    }

    return false
  }

  /**
   * 创建预设测试用例
   */
  createPresetTestCases(capabilityType: AICapabilityType): TestCase[] {
    const testCases: TestCase[] = []

    switch (capabilityType) {
      case AICapabilityType.MODEL:
        testCases.push(
          {
            id: 'basic-chat',
            name: '基础对话测试',
            input: '你好' as unknown as Record<string, unknown>,
            validation: (output: any) => typeof output === 'string' && output.length > 0,
          },
          {
            id: 'long-text',
            name: '长文本生成测试',
            input: '请写一篇关于人工智能的文章，至少500字' as unknown as Record<string, unknown>,
            validation: (output: any) => typeof output === 'string' && output.length > 500,
            timeout: 60000,
          }
        )
        break

      case AICapabilityType.AGENT:
        testCases.push({
          id: 'agent-response',
          name: 'Agent 响应测试',
          input: '测试消息' as unknown as Record<string, unknown>,
          validation: (output: any) => output !== null && output !== undefined,
        })
        break

      case AICapabilityType.MCP:
        testCases.push({
          id: 'tool-execution',
          name: '工具执行测试',
          input: {},
          validation: (output: any) => output !== null && output !== undefined,
        })
        break
    }

    return testCases
  }
}

// 单例实例
let testingInstance: AICapabilityTesting | null = null

/**
 * 获取 AI 能力测试实例
 */
export function getAICapabilityTesting(): AICapabilityTesting {
  if (!testingInstance) {
    testingInstance = new AICapabilityTesting()
  }
  return testingInstance
}
