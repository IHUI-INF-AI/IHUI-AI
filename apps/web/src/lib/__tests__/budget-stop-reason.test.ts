// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌‌‌​‌‍‍‌​​‌​​‌‍‍‌‌​‌‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌​‌‌​​​​‌​​‌‌‌‌‍‍​‌​​‌​​​‍‍‌‌‌‌‌‌​‍‍‌​‌​​​‌‍‍‌​‌‌‌‌‌‌‌​‌‌‌‍‍​‌‌‌‌‌‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌‌‌‌​‌‌‍‌‍‌​‍‍​‌​​​​‌‍‍​‌‌‌‌‌‌​‌​‌‍‍‌​​‌‌​‌‍⁠

import { describe, expect, it } from 'vitest'

import { BUDGET_STOP_REASON_CODES } from '@ihui/shared'
import {
  BUDGET_STOP_FALLBACK_TEXT,
  budgetStopReasonText,
  budgetStopReasonTexts,
} from '@ihui/shared/chat/budget-stop-note'

/**
 * 批次 3 原因码文案映射的封闭性（映射本体住 shared，web/RN/小程序三端同源）。
 * 判据不是"复读映射"，而是"封闭集每个码都被覆盖、且未知码不得被猜成任何具体原因"。
 */
describe('预算停止原因码文案映射', () => {
  it('封闭集逐码都有独立文案，且都不得回落到通用句', () => {
    const texts = budgetStopReasonTexts()
    expect(texts).toHaveLength(BUDGET_STOP_REASON_CODES.length)
    for (const [index, code] of BUDGET_STOP_REASON_CODES.entries()) {
      expect(texts[index]).not.toBe(BUDGET_STOP_FALLBACK_TEXT)
      expect(budgetStopReasonText(code)).toBe(texts[index])
    }
  })

  it('六种原因各说各的，不出现两句同文的"伪覆盖"', () => {
    const texts = budgetStopReasonTexts()
    expect(new Set(texts).size).toBe(texts.length)
  })

  it('未知码/缺失码一律回落通用句，不渲染猜测性具体原因', () => {
    expect(budgetStopReasonText('unknown_future_code')).toBe(BUDGET_STOP_FALLBACK_TEXT)
    expect(budgetStopReasonText('')).toBe(BUDGET_STOP_FALLBACK_TEXT)
    expect(budgetStopReasonText(null)).toBe(BUDGET_STOP_FALLBACK_TEXT)
    expect(budgetStopReasonText(undefined)).toBe(BUDGET_STOP_FALLBACK_TEXT)
    expect(budgetStopReasonText(42)).toBe(BUDGET_STOP_FALLBACK_TEXT)
  })
})
