/**
 * AI 能力测试服务。
 *
 * 对 AI 能力做自动化测试：
 * - 测试用例：基于能力的 inputExample 生成测试用例
 * - 执行：调用能力（实际由调用方注入 executor），收集输出
 * - 评估：对比 expected output，计算准确率/延迟/稳定性
 * - 报告：输出测试报告，标记通过/失败/警告
 *
 * 设计：本服务只负责测试编排，不直接调用 AI 模型。
 */

import { eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { aiCapabilities } from '@ihui/database'
import { callRealLlm, type LlmMessage } from '../crew-llm-adapter.js'

export interface TestCase {
  id: string
  name: string
  input: unknown
  expected?: unknown
  timeout?: number
}

export interface TestResult {
  caseId: string
  name: string
  passed: boolean
  output: unknown
  durationMs: number
  error?: string
  assertionResults: Array<{ description: string; passed: boolean }>
}

export interface TestReport {
  capabilityId: string
  totalCases: number
  passed: number
  failed: number
  durationMs: number
  results: TestResult[]
  summary: string
}

export type CapabilityExecutor = (capabilityId: string, input: unknown) => Promise<unknown>

const executors = new Map<string, CapabilityExecutor>()

/** 全局执行器:对所有能力生效,优先级低于按 capabilityId 注册的执行器,高于 defaultExecutor。 */
let globalExecutor: CapabilityExecutor | null = null

/** 设置全局执行器(自动注册时调用)。 */
export function setGlobalExecutor(executor: CapabilityExecutor | null): void {
  globalExecutor = executor
}

/** 注册能力的执行器（由调用方注入实际调用逻辑）。 */
export function registerExecutor(capabilityId: string, executor: CapabilityExecutor): void {
  executors.set(capabilityId, executor)
}

/** 默认执行器：直接返回 input（占位，仅用于冒烟测试）。 */
const defaultExecutor: CapabilityExecutor = async (_id, input) => input

/** 从能力的 inputExample 生成默认测试用例集。 */
export async function generateTestCases(capabilityId: string): Promise<TestCase[]> {
  const [cap] = await db.select().from(aiCapabilities).where(eq(aiCapabilities.id, capabilityId))
  if (!cap) return []

  const cases: TestCase[] = []
  if (cap.inputExample) {
    cases.push({
      id: 'default-input-example',
      name: '使用 inputExample 作为冒烟测试',
      input: cap.inputExample,
      timeout: 30000,
    })
  }
  if (cap.outputExample) {
    cases.push({
      id: 'default-output-match',
      name: '验证 outputExample 一致性',
      input: cap.inputExample ?? {},
      expected: cap.outputExample,
      timeout: 30000,
    })
  }
  // 边界用例：空输入
  cases.push({
    id: 'empty-input',
    name: '空输入容错测试',
    input: {},
    timeout: 5000,
  })
  return cases
}

/** 执行单个测试用例。 */
export async function runTestCase(capabilityId: string, testCase: TestCase): Promise<TestResult> {
  const executor = executors.get(capabilityId) ?? globalExecutor ?? defaultExecutor
  const start = Date.now()
  const assertionResults: Array<{ description: string; passed: boolean }> = []
  let passed = true
  let output: unknown = null
  let error: string | undefined

  try {
    const timeout = testCase.timeout ?? 30000
    const result = await Promise.race([
      executor(capabilityId, testCase.input),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`超时 ${timeout}ms`)), timeout),
      ),
    ])
    output = result
    assertionResults.push({ description: '执行未抛出异常', passed: true })

    // 期望值对比
    if (testCase.expected !== undefined) {
      const matches = JSON.stringify(output) === JSON.stringify(testCase.expected)
      assertionResults.push({
        description: '输出与期望一致',
        passed: matches,
      })
      if (!matches) passed = false
    }

    // 输出非空检查
    if (output === null || output === undefined || output === '') {
      assertionResults.push({ description: '输出非空', passed: false })
      passed = false
    } else {
      assertionResults.push({ description: '输出非空', passed: true })
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err)
    passed = false
    assertionResults.push({ description: '执行未抛出异常', passed: false })
  }

  return {
    caseId: testCase.id,
    name: testCase.name,
    passed,
    output,
    durationMs: Date.now() - start,
    error,
    assertionResults,
  }
}

/** 运行能力的所有测试用例。 */
export async function runTests(
  capabilityId: string,
  customCases?: TestCase[],
): Promise<TestReport> {
  const cases = customCases ?? (await generateTestCases(capabilityId))
  const start = Date.now()
  const results: TestResult[] = []

  for (const tc of cases) {
    results.push(await runTestCase(capabilityId, tc))
  }

  const passed = results.filter((r) => r.passed).length
  const failed = results.length - passed
  const summary = `${passed}/${results.length} 通过，${failed} 失败，总耗时 ${Date.now() - start}ms`

  return {
    capabilityId,
    totalCases: results.length,
    passed,
    failed,
    durationMs: Date.now() - start,
    results,
    summary,
  }
}

/** 批量运行多个能力的测试。 */
export async function runBatchTests(
  capabilityIds: string[],
): Promise<Array<{ capabilityId: string; report: TestReport | null; error?: string }>> {
  const out: Array<{ capabilityId: string; report: TestReport | null; error?: string }> = []
  for (const id of capabilityIds) {
    try {
      const report = await runTests(id)
      out.push({ capabilityId: id, report })
    } catch (err) {
      out.push({
        capabilityId: id,
        report: null,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
  return out
}

/** 对所有 production 能力运行冒烟测试（应定时执行）。 */
export async function smokeTestAll(): Promise<
  Array<{ capabilityId: string; report: TestReport | null }>
> {
  const rows = await db.select().from(aiCapabilities).where(eq(aiCapabilities.status, 'production'))
  return runBatchTests(rows.map((r) => r.id))
}

// ===== 自动注册:LLM 真实执行器 =====
// 模块加载时自动注册全局执行器,使测试默认调用真实 LLM(通过 ai-service LiteLLM 网关)。
// defaultExecutor 保留作为最终兜底(LLM 不可用时由 runTestCase 的 catch 处理)。
setGlobalExecutor(async (capabilityId, input) => {
  const inputStr = typeof input === 'string' ? input : JSON.stringify(input)
  const messages: LlmMessage[] = [
    {
      role: 'system',
      content: `你是 AI 能力执行器。能力 ID: ${capabilityId}。根据输入执行能力并返回结果。`,
    },
    { role: 'user', content: inputStr },
  ]
  const result = await callRealLlm({ messages, temperature: 0, maxTokens: 1000 })
  return result.content
})
