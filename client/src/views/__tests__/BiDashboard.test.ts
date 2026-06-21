import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h } from 'vue'

// mock vue-i18n
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: { value: 'zh-CN' },
    te: () => true,
    tm: () => ({}),
  }),
}))

// mock http
vi.mock('@/utils/request', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

// mock useA11y，避免对 window.matchMedia 依赖
// 使用模块级共享对象，让测试可以直接断言 announce 调用
const sharedA11y = {
  announce: vi.fn(),
  isReducedMotion: { value: false },
  isHighContrast: { value: false },
  isForcedColors: { value: false },
  focusFirst: vi.fn(),
  focusLast: vi.fn(),
  getFocusable: vi.fn(() => []),
  trapFocus: vi.fn(),
}
vi.mock('@/composables/useA11y', () => ({
  useA11y: () => sharedA11y,
}))

import http from '@/utils/request'
import BiDashboard from '../BiDashboard.vue'

const mockMetrics = [
  { name: 'orders', label: '订单数', unit: '单', aggregator: 'sum' },
  { name: 'gmv_cents', label: '交易额', unit: '分', aggregator: 'sum' },
]

const mockDimensions = [
  { name: 'channel', label: '渠道', value_count: 5 },
  { name: 'category', label: '品类', value_count: 8 },
]

const mockReport = {
  columns: ['channel', 'value'],
  rows: [
    { channel: 'app', value: 100 },
    { channel: 'web', value: 50 },
  ],
  total: 2,
  metric: 'orders',
  metric_label: '订单数',
  unit: '单',
  dimensions: ['channel'],
  days: 7,
  limit: 50,
  generated_at: '2026-06-18T00:00:00Z',
}

const mockAnomalies = {
  anomalies: [
    {
      date: '2026-06-15',
      value: 200,
      expected: 80,
      z_score: 3.2,
      direction: 'up',
      severity: 'critical',
      contribution: 120,
      attribution: [
        { dimension: 'channel', label: '渠道', top_value: 'app', impact: 100, contribution: 100 },
      ],
    },
  ],
  metric: 'orders',
  days: 7,
  z_threshold: 2.0,
  count: 1,
}

const mountComponent = () => {
  return mount(BiDashboard, {
    global: {
      stubs: {
        DrilldownPanel: defineComponent({
          name: 'DrilldownPanelStub',
          props: ['data'],
          emits: ['close'],
          setup(props, { emit }) {
            return () =>
              h(
                'div',
                { class: 'drilldown-stub', 'data-value': props.data?.value },
                h('button', { onClick: () => emit('close') }, '关闭'),
              )
          },
        }),
      },
    },
  })
}

describe('BiDashboard.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(http.get as any).mockImplementation((url: string) => {
      if (url.includes('/metrics')) return Promise.resolve({ code: 0, data: mockMetrics })
      if (url.includes('/dimensions')) return Promise.resolve({ code: 0, data: mockDimensions })
      if (url.includes('/anomalies')) return Promise.resolve({ code: 0, data: mockAnomalies })
      return Promise.resolve({ code: 0, data: null })
    })
    ;(http.post as any).mockResolvedValue({ code: 0, data: mockReport })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('挂载时应自动加载指标、维度与默认报表', async () => {
    const wrapper = mountComponent()
    await flushPromises()
    expect(http.get).toHaveBeenCalledWith('/api/v1/bi/metrics')
    expect(http.get).toHaveBeenCalledWith('/api/v1/bi/dimensions')
    expect(http.post).toHaveBeenCalledWith('/api/v1/bi/report', expect.any(Object))
  })

  it('应渲染标题、配置区与双栏布局', async () => {
    const wrapper = mountComponent()
    await flushPromises()
    expect(wrapper.find('#bi-dashboard-title').text()).toBe('biDashboard.title')
    expect(wrapper.find('#bi-config-title').exists()).toBe(true)
    expect(wrapper.find('#bi-report-title').exists()).toBe(true)
    expect(wrapper.find('#bi-anomalies-title').exists()).toBe(true)
  })

  it('指标下拉应渲染所有指标选项', async () => {
    const wrapper = mountComponent()
    await flushPromises()
    const options = wrapper.findAll('#bi-metric option')
    expect(options.length).toBe(2)
    expect(options[0].text()).toContain('订单数')
  })

  it('维度选择应渲染为可多选标签', async () => {
    const wrapper = mountComponent()
    await flushPromises()
    const checks = wrapper.findAll('.bi-check')
    expect(checks.length).toBe(2)
    // 默认 channel 选中
    expect(checks[0].classes()).toContain('active')
  })

  it('点击"运行报表"应重新执行 runReport', async () => {
    const wrapper = mountComponent()
    await flushPromises()
    const before = (http.post as any).mock.calls.length
    await wrapper.findAll('.bi-btn')[0].trigger('click')
    await flushPromises()
    const after = (http.post as any).mock.calls.length
    expect(after).toBeGreaterThan(before)
  })

  it('点击"检测异常"应调用 fetchAnomalies', async () => {
    const wrapper = mountComponent()
    await flushPromises()
    await wrapper.findAll('.bi-btn')[1].trigger('click')
    await flushPromises()
    expect(http.get).toHaveBeenCalledWith('/api/v1/bi/anomalies', expect.any(Object))
    const items = wrapper.findAll('.bi-anomaly-item')
    expect(items.length).toBe(1)
    expect(items[0].text()).toContain('2026-06-15')
  })

  it('应渲染报表结果表格', async () => {
    const wrapper = mountComponent()
    await flushPromises()
    const rows = wrapper.findAll('.bi-table tbody .bi-tr')
    expect(rows.length).toBe(2)
    // 第一行可下钻（因为有 channel 维度）
    expect(rows[0].classes()).toContain('drillable')
    expect(rows[0].attributes('tabindex')).toBe('0')
    expect(rows[0].attributes('role')).toBe('button')
  })

  it('点击可下钻行应触发 drilldown 调用', async () => {
    const wrapper = mountComponent()
    await flushPromises()
    const before = (http.get as any).mock.calls.filter(
      (c: any[]) => c[0] === '/api/v1/bi/drilldown',
    ).length
    await wrapper.findAll('.bi-tr')[0].trigger('click')
    await flushPromises()
    const after = (http.get as any).mock.calls.filter(
      (c: any[]) => c[0] === '/api/v1/bi/drilldown',
    ).length
    expect(after).toBe(before + 1)
  })

  it('键盘 Enter 在可下钻行上应触发 drilldown', async () => {
    const wrapper = mountComponent()
    await flushPromises()
    const before = (http.get as any).mock.calls.filter(
      (c: any[]) => c[0] === '/api/v1/bi/drilldown',
    ).length
    await wrapper.findAll('.bi-tr')[0].trigger('keydown', { key: 'Enter' })
    await flushPromises()
    const after = (http.get as any).mock.calls.filter(
      (c: any[]) => c[0] === '/api/v1/bi/drilldown',
    ).length
    expect(after).toBe(before + 1)
  })

  it('异常归因应显示 Z 分数与归因标签', async () => {
    const wrapper = mountComponent()
    await flushPromises()
    await wrapper.findAll('.bi-btn')[1].trigger('click')
    await flushPromises()
    const text = wrapper.text()
    expect(text).toContain('3.20') // z_score
    expect(text).toContain('渠道')
  })

  it('应使用 ARIA 标记主区域与面板', async () => {
    const wrapper = mountComponent()
    await flushPromises()
    const main = wrapper.find('[role="main"]')
    expect(main.exists()).toBe(true)
    const report = wrapper.find('[aria-labelledby="bi-report-title"]')
    expect(report.exists()).toBe(true)
    expect(report.attributes('aria-busy')).toBe('false')
  })

  it('应使用 scoped 标签列出所有维度', async () => {
    const wrapper = mountComponent()
    await flushPromises()
    const labels = wrapper.findAll('.bi-check')
    expect(labels[0].text()).toContain('渠道')
    expect(labels[1].text()).toContain('品类')
  })

  // ============ 补充测试：提升覆盖率 ============

  it('报表行数据中大数值(>=10000)应使用整数格式化', async () => {
    // 大数走 toLocaleString maximumFractionDigits: 0 分支
    const bigReport = {
      ...mockReport,
      rows: [
        { channel: 'app', value: 12345 },
        { channel: 'web', value: 67890 },
      ],
    }
    ;(http.post as any).mockResolvedValue({ code: 0, data: bigReport })
    const wrapper = mountComponent()
    await flushPromises()
    const text = wrapper.text()
    // 千分位分隔符 + 不带小数
    expect(text).toContain('12,345')
    expect(text).toContain('67,890')
  })

  it('报表行数据中普通数值应保留两位小数', async () => {
    const smallReport = {
      ...mockReport,
      rows: [
        { channel: 'app', value: 12.3456 },
      ],
    }
    ;(http.post as any).mockResolvedValue({ code: 0, data: smallReport })
    const wrapper = mountComponent()
    await flushPromises()
    // maximumFractionDigits: 2
    expect(wrapper.text()).toContain('12.35')
  })

  it('formatValue 在非数字输入时应原样返回', async () => {
    // 构造一个非数字 value，触发 typeof v !== 'number' 分支
    const strReport = {
      ...mockReport,
      rows: [
        { channel: 'app', value: 'N/A' as any },
      ],
    }
    ;(http.post as any).mockResolvedValue({ code: 0, data: strReport })
    const wrapper = mountComponent()
    await flushPromises()
    // 非数字直接原样展示
    expect(wrapper.text()).toContain('N/A')
  })

  it('runReport 失败时应播报失败通知', async () => {
    // code !== 0 走 useBi runReport 失败分支，announce 触发 reportFail
    ;(http.post as any).mockResolvedValue({ code: 1, message: '执行失败' })
    const wrapper = mountComponent()
    await flushPromises()
    await wrapper.findAll('.bi-btn')[0].trigger('click')
    await flushPromises()
    // 业务失败应播报失败
    expect(sharedA11y.announce).toHaveBeenCalledWith(
      'biDashboard.reportFail',
      expect.objectContaining({ politeness: 'assertive' }),
    )
  })

  it('runReport 网络异常时应显示错误状态', async () => {
    ;(http.post as any).mockRejectedValue(new Error('网络挂了'))
    const wrapper = mountComponent()
    await flushPromises()
    // 异常分支写入 error.value
    const alert = wrapper.find('.bi-state.error')
    expect(alert.exists()).toBe(true)
    expect(alert.text()).toContain('网络挂了')
  })

  it('空数据报表应显示无数据提示', async () => {
    const emptyReport = { ...mockReport, rows: [], total: 0 }
    ;(http.post as any).mockResolvedValue({ code: 0, data: emptyReport })
    const wrapper = mountComponent()
    await flushPromises()
    // rows.length === 0 走 noData 分支
    const states = wrapper.findAll('.bi-state')
    const hasNoData = states.some((s) => s.text().includes('biDashboard.noData'))
    expect(hasNoData).toBe(true)
  })

  it('未触发异常检测时应显示"点击检测"提示', async () => {
    const wrapper = mountComponent()
    await flushPromises()
    // 初始 lastAnomalyCheck=false，显示 clickToDetect
    const states = wrapper.findAll('.bi-state')
    const hasClick = states.some((s) => s.text().includes('biDashboard.clickToDetect'))
    expect(hasClick).toBe(true)
  })

  it('检测后无异常时应显示"无异常"提示', async () => {
    const emptyAnomalies = { ...mockAnomalies, anomalies: [], count: 0 }
    ;(http.get as any).mockImplementation((url: string) => {
      if (url.includes('/anomalies')) return Promise.resolve({ code: 0, data: emptyAnomalies })
      if (url.includes('/metrics')) return Promise.resolve({ code: 0, data: mockMetrics })
      if (url.includes('/dimensions')) return Promise.resolve({ code: 0, data: mockDimensions })
      return Promise.resolve({ code: 0, data: null })
    })
    const wrapper = mountComponent()
    await flushPromises()
    await wrapper.findAll('.bi-btn')[1].trigger('click')
    await flushPromises()
    // lastAnomalyCheck=true 且 anomalies.length=0 走 noAnomaly 分支
    const states = wrapper.findAll('.bi-state')
    const hasNo = states.some((s) => s.text().includes('biDashboard.noAnomaly'))
    expect(hasNo).toBe(true)
  })

  it('检测异常失败时应播报失败通知', async () => {
    ;(http.get as any).mockImplementation((url: string) => {
      if (url.includes('/anomalies')) return Promise.resolve({ code: 1, message: '检测失败' })
      if (url.includes('/metrics')) return Promise.resolve({ code: 0, data: mockMetrics })
      if (url.includes('/dimensions')) return Promise.resolve({ code: 0, data: mockDimensions })
      return Promise.resolve({ code: 0, data: null })
    })
    const wrapper = mountComponent()
    await flushPromises()
    await wrapper.findAll('.bi-btn')[1].trigger('click')
    await flushPromises()
    expect(sharedA11y.announce).toHaveBeenCalledWith(
      'biDashboard.detectFail',
      expect.objectContaining({ politeness: 'assertive' }),
    )
  })

  it('检测成功时应播报成功通知并显示摘要', async () => {
    const wrapper = mountComponent()
    await flushPromises()
    await wrapper.findAll('.bi-btn')[1].trigger('click')
    await flushPromises()
    // 顶部摘要 + 成功通知
    const summary = wrapper.find('.bi-summary')
    expect(summary.exists()).toBe(true)
    expect(summary.text()).toContain('1')
    expect(sharedA11y.announce).toHaveBeenCalledWith(
      'biDashboard.detectSuccess',
      expect.objectContaining({ politeness: 'polite' }),
    )
  })

  it('异常 direction 为 down 时应渲染向下箭头', async () => {
    const downAnomalies = {
      ...mockAnomalies,
      anomalies: [
        {
          ...mockAnomalies.anomalies[0],
          direction: 'down' as const,
          severity: 'warning' as const,
        },
      ],
    }
    ;(http.get as any).mockImplementation((url: string) => {
      if (url.includes('/anomalies')) return Promise.resolve({ code: 0, data: downAnomalies })
      if (url.includes('/metrics')) return Promise.resolve({ code: 0, data: mockMetrics })
      if (url.includes('/dimensions')) return Promise.resolve({ code: 0, data: mockDimensions })
      return Promise.resolve({ code: 0, data: null })
    })
    const wrapper = mountComponent()
    await flushPromises()
    await wrapper.findAll('.bi-btn')[1].trigger('click')
    await flushPromises()
    const item = wrapper.find('.bi-anomaly-item')
    expect(item.classes()).toContain('sev-warning')
    const badge = wrapper.find('.bi-anomaly-badge')
    expect(badge.classes()).toContain('down')
    expect(badge.text()).toContain('↓')
  })

  it('无归因数据时不应渲染归因区块', async () => {
    const noAttrAnomalies = {
      ...mockAnomalies,
      anomalies: [{ ...mockAnomalies.anomalies[0], attribution: [] }],
    }
    ;(http.get as any).mockImplementation((url: string) => {
      if (url.includes('/anomalies')) return Promise.resolve({ code: 0, data: noAttrAnomalies })
      if (url.includes('/metrics')) return Promise.resolve({ code: 0, data: mockMetrics })
      if (url.includes('/dimensions')) return Promise.resolve({ code: 0, data: mockDimensions })
      return Promise.resolve({ code: 0, data: null })
    })
    const wrapper = mountComponent()
    await flushPromises()
    await wrapper.findAll('.bi-btn')[1].trigger('click')
    await flushPromises()
    // a.attribution.length === 0 时不渲染
    expect(wrapper.find('.bi-anomaly-attr').exists()).toBe(false)
  })

  it('下钻成功时应显示 DrilldownPanel 并播报通知', async () => {
    const drilldownData = {
      metric: 'orders',
      metric_label: '订单数',
      unit: '单',
      dimension: 'channel',
      value: 'app',
      days: 7,
      series: [{ date: '2026-06-12', value: 10 }],
      sub_dimensions: [],
      total: 10,
      generated_at: '2026-06-18T00:00:00Z',
    }
    ;(http.get as any).mockImplementation((url: string) => {
      if (url.includes('/drilldown')) return Promise.resolve({ code: 0, data: drilldownData })
      if (url.includes('/metrics')) return Promise.resolve({ code: 0, data: mockMetrics })
      if (url.includes('/dimensions')) return Promise.resolve({ code: 0, data: mockDimensions })
      return Promise.resolve({ code: 0, data: null })
    })
    const wrapper = mountComponent()
    await flushPromises()
    await wrapper.findAll('.bi-tr')[0].trigger('click')
    await flushPromises()
    // DrilldownPanel 出现
    expect(wrapper.find('.drilldown-stub').exists()).toBe(true)
    // 成功播报
    expect(sharedA11y.announce).toHaveBeenCalledWith(
      'biDashboard.drilldownSuccess',
      expect.objectContaining({ politeness: 'polite' }),
    )
  })

  it('下钻面板的关闭按钮应隐藏 DrilldownPanel', async () => {
    const drilldownData = {
      metric: 'orders',
      metric_label: '订单数',
      unit: '单',
      dimension: 'channel',
      value: 'app',
      days: 7,
      series: [],
      sub_dimensions: [],
      total: 0,
      generated_at: '2026-06-18T00:00:00Z',
    }
    ;(http.get as any).mockImplementation((url: string) => {
      if (url.includes('/drilldown')) return Promise.resolve({ code: 0, data: drilldownData })
      if (url.includes('/metrics')) return Promise.resolve({ code: 0, data: mockMetrics })
      if (url.includes('/dimensions')) return Promise.resolve({ code: 0, data: mockDimensions })
      return Promise.resolve({ code: 0, data: null })
    })
    const wrapper = mountComponent()
    await flushPromises()
    await wrapper.findAll('.bi-tr')[0].trigger('click')
    await flushPromises()
    // 点击 stub 内的关闭按钮
    await wrapper.find('.drilldown-stub button').trigger('click')
    await flushPromises()
    expect(wrapper.find('.drilldown-stub').exists()).toBe(false)
  })

  it('键盘 Space 在可下钻行上应触发 drilldown', async () => {
    const wrapper = mountComponent()
    await flushPromises()
    const before = (http.get as any).mock.calls.filter(
      (c: any[]) => c[0] === '/api/v1/bi/drilldown',
    ).length
    await wrapper.findAll('.bi-tr')[0].trigger('keydown', { key: ' ' })
    await flushPromises()
    const after = (http.get as any).mock.calls.filter(
      (c: any[]) => c[0] === '/api/v1/bi/drilldown',
    ).length
    expect(after).toBe(before + 1)
  })

  it('点击同一表头列应切换排序方向', async () => {
    const wrapper = mountComponent()
    await flushPromises()
    const before = (http.post as any).mock.calls.length
    // 默认 sortKey='value'，再次点击 value 列（索引 1）切到 asc
    const valueBtn = wrapper.findAll('.bi-th-btn')[1]
    await valueBtn.trigger('click')
    await flushPromises()
    const after = (http.post as any).mock.calls.length
    expect(after).toBeGreaterThan(before)
    // asc 时显示 ↑ 箭头
    expect(valueBtn.text()).toContain('↑')
  })

  it('点击不同表头列应切换排序列并重置为降序', async () => {
    const wrapper = mountComponent()
    await flushPromises()
    // 列顺序：channel(0) / value(1)，点击 channel 列
    const channelBtn = wrapper.findAll('.bi-th-btn')[0]
    await channelBtn.trigger('click')
    await flushPromises()
    // 切换到新列，重置为 desc
    expect(channelBtn.text()).toContain('↓')
  })

  it('改变指标下拉应重置排序为 value/desc', async () => {
    const wrapper = mountComponent()
    await flushPromises()
    // 先点击 value 列把排序切到 asc
    const valueBtn = wrapper.findAll('.bi-th-btn')[1]
    await valueBtn.trigger('click')
    await flushPromises()
    expect(valueBtn.text()).toContain('↑')
    // 修改指标触发 onConfigChange
    await wrapper.find('#bi-metric').setValue('gmv_cents')
    await flushPromises()
    // 排序被重置为 value/desc
    expect(valueBtn.text()).toContain('↓')
  })

  it('改变维度复选框应重置排序为 value/desc', async () => {
    const wrapper = mountComponent()
    await flushPromises()
    // 切换排序
    const valueBtn = wrapper.findAll('.bi-th-btn')[1]
    await valueBtn.trigger('click')
    await flushPromises()
    // 勾选第二个维度
    const checks = wrapper.findAll('.bi-check input')
    await checks[1].setValue(true)
    await flushPromises()
    // 重置后 value 列 desc
    expect(valueBtn.text()).toContain('↓')
  })

  it('aria-sort 在非排序列上应为 none', async () => {
    const wrapper = mountComponent()
    await flushPromises()
    // 默认排序列是 value
    const ths = wrapper.findAll('.bi-table thead th')
    // 非排序列（channel）应 aria-sort="none"
    expect(ths[0].attributes('aria-sort')).toBe('none')
  })

  it('行不包含选中维度字段时不应可下钻', async () => {
    // rows 中没有 channel 字段
    const noDimReport = {
      ...mockReport,
      columns: ['date', 'value'],
      rows: [{ date: '2026-06-12', value: 100 }],
    }
    ;(http.post as any).mockResolvedValue({ code: 0, data: noDimReport })
    const wrapper = mountComponent()
    await flushPromises()
    const row = wrapper.findAll('.bi-tr')[0]
    expect(row.classes()).not.toContain('drillable')
    expect(row.attributes('tabindex')).toBe('-1')
  })

  it('行点击但无有效维度值时不应触发 drilldown 请求', async () => {
    // channel 字段为 undefined，触发 !value 提前 return 分支
    const emptyValueReport = {
      ...mockReport,
      rows: [
        { channel: '', value: 100 },
        { channel: 'web', value: 50 },
      ],
    }
    ;(http.post as any).mockResolvedValue({ code: 0, data: emptyValueReport })
    const wrapper = mountComponent()
    await flushPromises()
    const before = (http.get as any).mock.calls.filter(
      (c: any[]) => c[0] === '/api/v1/bi/drilldown',
    ).length
    // 第一行 channel 为空字符串
    await wrapper.findAll('.bi-tr')[0].trigger('click')
    await flushPromises()
    const after = (http.get as any).mock.calls.filter(
      (c: any[]) => c[0] === '/api/v1/bi/drilldown',
    ).length
    expect(after).toBe(before)
  })

  it('下钻失败时不应播报成功通知', async () => {
    ;(http.get as any).mockImplementation((url: string) => {
      if (url.includes('/drilldown')) return Promise.resolve({ code: 1, message: '下钻失败' })
      if (url.includes('/metrics')) return Promise.resolve({ code: 0, data: mockMetrics })
      if (url.includes('/dimensions')) return Promise.resolve({ code: 0, data: mockDimensions })
      return Promise.resolve({ code: 0, data: null })
    })
    const wrapper = mountComponent()
    await flushPromises()
    const beforeCalls = (sharedA11y.announce as any).mock.calls.length
    await wrapper.findAll('.bi-tr')[0].trigger('click')
    await flushPromises()
    // 失败时不应播报 drilldownSuccess
    const calls = (sharedA11y.announce as any).mock.calls.slice(beforeCalls)
    const successCall = calls.find((c: any[]) => c[0] === 'biDashboard.drilldownSuccess')
    expect(successCall).toBeUndefined()
  })

  it('运行报表按钮在 loading 时应显示执行中文案并禁用', async () => {
    const wrapper = mountComponent()
    await flushPromises()
    // mock 一次慢响应，loading 期间按钮文案切换
    let resolveFn: (v: any) => void
    ;(http.post as any).mockImplementation(
      () => new Promise((resolve) => { resolveFn = resolve }),
    )
    const runBtn = wrapper.findAll('.bi-btn')[0]
    const clickPromise = runBtn.trigger('click')
    await flushPromises()
    // loading 态：按钮 disabled、aria-disabled=true
    expect(runBtn.attributes('disabled')).toBeDefined()
    expect(runBtn.attributes('aria-disabled')).toBe('true')
    expect(runBtn.text()).toContain('biDashboard.executing')
    // 解除 promise
    resolveFn!({ code: 0, data: mockReport })
    await clickPromise
    await flushPromises()
  })
})
