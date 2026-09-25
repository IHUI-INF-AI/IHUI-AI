// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * H-5:ToolResultBudgetContract 接入工具 executor 边界的测试。
 *
 * 装车证明口径:本仓最高频事故是"造好没装车"(纯函数单测全绿而主循环一次没调)。
 * 所以"接线在位"的证明不走 spy/mock 内部函数(ESM 模块内部绑定对命名空间 spy 天然免疫,
 * mock 出来的"接线"是假证明),而是直接驱动**生产入口** `executeToolCall`:
 *   - 注册带 contract.resultBudget 的真工具,handler 用 vi.fn 包裹以取证"handler 真的跑了";
 *   - 断言 executeToolCall 返回的 output 与 handler 原文不同、带预算标注且形状符合契约
 *     —— 把 executeToolCall 收口处的 withToolResultBudget 调用摘掉,下面这些断言立刻红。
 * 契约语义断言(packages/types/src/tool-contract.ts 字段注释为准,不臆造):
 *   preview 裁剪(head/tail)、providerVisibleLimitBytes 独立硬上限、inline 不裁、
 *   artifact 档降级、契约缺席零行为变更、error 字段不参与预算。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyToolResultBudget,
  clearTools,
  executeToolCall,
  formatToolResult,
  registerTools,
  resetRateLimiter,
  withToolResultBudget,
  type Tool,
  type ToolContext,
  type ToolResult,
} from '../src/tools/index.js'
import type { ToolContract, ToolResultBudgetContract } from '@ihui/types'

/** 预算字面量:默认档 + 逐字段覆盖,让每个用例只突出一个语义。 */
function makeBudget(overrides: Partial<ToolResultBudgetContract> = {}): ToolResultBudgetContract {
  return {
    inlineLimitBytes: 100,
    providerVisibleLimitBytes: 1_000_000,
    policy: 'truncate',
    preview: { bytes: 64, lines: 3, from: 'head' },
    ...overrides,
  }
}

/** 构造一份完整契约:shape/permission 取最小合法声明,只让 resultBudget 变化。 */
function makeContract(resultBudget: ToolResultBudgetContract): ToolContract {
  return {
    shape: { visibleToProvider: true, input: { type: 'object' } },
    permission: {
      permissionKey: 'test:result-budget',
      reason: 'test-only contract',
      riskLevel: 'read',
      effectScope: 'none',
      requiresApproval: false,
    },
    resultBudget,
  }
}

function makeTool(name: string, output: string, contract?: ToolContract): Tool {
  return {
    name,
    description: 'H-5 budget test tool',
    parameters: {},
    required: [],
    ...(contract ? { contract } : {}),
    execute: async () => ({ success: true, output }),
  }
}

const ctx: ToolContext = { workspacePath: '.' }

beforeEach(() => {
  clearTools()
  resetRateLimiter()
})

afterEach(() => {
  clearTools()
})

describe('applyToolResultBudget:契约字段语义(纯函数)', () => {
  it('小结果(未超 inlineLimitBytes)零改写原样返回,不加标注', () => {
    const result: ToolResult = { success: true, output: 'tiny' }
    const out = applyToolResultBudget(result, makeBudget())
    expect(out).toBe(result)
    expect(out.output).toBe('tiny')
  })

  it('truncate 档:超 inlineLimitBytes 按 preview 裁剪(head 侧保留前 3 行),标注在头部', () => {
    const lines = Array.from({ length: 50 }, (_, i) => `line-${i}`)
    const result: ToolResult = { success: true, output: lines.join('\n') }
    const out = applyToolResultBudget(result, makeBudget())
    expect(out.output).toContain('[tool-result-budget]')
    expect(out.output).toContain('policy: truncate')
    expect(out.output).toContain('line-0')
    expect(out.output).toContain('line-2')
    expect(out.output).not.toContain('line-3')
    expect(out.output).not.toContain('line-49')
  })

  it('truncate 档 from=tail 保留尾部行', () => {
    const lines = Array.from({ length: 50 }, (_, i) => `line-${i}`)
    const result: ToolResult = { success: true, output: lines.join('\n') }
    const out = applyToolResultBudget(
      result,
      makeBudget({ preview: { bytes: 64, lines: 3, from: 'tail' } }),
    )
    expect(out.output).toContain('line-47')
    expect(out.output).toContain('line-49')
    expect(out.output).not.toContain('line-46')
  })

  it('inline 档:超 inlineLimitBytes 仍完整内联(声明方接受大结果),不加标注', () => {
    const big = 'A'.repeat(500)
    const result: ToolResult = { success: true, output: big }
    const out = applyToolResultBudget(
      result,
      makeBudget({ policy: 'inline', preview: { bytes: 16, lines: 2, from: 'head' } }),
    )
    expect(out).toBe(result)
    expect(out.output).toBe(big)
  })

  it('providerVisibleLimitBytes 是独立硬上限:inline 档越过它也被裁到上限内', () => {
    const result: ToolResult = { success: true, output: 'A'.repeat(10_000) }
    const out = applyToolResultBudget(
      result,
      makeBudget({
        inlineLimitBytes: 1_000_000,
        providerVisibleLimitBytes: 2_000,
        policy: 'inline',
        preview: { bytes: 512, lines: 100, from: 'head' },
      }),
    )
    expect(out.output).toContain('[tool-result-budget]')
    // 内容被裁到 min(preview.bytes, providerVisibleLimitBytes) = 512 个 A
    expect((out.output.match(/A/g) ?? []).length).toBe(512)
    expect(out.output).toContain('original 10000 bytes')
    expect(out.output).toContain('showing 512 bytes')
  })

  it('artifact 档:本仓无存储承接设施,降级为 truncate 预览并在标注注明 fallback', () => {
    const lines = Array.from({ length: 50 }, (_, i) => `line-${i}`)
    const result: ToolResult = { success: true, output: lines.join('\n') }
    const out = applyToolResultBudget(result, makeBudget({ policy: 'artifact' }))
    expect(out.output).toContain('policy: artifact')
    expect(out.output).toContain('truncate fallback')
    expect(out.output).toContain('line-0')
    expect(out.output).not.toContain('line-3')
  })

  it('error 结果(output 为空)不参与预算,原样返回', () => {
    const result: ToolResult = { success: false, output: '', error: 'boom' }
    const out = applyToolResultBudget(
      result,
      makeBudget({
        inlineLimitBytes: 1,
        providerVisibleLimitBytes: 1,
        preview: { bytes: 1, lines: 1, from: 'head' },
      }),
    )
    expect(out).toBe(result)
  })

  it('声明不自洽(preview.bytes 大于硬上限)时,providerVisibleLimitBytes 赢', () => {
    const result: ToolResult = { success: true, output: 'B'.repeat(1_000) }
    const out = applyToolResultBudget(
      result,
      makeBudget({
        inlineLimitBytes: 100,
        providerVisibleLimitBytes: 300,
        preview: { bytes: 5_000, lines: 100, from: 'head' },
      }),
    )
    expect((out.output.match(/B/g) ?? []).length).toBe(300)
  })
})

describe('withToolResultBudget:契约缺席 = 零行为变更', () => {
  it('无 contract 的工具逐字节原样返回(同一引用)', () => {
    const tool = makeTool('no_contract_tool', 'x'.repeat(9_999))
    const result: ToolResult = { success: true, output: 'x'.repeat(9_999) }
    expect(withToolResultBudget(tool, result)).toBe(result)
  })

  it('有 contract 的工具按预算处置', () => {
    const tool = makeTool(
      'with_contract_tool',
      'a'.repeat(100),
      makeContract(makeBudget({ inlineLimitBytes: 10 })),
    )
    const out = withToolResultBudget(tool, { success: true, output: 'a'.repeat(100) })
    expect(out.output).toContain('[tool-result-budget]')
  })
})

describe('装车证明:executeToolCall 生产路径真实消费契约(摘掉收口接线即红)', () => {
  it('handler 真跑、其原文在 executor 边界被按契约改写,标注进入回灌模型的最终形态', async () => {
    const big = Array.from({ length: 40 }, (_, i) => `row-${i}`).join('\n')
    const budget = makeContract(
      makeBudget({ inlineLimitBytes: 50, preview: { bytes: 64, lines: 2, from: 'head' } }),
    )
    const executeSpy = vi.fn(async () => ({ success: true, output: big }))
    const tool: Tool = { ...makeTool('e2e_budget_tool', big, budget), execute: executeSpy }
    registerTools([tool])

    const result = await executeToolCall({ name: 'e2e_budget_tool', arguments: {} }, ctx)

    // handler 确实执行了(排除空转走别的分支)
    expect(executeSpy).toHaveBeenCalledTimes(1)
    // executor 边界改写了 handler 原文 —— 摘掉 executeToolCall 收口处的 withToolResultBudget,这条立刻红
    expect(result.output).not.toBe(big)
    expect(result.output).not.toContain('row-2')
    expect(result.output).toContain('[tool-result-budget]')
    expect(result.output).toContain('policy: truncate')
    expect(result.output).toContain('row-0')
    expect(result.output).toContain('row-1')

    // "返回给模型之前"的最后一步(formatToolResult → 回灌)标注仍在场
    const forModel = formatToolResult({ name: 'e2e_budget_tool', arguments: {} }, result)
    expect(forModel).toContain('[tool-result-budget]')
  })

  it('契约缺席的工具同路径执行:输出不被改写(本票不改无契约工具的行为)', async () => {
    const big = 'C'.repeat(5_000)
    const executeSpy = vi.fn(async () => ({ success: true, output: big }))
    const tool: Tool = { ...makeTool('e2e_no_contract_tool', big), execute: executeSpy }
    registerTools([tool])

    const result = await executeToolCall({ name: 'e2e_no_contract_tool', arguments: {} }, ctx)
    expect(executeSpy).toHaveBeenCalledTimes(1)
    expect(result.output).toBe(big)
    expect(result.output).not.toContain('[tool-result-budget]')
  })
})

// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
