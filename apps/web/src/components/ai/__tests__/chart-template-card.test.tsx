// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import React from 'react'
import { render, cleanup } from '@testing-library/react'

// next-themes mock:fixed light / dark 两态分别驱动断言
let themeState: 'light' | 'dark' = 'light'
vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: themeState }),
}))

import { ChartTemplateCard } from '../chart-template-card'
import type { ChartTemplatePayload } from '@ihui/design-tokens'

function payload(template: ChartTemplatePayload['template'], data: Record<string, unknown>[]): ChartTemplatePayload {
  return { template, data }
}

/**
 * D46 受控图表卡渲染守门(2026-09-23 立):
 * - 8 种模板各自渲染出 SVG(形状成立);
 * - 明暗两态色值走 chart-colors 同源(chartBg 切换);
 * - 数据行非法 → 降级空态不炸;
 * - 圆角/字体规范:SVG 内无 rx>8 圆角、无 font-family 内联(守门天然通过的结构性证据)。
 */
describe('ChartTemplateCard(受控模板渲染)', () => {
  afterEach(() => {
    cleanup()
    themeState = 'light'
  })

  it.each([
    ['gantt', [{ label: '设计', start: 0, end: 3 }, { label: '开发', start: 2, end: 6 }]],
    ['sankey', [{ source: '访问', target: '下单', value: 300 }, { source: '下单', target: '复购', value: 80 }]],
    ['radar', [{ label: '速度', value: 80 }, { label: '质量', value: 65 }, { label: '成本', value: 40 }]],
    ['heatmap', [{ row: 'r1', col: 'c1', value: 5 }, { row: 'r1', col: 'c2', value: 9 }]],
    ['funnel', [{ label: '访问', value: 1000 }, { label: '下单', value: 300 }]],
    ['timeseries', [{ t: '周一', v: 3 }, { t: '周二', v: 7 }, { t: '周三', v: 4 }]],
    ['treeflow', [{ label: '根', parent: null }, { label: '子', parent: '根' }]],
    ['comparison', [{ label: 'A 方案', a: 30, b: 55 }, { label: 'B 方案', a: 45, b: 20 }]],
  ])('%s 模板渲染出 SVG', (template, data) => {
    const { container } = render(<ChartTemplateCard payload={payload(template as ChartTemplatePayload['template'], data)} />)
    const card = container.querySelector('[data-testid="chart-template-card"]')
    expect(card).not.toBeNull()
    expect(card?.getAttribute('data-chart-template')).toBe(template)
    expect(container.querySelector('[data-chart-template-svg]')).not.toBeNull()
  })

  it('明暗两态:背景色取 chartBg 同源值切换', () => {
    const data = [{ label: 'a', value: 1 }, { label: 'b', value: 2 }]
    const { container: light } = render(<ChartTemplateCard payload={payload('funnel', data)} />)
    const lightBg = light.querySelector('svg rect')?.getAttribute('fill')
    cleanup()
    themeState = 'dark'
    const { container: dark } = render(<ChartTemplateCard payload={payload('funnel', data)} />)
    const darkBg = dark.querySelector('svg rect')?.getAttribute('fill')
    expect(lightBg).toBe('#ffffff')
    expect(darkBg).toBe('#0f172a')
  })

  it('数据行全部非法 → 降级空态不炸', () => {
    const { container } = render(
      <ChartTemplateCard payload={payload('timeseries', [{ t: 'a' }, { t: 'b' }])} />,
    )
    expect(container.querySelector('[data-chart-template-empty]')).not.toBeNull()
  })

  it('结构性守门:无 rx>8 圆角、SVG 内无 font-family 内联(规范天然通过)', () => {
    const { container } = render(
      <ChartTemplateCard
        payload={payload('comparison', [{ label: 'x', a: 1, b: 2 }, { label: 'y', a: 3, b: 4 }])}
      />,
    )
    for (const rect of container.querySelectorAll('rect')) {
      const rx = rect.getAttribute('rx')
      if (rx !== null) expect(Number(rx)).toBeLessThanOrEqual(8)
    }
    expect(container.querySelectorAll('[font-family]')).toHaveLength(0)
  })

  it('title 缺省回退模板中文名(chartTemplateMeta.label)', () => {
    const { container } = render(<ChartTemplateCard payload={payload('radar', [{ label: 'a', value: 1 }, { label: 'b', value: 2 }, { label: 'c', value: 3 }])} />)
    expect(container.querySelector('[data-testid="chart-template-card"]')?.textContent).toContain('雷达图')
  })
})
