// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import {
  CHART_TEMPLATES,
  isChartTemplateId,
  chartTemplateMeta,
  parseChartTemplatePayload,
  parseChartTemplateJson,
} from '@ihui/design-tokens'

/**
 * D46 受控图表模板守门测试(2026-09-23 立):
 * - 白名单恰 8 种且与台账 D46 列举一一对应,scenes 全部合法;
 * - parseChartTemplatePayload 严格守卫:白名单外/缺 data/空 data/任一行缺必填字段 → null;
 * - parseChartTemplateJson 对非 JSON / 非 object 一律 null 不抛。
 */
describe('D46 chart-templates 注册表', () => {
  it('白名单恰 8 种且 id 唯一', () => {
    expect(CHART_TEMPLATES).toHaveLength(8)
    const ids = CHART_TEMPLATES.map((t) => t.id)
    expect(new Set(ids).size).toBe(8)
    expect(ids).toEqual(
      expect.arrayContaining([
        'gantt',
        'sankey',
        'radar',
        'heatmap',
        'funnel',
        'timeseries',
        'treeflow',
        'comparison',
      ]),
    )
  })

  it('每个模板 label 非空且 scenes 合法非空', () => {
    const legalScenes = new Set(['planning', 'flow', 'distribution', 'hierarchy', 'comparison', 'trend'])
    for (const t of CHART_TEMPLATES) {
      expect(t.label.length).toBeGreaterThan(0)
      expect(t.scenes.length).toBeGreaterThan(0)
      for (const s of t.scenes) expect(legalScenes.has(s)).toBe(true)
      expect(t.requiredFields.length).toBeGreaterThan(0)
    }
  })

  it('chartTemplateMeta 认不出返回 null(不静默兜底)', () => {
    expect(chartTemplateMeta('gantt')).not.toBeNull()
    expect(chartTemplateMeta('yolo')).toBeNull()
  })

  it('isChartTemplateId 守卫', () => {
    expect(isChartTemplateId('funnel')).toBe(true)
    expect(isChartTemplateId('Funnel')).toBe(false)
    expect(isChartTemplateId(42)).toBe(false)
  })
})

describe('D46 parseChartTemplatePayload 严格守卫', () => {
  const funnel = {
    template: 'funnel',
    data: [
      { label: '访问', value: 1000 },
      { label: '下单', value: 300 },
    ],
  }

  it('合法载荷解析通过(title 可选)', () => {
    expect(parseChartTemplatePayload(funnel)).not.toBeNull()
    const withTitle = parseChartTemplatePayload({ ...funnel, title: '转化漏斗' })
    expect(withTitle?.title).toBe('转化漏斗')
  })

  it('template 白名单外 → null', () => {
    expect(parseChartTemplatePayload({ template: 'yolo', data: [{ label: 'x', value: 1 }] })).toBeNull()
  })

  it('data 缺失/空数组/非数组 → null', () => {
    expect(parseChartTemplatePayload({ template: 'funnel' })).toBeNull()
    expect(parseChartTemplatePayload({ template: 'funnel', data: [] })).toBeNull()
    expect(parseChartTemplatePayload({ template: 'funnel', data: 'nope' })).toBeNull()
  })

  it('任一行缺必填字段 → 整体拒绝(半真半假比全错更危险)', () => {
    expect(
      parseChartTemplatePayload({
        template: 'funnel',
        data: [
          { label: 'a', value: 1 },
          { label: 'b' },
        ],
      }),
    ).toBeNull()
  })

  it('行非对象/输入非对象/数组 → null', () => {
    expect(parseChartTemplatePayload({ template: 'funnel', data: ['x'] })).toBeNull()
    expect(parseChartTemplatePayload('funnel')).toBeNull()
    expect(parseChartTemplatePayload(null)).toBeNull()
    expect(parseChartTemplatePayload([funnel])).toBeNull()
  })

  it('parseChartTemplateJson:JSON 字符串入口,坏 JSON 不抛', () => {
    expect(parseChartTemplateJson(JSON.stringify(funnel))?.template).toBe('funnel')
    expect(parseChartTemplateJson('{broken json')).toBeNull()
    expect(parseChartTemplateJson('<html>自由 HTML 仍走 iframe</html>')).toBeNull()
    expect(parseChartTemplateJson('')).toBeNull()
  })
})
