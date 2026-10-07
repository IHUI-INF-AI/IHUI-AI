// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-816039:工具结果三投影拆分(给模型的 / 给人看的 / 落库的)。
 *
 * 票面四条判据(④ 端上 truncate 省略量属 apps/web 站点,不在本仓射程,已单独登记):
 *  ① 正例:output 被预算截断时,display 必须仍含被截掉那段(受自身上限管);
 *  ② 反例:display 超自身上限必须置 truncated:true,且全文不得借 display 进 metadata;
 *  ③ 反向锁(最硬):改动前后 `output` 逐字节同形 —— display 绝不替代喂模型的那一份。
 */
import { describe, expect, it } from 'vitest'

import {
  applyToolResultBudget,
  TOOL_RESULT_DISPLAY_LIMIT_BYTES,
  type ToolResult,
} from '../src/tools/index.js'
import type { ToolResultBudgetContract } from '@ihui/types'

function makeBudget(overrides: Partial<ToolResultBudgetContract> = {}): ToolResultBudgetContract {
  return {
    inlineLimitBytes: 100,
    providerVisibleLimitBytes: 1_000_000,
    policy: 'truncate',
    preview: { bytes: 64, lines: 3, from: 'head' },
    ...overrides,
  }
}

describe('G-816039 display 投影', () => {
  it('① 正例:output 被预算截断,display 仍含被截掉的那段(受自身上限管)', () => {
    const lines = Array.from({ length: 50 }, (_, i) => `line-${i}`)
    const original = lines.join('\n')
    const out = applyToolResultBudget({ success: true, output: original }, makeBudget())
    // output 侧确被裁剪(模型只看到预览)
    expect(out.output).not.toContain('line-49')
    // display 侧保住全文 —— 被截掉的那段在这里,受 display 自身上限管
    expect(out.display).toBeDefined()
    expect(out.display!.text).toBe(original)
    expect(out.display!.truncated).toBeUndefined() // 未超 display 上限,不写 false 噪音
    expect(out.display!.originalBytes).toBe(Buffer.byteLength(original, 'utf8'))
    expect(out.display!.returnedBytes).toBe(out.display!.originalBytes)
    expect(out.display!.budgetStrategy).toBe('truncate')
  })

  it('② 反例:display 超 200KiB 上限 ⇒ truncated:true,且全文不得进 metadata', () => {
    // 原文 200KiB+:output 预算很小 ⇒ 必裁;display 侧也吃不下 ⇒ 必须截断并亮结论位
    const big = 'X'.repeat(TOOL_RESULT_DISPLAY_LIMIT_BYTES + 1_000)
    const out = applyToolResultBudget({ success: true, output: big }, makeBudget())
    expect(out.display).toBeDefined()
    expect(out.display!.truncated).toBe(true)
    expect(Buffer.byteLength(out.display!.text, 'utf8')).toBeLessThanOrEqual(TOOL_RESULT_DISPLAY_LIMIT_BYTES)
    expect(out.display!.text).not.toBe(big) // 全文没有被整块塞进 metadata
    expect(out.display!.returnedBytes).toBe(TOOL_RESULT_DISPLAY_LIMIT_BYTES)
    expect(out.display!.originalBytes).toBe(Buffer.byteLength(big, 'utf8'))
  })

  it('③ 反向锁:output 逐字节同形 —— display 的加入不改喂模型的那一份', () => {
    const lines = Array.from({ length: 50 }, (_, i) => `line-${i}`)
    const original = lines.join('\n')
    const budget = makeBudget()
    const out = applyToolResultBudget({ success: true, output: original }, budget)
    // 按 G-720 落地时(引入 display 之前)的同一条公式逐字节重建期望值:
    // 裁剪后的内容 + 头部标注,original/kept 两数来自同一算法。
    const totalBytes = Buffer.byteLength(original, 'utf8')
    const keptLines = lines.slice(0, 3)
    let kept = keptLines.join('\n')
    if (Buffer.byteLength(kept, 'utf8') > 64) {
      kept = Buffer.from(kept, 'utf8').subarray(0, 64).toString('utf8')
    }
    const keptBytes = Buffer.byteLength(kept, 'utf8')
    const note =
      `[tool-result-budget] output truncated: original ${totalBytes} bytes, showing ${keptBytes} bytes ` +
      `(policy: truncate, preview from head). ` +
      `This is a partial view, not the complete tool output.`
    expect(out.output).toBe(`${note}\n${kept}`)
    // 双保险:output 不含 display 全文才有的尾部行(display 存在但不回灌模型)
    expect(out.output).not.toContain('line-49')
    expect(out.display!.text).toContain('line-49')
  })

  it('未截断的结果零行为变更:同一引用返回,不产 display(三投影本就同文)', () => {
    const result: ToolResult = { success: true, output: 'tiny' }
    const out = applyToolResultBudget(result, makeBudget())
    expect(out).toBe(result)
    expect(out.display).toBeUndefined()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
