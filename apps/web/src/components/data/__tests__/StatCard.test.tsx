// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { StatCard } from '../StatCard'

afterEach(() => cleanup())

function trendEl(container: HTMLElement): HTMLElement {
  const el = container.querySelector<HTMLElement>('[data-stat-trend]')
  if (!el) throw new Error('missing trend')
  return el
}

function valueEl(container: HTMLElement): HTMLElement {
  const el = container.querySelector<HTMLElement>('[data-stat-value]')
  if (!el) throw new Error('missing value')
  return el
}

describe('StatCard 涨跌配色', () => {
  it('涨用危险文字令牌,不使用调色板绿', () => {
    const { container } = render(
      <StatCard title="今日收入" value="¥1,280" trend={12.5} trendLabel="较昨日" />,
    )
    const trend = trendEl(container)
    expect(trend.getAttribute('data-stat-trend')).toBe('rise')
    expect(trend.className).toContain('text-danger-text')
    expect(trend.className).not.toContain('text-success-text')
    expect(trend.className).not.toMatch(/emerald|text-red-/)
    expect(trend.querySelector('.lucide-trending-up')).not.toBeNull()
    expect(trend.querySelector('.lucide-trending-down')).toBeNull()
    expect(trend.textContent).toContain('12.5%')
    expect(container.textContent).toContain('较昨日')
  })

  it('跌用成功文字令牌,不使用调色板红', () => {
    const { container } = render(<StatCard title="转化率" value="3.2%" trend={-3.25} />)
    const trend = trendEl(container)
    expect(trend.getAttribute('data-stat-trend')).toBe('fall')
    expect(trend.className).toContain('text-success-text')
    expect(trend.className).not.toContain('text-danger-text')
    expect(trend.className).not.toMatch(/emerald|text-red-/)
    expect(trend.querySelector('.lucide-trending-down')).not.toBeNull()
    expect(trend.textContent).toContain('3.3%')
  })

  it('零涨跌仍走涨侧(原判定 >= 0),染红', () => {
    const { container } = render(<StatCard title="引流数" value="0" trend={0} />)
    const trend = trendEl(container)
    expect(trend.getAttribute('data-stat-trend')).toBe('rise')
    expect(trend.className).toContain('text-danger-text')
    expect(trend.querySelector('.lucide-trending-up')).not.toBeNull()
    expect(trend.textContent).toContain('0.0%')
  })

  it('主数值即使写成带符号的积分,也不套涨跌色', () => {
    const { container } = render(<StatCard title="积分" value="+120" trend={-4} />)
    const value = valueEl(container)
    expect(value.textContent).toBe('+120')
    expect(value.className).not.toMatch(/text-success|text-danger|emerald|text-red-/)
    const trend = trendEl(container)
    expect(trend.getAttribute('data-stat-trend')).toBe('fall')
    expect(trend.className).toContain('text-success-text')
  })

  it('涨跌色只上文字,描边不取墨档', () => {
    const { container } = render(<StatCard title="订单" value="8" trend={1.2} />)
    const root = container.firstElementChild
    if (!(root instanceof HTMLElement)) throw new Error('missing root')
    expect(root.className).toContain('border')
    expect(root.className).not.toMatch(/border-primary|border-foreground|border-brand|ring-primary/)
    expect(trendEl(container).className).not.toMatch(/border-/)
  })

  it('未给 trend 或加载中时不渲染涨跌', () => {
    const idle = render(<StatCard title="订单" value="8" />)
    expect(idle.container.querySelector('[data-stat-trend]')).toBeNull()
    idle.unmount()

    const loading = render(<StatCard title="订单" value="8" trend={9} loading />)
    expect(loading.container.querySelector('[data-stat-trend]')).toBeNull()
    expect(loading.container.querySelector('[data-stat-value] .animate-pulse')).not.toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
