// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { EMPTY_HOOK_RUN_STATS } from '@/hooks/hook-run-stats'
import { HookReadout } from '../hook-readout'

const t = (key: string, values?: Record<string, string | number>): string => {
  if (key === 'runtimeHookStatsTitle') return 'TOTALS'
  if (key === 'runtimeHookAuditTitle') return 'AUDIT'
  if (key === 'runtimeHookStats') {
    return `${values?.total}/${values?.ok}/${values?.timeout}/${values?.error}/${values?.avg}ms/${values?.slowest}ms`
  }
  return key
}

const full = { total: 4, ok: 2, timeout: 1, error: 1, totalDurationMs: 400, slowestMs: 300 }
const audit = { total: 9, ok: 8, timeout: 1, error: 0, totalDurationMs: 900, slowestMs: 500 }

describe('HookReadout', () => {
  it('有会话累计时只显示会话行,不重复显示台账行', () => {
    render(<HookReadout sessionStats={full} auditStats={audit} t={t} />)
    expect(screen.getByTestId('pane-runtime-hook-stats')).toBeTruthy()
    expect(screen.queryByTestId('pane-runtime-hook-audit')).toBeNull()
    expect(screen.getByText('TOTALS')).toBeTruthy()
  })

  it('会话累计为空(刷新后)回落到台账行', () => {
    render(<HookReadout sessionStats={EMPTY_HOOK_RUN_STATS} auditStats={audit} t={t} />)
    expect(screen.getByTestId('pane-runtime-hook-audit')).toBeTruthy()
    expect(screen.getByText('AUDIT')).toBeTruthy()
    // 均值 900/9 = 100,峰值 500 —— 由累计模块同一份算法给出
    expect(screen.getByText('9/8/1/0/100ms/500ms')).toBeTruthy()
  })

  it('两边都为空 ⇒ 什么都不渲染(零次不留空噪声)', () => {
    const { container } = render(
      <HookReadout sessionStats={EMPTY_HOOK_RUN_STATS} auditStats={null} t={t} />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('台账零条目 ⇒ 不冒充"跑过"', () => {
    const { container } = render(
      <HookReadout sessionStats={EMPTY_HOOK_RUN_STATS} auditStats={EMPTY_HOOK_RUN_STATS} t={t} />,
    )
    expect(container.innerHTML).toBe('')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
