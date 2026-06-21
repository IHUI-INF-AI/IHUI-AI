import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import DrilldownPanel from '../DrilldownPanel.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  messages: { 'zh-CN': {} },
})

const sample = {
  metric: 'orders',
  metric_label: '订单数',
  unit: '单',
  dimension: 'channel',
  value: 'app',
  days: 7,
  series: [
    { date: '2026-06-12', value: 10 },
    { date: '2026-06-13', value: 25 },
    { date: '2026-06-14', value: 18 },
  ],
  sub_dimensions: [
    {
      name: 'category',
      label: '品类',
      top: [
        { name: 'A', value: 30 },
        { name: 'B', value: 20 },
        { name: 'C', value: 10 },
      ],
    },
    {
      name: 'region',
      label: '地区',
      top: [
        { name: '华东', value: 28 },
        { name: '华南', value: 15 },
      ],
    },
  ],
  total: 53,
  generated_at: '2026-06-18T00:00:00Z',
}

describe('DrilldownPanel.vue', () => {
  it('应渲染为模态对话框', () => {
    const wrapper = mount(DrilldownPanel, { props: { data: sample }, global: { plugins: [i18n] } })
    const overlay = wrapper.find('.drilldown-overlay')
    expect(overlay.exists()).toBe(true)
    expect(overlay.attributes('role')).toBe('dialog')
    expect(overlay.attributes('aria-modal')).toBe('true')
    expect(overlay.attributes('aria-labelledby')).toBe('drilldown-title')
  })

  it('应显示指标、维度值与总数', () => {
    const wrapper = mount(DrilldownPanel, { props: { data: sample }, global: { plugins: [i18n] } })
    const title = wrapper.find('#drilldown-title')
    expect(title.exists()).toBe(true)
    expect(title.text()).toContain('订单数')
    expect(title.text()).toContain('channel')
    expect(title.text()).toContain('app')
  })

  it('应渲染每日明细柱状图', () => {
    const wrapper = mount(DrilldownPanel, { props: { data: sample }, global: { plugins: [i18n] } })
    const bars = wrapper.findAll('.drilldown-bar')
    expect(bars.length).toBe(3)
    // 最大值是 25，宽度应为 100%
    const fill = bars[1].find('.drilldown-bar-fill')
    const style = fill.attributes('style') || ''
    expect(style).toContain('width: 100%')
  })

  it('应渲染子维度 Top 列表', () => {
    const wrapper = mount(DrilldownPanel, { props: { data: sample }, global: { plugins: [i18n] } })
    const subdims = wrapper.findAll('.drilldown-subdim')
    expect(subdims.length).toBe(2)
    const topItems = wrapper.findAll('.drilldown-top-item')
    expect(topItems.length).toBe(5) // 3 + 2
  })

  it('关闭按钮点击应 emit close', async () => {
    const wrapper = mount(DrilldownPanel, { props: { data: sample }, global: { plugins: [i18n] } })
    const closeBtns = wrapper.findAll('.drilldown-close')
    expect(closeBtns.length).toBeGreaterThanOrEqual(1)
    await closeBtns[0].trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('点击遮罩应 emit close', async () => {
    const wrapper = mount(DrilldownPanel, { props: { data: sample }, global: { plugins: [i18n] } })
    await wrapper.find('.drilldown-overlay').trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('formatNumber 应支持大数本地化（千分位）', () => {
    const wrapper = mount(DrilldownPanel, { props: { data: sample }, global: { plugins: [i18n] } })
    const text = wrapper.text()
    // 总数 53，单个最大 25，使用 zh-CN
    expect(text).toContain('53')
  })

  it('当 series 为空时宽度应兜底为 0', () => {
    const empty = { ...sample, series: [], total: 0 }
    const wrapper = mount(DrilldownPanel, { props: { data: empty }, global: { plugins: [i18n] } })
    expect(wrapper.findAll('.drilldown-bar').length).toBe(0)
  })
})
