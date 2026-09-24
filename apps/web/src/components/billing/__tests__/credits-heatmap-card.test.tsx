// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// D64 ①(2026-09-24):Credits 热力图卡的**视图模式切换 + 无数据不占位 + 桶级/下钻键**用例。
// 分桶与下钻判据在 `@ihui/shared/chat/element-pack`;本卡**不取数**,数据全部注入。
import { describe, it, expect, afterEach, vi } from 'vitest'
import React from 'react'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}))

import { CreditsHeatmapCard } from '../credits-heatmap-card'
import { HEATMAP_BUCKETS, HEATMAP_VIEW_MODES } from '@ihui/shared/chat/element-pack'

describe('D64 ① Credits 热力图卡', () => {
  afterEach(() => cleanup())

  it('无数据一律不渲染(不编造样例、不留空壳)', () => {
    for (const empty of [undefined, {}, { '': 3, '2026-09-24': Number.NaN }]) {
      const { container } = render(<CreditsHeatmapCard dayCounts={empty} />)
      expect(container.textContent).toBe('')
      cleanup()
    }
  })

  it('HEATMAP_VIEW_MODES 两档 tab 全在位且可切换(会话视图无明细 → 显式空态)', () => {
    render(<CreditsHeatmapCard dayCounts={{ '2026-09-24': 7 }} />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(HEATMAP_VIEW_MODES.length)
    for (const mode of HEATMAP_VIEW_MODES) {
      expect(document.querySelector(`[data-heatmap-tab="${mode}"]`)).toBeTruthy()
    }
    // 缺省是热力视图
    expect(screen.getByTestId('credits-heatmap-grid')).toBeTruthy()
    // 切到会话视图:没给 sessionCounts → 说"没有",不静默空白
    fireEvent.click(screen.getByRole('tab', { selected: false }))
    expect(document.querySelector('[data-session-empty]')?.textContent).toBe('sessionsEmpty')
    // 切回
    fireEvent.click(screen.getByRole('tab', { name: 'tab.heatmap' }))
    expect(screen.getByTestId('credits-heatmap-grid')).toBeTruthy()
  })

  it('桶级四档图例齐 + 单日格按判定层分桶;下钻键是 dayTitle(相对 heatmap 域,不得双前缀)', () => {
    render(<CreditsHeatmapCard dayCounts={{ d0: 0, d1: 3, d2: 9, d3: 40 }} />)
    for (const bucket of HEATMAP_BUCKETS) {
      expect(document.querySelector(`[data-heatmap-legend="${bucket}"]`)?.textContent).toBe(
        `legend.${bucket}`,
      )
    }
    expect(
      document.querySelector('[data-heatmap-day="d1"]')?.getAttribute('data-heatmap-bucket'),
    ).toBe('low')
    expect(
      document.querySelector('[data-heatmap-day="d3"]')?.getAttribute('data-heatmap-bucket'),
    ).toBe('high')
    // 点格子下钻
    fireEvent.click(screen.getByText('9'))
    const detail = document.querySelector('[data-day-detail="d2"]')
    expect(detail?.getAttribute('data-day-bucket')).toBe('mid')
    expect(detail?.textContent).toContain('dayTitle:{"date":"d2"}')
  })

  it('数据面从有→无→有:hook 次序稳定(早退曾在 useState 之前,会炸 React)', () => {
    const view = render(<CreditsHeatmapCard dayCounts={{ d1: 3 }} />)
    expect(screen.getByTestId('credits-heatmap-grid')).toBeTruthy()
    view.rerender(<CreditsHeatmapCard dayCounts={{}} />)
    expect(view.container.textContent).toBe('')
    view.rerender(<CreditsHeatmapCard dayCounts={{ d1: 3, d2: 30 }} />)
    expect(screen.getByTestId('credits-heatmap-grid')).toBeTruthy()
    expect(document.querySelectorAll('[data-heatmap-day]')).toHaveLength(2)
  })

  it('§4 禁用原生提示窗:日历格不得带 title 属性', () => {
    render(<CreditsHeatmapCard dayCounts={{ d1: 3 }} />)
    const cell = document.querySelector('[data-heatmap-day="d1"]')
    expect(cell?.hasAttribute('title')).toBe(false)
    expect(cell?.getAttribute('aria-label')).toBe('dayTitle:{"date":"d1"}')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
