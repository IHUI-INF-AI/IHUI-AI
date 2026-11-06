// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:批次 3 预算停止文案跨端单一出口测试。

import { describe, expect, it } from 'vitest'
import { BUDGET_STOP_REASON_CODES } from '../sse/contract'
import {
  BUDGET_STOP_FALLBACK_TEXT,
  budgetStopReasonText,
  budgetStopReasonTexts,
} from './budget-stop-note'

describe('budgetStopReasonText — 原因码文案单一出口', () => {
  it('封闭集每码都有独立文案,且不等于通用回落句', () => {
    const texts = budgetStopReasonTexts()
    expect(texts).toHaveLength(BUDGET_STOP_REASON_CODES.length)
    expect(new Set(texts).size).toBe(BUDGET_STOP_REASON_CODES.length)
    for (const text of texts) expect(text).not.toBe(BUDGET_STOP_FALLBACK_TEXT)
  })

  it('逐码取文案,不串码', () => {
    expect(budgetStopReasonText('daily_token_limit')).toContain('今日 token')
    expect(budgetStopReasonText('pillar_token_limit')).toContain('能力支柱')
    expect(budgetStopReasonText('provider_budget_exhausted')).toContain('上游模型')
  })

  it('未知码/缺失码回落通用句,不猜具体原因', () => {
    expect(budgetStopReasonText('future_code_from_newer_server')).toBe(BUDGET_STOP_FALLBACK_TEXT)
    expect(budgetStopReasonText(undefined)).toBe(BUDGET_STOP_FALLBACK_TEXT)
    expect(budgetStopReasonText(null)).toBe(BUDGET_STOP_FALLBACK_TEXT)
    expect(budgetStopReasonText(42)).toBe(BUDGET_STOP_FALLBACK_TEXT)
  })
})
