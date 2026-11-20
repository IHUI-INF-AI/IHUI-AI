// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { EMPTY_HOOK_RUN_STATS } from '@/hooks/hook-run-stats'
import { HookReadout } from '../hook-readout'

// 本仓 vitest 未开全局 auto-cleanup:不显式清理时上一个用例的 DOM 会留在 body 里,
// 后续 getByTestId 会撞上「Found multiple elements」(第 44 项新增例时实测到)。
afterEach(() => cleanup())

const t = (key: string, values?: Record<string, string | number>): string => {
  if (key === 'runtimeHookStatsTitle') return 'TOTALS'
  if (key === 'runtimeHookAuditTitle') return 'AUDIT'
  if (key === 'runtimeHookAuditTruncated') return `TAIL:${values?.lines}`
  if (key === 'runtimeHookAuditHistoryOnly') return `HIST:${values?.kb}`
  if (key === 'runtimeHookAuditNearFull') return `runtimeHookAuditNearFull:${values?.pct}`
  if (key === 'runtimeHookStats') {
    return `${values?.total}/${values?.ok}/${values?.timeout}/${values?.error}/${values?.avg}ms/${values?.slowest}ms`
  }
  return key
}

const full = { total: 4, ok: 2, timeout: 1, error: 1, totalDurationMs: 400, slowestMs: 300 }
const audit = {
  total: 9,
  ok: 8,
  timeout: 1,
  error: 0,
  totalDurationMs: 900,
  slowestMs: 500,
  truncated: false,
  linesRead: 9,
  backupBytes: null,
  sizeBytes: null,
  maxBytes: null,
}
// 第 49 项:容量到 95% ⇒ 迟早轮转并覆盖唯一备份,必须在读数里说出来
const auditNearFull = {
  ...audit,
  sizeBytes: 4_800_000,
  maxBytes: 5_242_880,
}
// 第 49 项:容量取不到(stat 失败) ⇒ 不判,不许用 0 冒充"没满"
const auditCapacityUnknown = { ...audit, sizeBytes: null, maxBytes: null }
// 第 44 项:台账总行数超过读取上限 ⇒ 计数只覆盖尾部,必须标出来
const auditTruncated = { ...audit, truncated: true, linesRead: 20000 }
// 第 45 项:刚轮转完,当前台账为空、备份还在(40KB) ⇒ 不许呈现为"零次"
const auditHistoryOnly = {
  total: 0,
  ok: 0,
  timeout: 0,
  error: 0,
  totalDurationMs: 0,
  slowestMs: 0,
  truncated: false,
  linesRead: 0,
  backupBytes: 40 * 1024,
  sizeBytes: null,
  maxBytes: null,
}

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
      <HookReadout
        sessionStats={EMPTY_HOOK_RUN_STATS}
        auditStats={{
          ...EMPTY_HOOK_RUN_STATS,
          truncated: false,
          linesRead: 0,
          backupBytes: null,
          sizeBytes: null,
          maxBytes: null,
        }}
        t={t}
      />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('未截断时不出现尾部标记(全量台账不许自带"仅尾部")', () => {
    render(<HookReadout sessionStats={EMPTY_HOOK_RUN_STATS} auditStats={audit} t={t} />)
    expect(screen.queryByTestId('pane-runtime-hook-audit-truncated')).toBeNull()
  })

  it('第49项:容量到 90% 以上才报"接近轮转",并给整数百分比', () => {
    const { unmount } = render(
      <HookReadout sessionStats={EMPTY_HOOK_RUN_STATS} auditStats={auditNearFull} t={t} />,
    )
    // 4.8MB / 5MB ≈ 92%
    expect(screen.getByTestId('pane-runtime-hook-audit-near-full').textContent).toBe(
      'runtimeHookAuditNearFull:92',
    )
    unmount()
    // 低于 90% ⇒ 不打扰
    render(
      <HookReadout
        sessionStats={EMPTY_HOOK_RUN_STATS}
        auditStats={{ ...audit, sizeBytes: 1_000_000, maxBytes: 5_242_880 }}
        t={t}
      />,
    )
    expect(screen.queryByTestId('pane-runtime-hook-audit-near-full')).toBeNull()
  })

  it('第49项:容量取不到时不判(不许拿 0 当"没满")', () => {
    render(
      <HookReadout sessionStats={EMPTY_HOOK_RUN_STATS} auditStats={auditCapacityUnknown} t={t} />,
    )
    expect(screen.queryByTestId('pane-runtime-hook-audit-near-full')).toBeNull()
  })

  it('截断时显式标注只读到尾部 N 行(linesRead 不许冒充 total)', () => {
    render(
      <HookReadout sessionStats={EMPTY_HOOK_RUN_STATS} auditStats={auditTruncated} t={t} />,
    )
    expect(screen.getByTestId('pane-runtime-hook-audit-truncated').textContent).toBe('TAIL:20000')
    // 计数行本身仍按 total(9)显示:截断只说明覆盖范围,不改写已读到的计数
    expect(screen.getByTestId('pane-runtime-hook-audit').textContent).toContain('9/8/1/0/100ms/500ms')
  })

  it('第45项:轮转后当前台账为空、备份还在 ⇒ 报"仅存历史备份",不呈现零次', () => {
    render(
      <HookReadout sessionStats={EMPTY_HOOK_RUN_STATS} auditStats={auditHistoryOnly} t={t} />,
    )
    expect(screen.getByTestId('pane-runtime-hook-audit').textContent).toContain('AUDIT')
    expect(screen.getByTestId('pane-runtime-hook-audit-history-only').textContent).toBe('HIST:40')
    // 计数行不该出现:total=0 时没有任何可报的三态
    expect(screen.getByTestId('pane-runtime-hook-audit').textContent).not.toContain('0/0/0/0')
    expect(screen.queryByTestId('pane-runtime-hook-audit-truncated')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
