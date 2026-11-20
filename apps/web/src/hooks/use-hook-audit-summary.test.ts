// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import { normalizeHookAuditSummary } from './use-hook-audit-summary'

describe('normalizeHookAuditSummary', () => {
  it('可用台账收成 HookRunStats 同字段集', () => {
    const stats = normalizeHookAuditSummary({
      available: true,
      total: 5,
      ok: 3,
      timeout: 1,
      error: 1,
      totalDurationMs: 1200,
      slowestMs: 900,
    })
    expect(stats).toEqual({
      total: 5,
      ok: 3,
      timeout: 1,
      error: 1,
      totalDurationMs: 1200,
      slowestMs: 900,
      truncated: false,
      linesRead: 0,
    })
  })

  it('第44项:截断标记与读到行数原样收下(字段缺失按未截断)', () => {
    const stats = normalizeHookAuditSummary({
      available: true,
      total: 5,
      ok: 5,
      timeout: 0,
      error: 0,
      totalDurationMs: 500,
      slowestMs: 200,
      truncated: true,
      linesRead: 20000,
    })
    expect(stats?.truncated).toBe(true)
    expect(stats?.linesRead).toBe(20000)
  })

  it('第44项:truncated 只认显式 true(字符串 "true"/缺字段都不许标截断)', () => {
    const base = {
      available: true,
      total: 1,
      ok: 1,
      timeout: 0,
      error: 0,
      totalDurationMs: 100,
      slowestMs: 100,
    }
    expect(normalizeHookAuditSummary({ ...base, truncated: 'true' })?.truncated).toBe(false)
    expect(normalizeHookAuditSummary({ ...base, truncated: undefined })?.truncated).toBe(false)
  })

  it('台账不存在(available=false)⇒ null,不冒充零次运行', () => {
    expect(
      normalizeHookAuditSummary({ available: false, total: 0, ok: 0, timeout: 0, error: 0 }),
    ).toBeNull()
  })

  it('零条目 ⇒ null(面板没有可报的东西)', () => {
    expect(
      normalizeHookAuditSummary({
        available: true,
        total: 0,
        ok: 0,
        timeout: 0,
        error: 0,
        totalDurationMs: 0,
        slowestMs: 0,
      }),
    ).toBeNull()
  })

  it('负数与三态越界计数不呈现(宁可空着也不报错数)', () => {
    expect(
      normalizeHookAuditSummary({
        available: true,
        total: 2,
        ok: 3,
        timeout: 0,
        error: 0,
        totalDurationMs: -5,
        slowestMs: -1,
      }),
    ).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
