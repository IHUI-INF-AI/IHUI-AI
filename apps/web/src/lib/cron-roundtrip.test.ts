// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import {
  canVisualizeCron,
  parseCronToBuilder,
  buildCronExpr,
  resolveCronForVisualEditor,
} from '@/lib/cron-roundtrip'

describe('cron-roundtrip(b75-1#1)', () => {
  it('*/5 * * * * 回环一致 → canVisualizeCron=true,可视化往返无损', () => {
    const expr = '*/5 * * * *'
    expect(canVisualizeCron(expr)).toBe(true)
    expect(buildCronExpr(parseCronToBuilder(expr))).toBe(expr)
  })

  it('0 9 * * 1-5 回环一致(我方默认值)', () => {
    const expr = '0 9 * * 1-5'
    expect(canVisualizeCron(expr)).toBe(true)
    expect(buildCronExpr(parseCronToBuilder(expr))).toBe(expr)
  })

  it('年频 0 0 12 1 * 在 builder 中可表达(day=12/month=1 均 specific)→ 回环一致', () => {
    const expr = '0 0 12 1 *'
    expect(canVisualizeCron(expr)).toBe(true)
    expect(buildCronExpr(parseCronToBuilder(expr))).toBe(expr)
  })

  it('复杂混合表达式(step+range+specific 同字段)回环不一致 → fallback 自定义,原文逐字保留', () => {
    // minute 段 `*/5,30` 在 parseFieldState 中因存在 '/' 走 step 分支,丢失 ',30'
    // → buildCronExpr 输出 `*/5 * * * *` ≠ 原文,canVisualizeCron=false
    const expr = '*/5,30 * * * *'
    expect(canVisualizeCron(expr)).toBe(false)
    expect(resolveCronForVisualEditor(expr)).toBeNull()
  })

  it('resolveCronForVisualEditor:可可视化返回 trim 后原文,不可返回 null', () => {
    expect(resolveCronForVisualEditor('  0 9 * * 1-5  ')).toBe('0 9 * * 1-5')
    expect(resolveCronForVisualEditor('*/5,30 * * * *')).toBeNull()
  })

  it('空表达式不可可视化', () => {
    expect(canVisualizeCron('')).toBe(false)
    expect(resolveCronForVisualEditor('')).toBeNull()
  })

  it('多字段 specific 回环一致', () => {
    const expr = '0 9,12,18 * * 1,3,5'
    expect(canVisualizeCron(expr)).toBe(true)
    expect(buildCronExpr(parseCronToBuilder(expr))).toBe(expr)
  })
})

