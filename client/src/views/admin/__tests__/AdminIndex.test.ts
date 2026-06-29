// admin/index.vue smoke test
// 验证:@/api/admin-dashboard 的返回值正确流入 4 个数据区(KPI / 模块 / 监控 / 时间线)
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}|${JSON.stringify(params)}` : key,
    locale: { value: 'zh-CN' },
  }),
}))

const pushMock = vi.fn().mockResolvedValue(undefined)
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushMock, currentRoute: { value: { path: '/admin' } } }),
  useRoute: () => ({ path: '/admin' }),
}))

vi.mock('element-plus', () => ({
  ElMessage: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))

const mockGetDashboardAll = vi.fn()
vi.mock('@/api/admin-dashboard', () => ({
  getDashboardAll: () => mockGetDashboardAll(),
}))

vi.mock('@/utils/markRaw', () => ({
  // markRaw 防止 Vue 把 icon 做成响应式对象,测试里直接返回原对象即可
  markIcon: (icon: unknown) => icon,
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ user: { nickname: '张三', username: 'zhangsan' } }),
}))

vi.mock('@element-plus/icons-vue', () => {
  // 每个 icon 都返回有 name 的对象,这样 <component :is="icon" /> 能匹配到 stub
  const make = (name: string) => ({ name, render: () => null })
  return {
    ArrowRight: make('ArrowRight'),
    Refresh: make('Refresh'),
    Setting: make('Setting'),
    User: make('User'),
    ShoppingCart: make('ShoppingCart'),
    ChatLineRound: make('ChatLineRound'),
    Money: make('Money'),
    DataAnalysis: make('DataAnalysis'),
    Promotion: make('Promotion'),
    Document: make('Document'),
    Tools: make('Tools'),
    Bell: make('Bell'),
    Box: make('Box'),
    Connection: make('Connection'),
  }
})

// element-plus 组件全局 stub
// 注意:不要在 template 内 @click="$emit('click')",否则 Vue 3 fallthrough 机制会把
// @click 同时作为 native listener 加到根 button 上,导致 refresh 等回调被触发 2 次
const ElButtonStub = {
  name: 'ElButton',
  template: '<button class="el-button" :data-icon="iconName"><slot /></button>',
  props: ['icon', 'type', 'loading', 'round'],
  computed: {
    iconName() {
      // icon 是 { name: 'Refresh', ... } 之类的对象,取 name 作 data 属性
      if (!this.icon) return ''
      if (typeof this.icon === 'string') return this.icon
      return this.icon.name || ''
    },
  },
}
const ElRadioGroupStub = {
  name: 'ElRadioGroup',
  props: ['modelValue'],
  emits: ['update:modelValue'],
  template: '<div class="el-radio-group" @click="$emit(\'update:modelValue\', \'order\')"><slot /></div>',
}
const ElRadioButtonStub = {
  name: 'ElRadioButton',
  props: ['label'],
  template: '<div class="el-radio-button" :data-label="label" @click="$emit(\'click\')"><slot /></div>',
}
const ElCheckboxStub = {
  name: 'ElCheckbox',
  props: ['modelValue'],
  emits: ['update:modelValue'],
  template: '<input type="checkbox" class="el-checkbox" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)" />',
}
const ElIconStub = {
  name: 'ElIcon',
  template: '<span class="el-icon"><slot /></span>',
}

// KpiCard 是子组件,简单 stub 即可,避免 element-plus 全量依赖
vi.mock('../components/KpiCard.vue', () => ({
  default: {
    name: 'KpiCard',
    props: ['label', 'value', 'unit', 'trend', 'icon', 'tone', 'description'],
    template: '<div class="kpi-card-stub" :data-key="label" :data-value="value" :data-trend="trend" />',
  },
}))

import AdminIndex from '../index.vue'

function mountAdmin() {
  return mount(AdminIndex, {
    global: {
      stubs: {
        ElButton: ElButtonStub,
        ElRadioGroup: ElRadioGroupStub,
        ElRadioButton: ElRadioButtonStub,
        ElCheckbox: ElCheckboxStub,
        ElIcon: ElIconStub,
      },
    },
  })
}

function makeApiResult() {
  return {
    overview: {
      data: {
        totalUsers: 12486,
        usersTrend: 8.2,
        todayOrders: 328,
        ordersTrend: 12.5,
        todayRevenue: 18260,
        revenueTrend: -2.3,
        todayConversations: 9142,
        conversationsTrend: 23.6,
      },
      ok: true,
      errors: [],
    },
    monitor: {
      data: {
        items: [
          { key: 'qps', name: 'API QPS', percent: 18, detail: 'current 1.2k' },
          { key: 'error', name: '错误率', percent: 2, detail: '0.02%' },
          { key: 'cpu', name: 'CPU', percent: 32, detail: '8 cores' },
        ],
        source: 'api' as const,
      },
      ok: true,
      errors: [],
    },
    timeline: {
      data: {
        list: [
          { id: 1, type: 'user' as const, title: '新用户注册', description: 'zhang***', time: '2 分钟前', tone: 'primary' as const },
          { id: 2, type: 'order' as const, title: '订单支付', description: 'ORD-001', time: '5 分钟前', tone: 'success' as const },
          { id: 3, type: 'system' as const, title: '系统告警', description: 'cache hit low', time: '10 分钟前', tone: 'warning' as const },
        ],
        total: 3,
        source: 'api' as const,
      },
      ok: true,
      errors: [],
    },
    modules: {
      data: {
        byKey: {
          orders: { key: 'orders', count: 328, ok: true },
          products: { key: 'products', count: 156, ok: true },
          users: { key: 'users', count: 12486, ok: true },
          agents: { key: 'agents', count: 5, ok: true },
          distribution: { key: 'distribution', count: 0, ok: false },
          promotion: { key: 'promotion', count: 3, ok: true },
          content: { key: 'content', count: 1248, ok: true },
          feedback: { key: 'feedback', count: 12, ok: true },
          analytics: { key: 'analytics', count: 328, ok: true },
          webhook: { key: 'webhook', count: 0, ok: false },
          tool: { key: 'tool', count: 12, ok: true },
          settings: { key: 'settings', count: 1, ok: true },
        },
        ok: true,
        errors: [],
      },
      ok: true,
      errors: [],
    },
  }
}

describe('views/admin/index.vue', () => {
  beforeEach(() => {
    pushMock.mockClear()
    mockGetDashboardAll.mockReset()
    mockGetDashboardAll.mockResolvedValue(makeApiResult())
  })

  it('onMounted 触发 getDashboardAll 一次', async () => {
    mountAdmin()
    await flushPromises()
    expect(mockGetDashboardAll).toHaveBeenCalledTimes(1)
  })

  it('KPI 数据来自 overview', async () => {
    const wrapper = mountAdmin()
    await flushPromises()
    const kpis = wrapper.findAll('.kpi-card-stub')
    expect(kpis.length).toBe(4)
    // 检查第一个 KPI 是用户数,值是格式化后的 '1.2w'(12486 >= 10000)
    expect(kpis[0].attributes('data-value')).toBe('1.2w')
    expect(kpis[1].attributes('data-value')).toBe('328')
  })

  it('模块网格渲染 12 个,且 ok=false 的显示占位', async () => {
    const wrapper = mountAdmin()
    await flushPromises()
    const items = wrapper.findAll('.module-item')
    expect(items.length).toBe(12)
    // i18n mock 直接返回 key,所以模块 name 是 'moduleNameDistribution'
    const dist = items.find(i => i.text().includes('moduleNameDistribution'))
    expect(dist).toBeDefined()
    // mock 里 distribution.ok=false,stat 应为 moduleStatEmpty ('—' 来自 t() 的 raw key 因为 t() 收到 "—" 当 key)
    expect(dist!.text()).toContain('moduleStatEmpty')
  })

  it('监控列表来自 monitor.items', async () => {
    const wrapper = mountAdmin()
    await flushPromises()
    const rows = wrapper.findAll('.monitor-row')
    expect(rows.length).toBe(3)
    expect(rows[0].text()).toContain('API QPS')
    expect(rows[0].text()).toContain('18%')
  })

  it('活动时间线来自 timeline.list', async () => {
    const wrapper = mountAdmin()
    await flushPromises()
    const items = wrapper.findAll('.timeline-item')
    expect(items.length).toBe(3)
    expect(items[0].text()).toContain('新用户注册')
  })

  it('时间线 tab 过滤:只显示订单', async () => {
    const wrapper = mountAdmin()
    await flushPromises()
    // 找到 label=order 的 radio-button 并点击
    const orderBtn = wrapper.findAll('.el-radio-button').find(b => b.attributes('data-label') === 'order')
    expect(orderBtn).toBeDefined()
    await orderBtn!.trigger('click')
    await flushPromises()
    const items = wrapper.findAll('.timeline-item')
    expect(items.length).toBe(1)
    expect(items[0].text()).toContain('订单支付')
  })

  it('refresh 按钮触发再次加载', async () => {
    const wrapper = mountAdmin()
    await flushPromises()
    mockGetDashboardAll.mockClear()
    // ElButtonStub 是 .el-button,带 data-icon 属性
    const refreshBtn = wrapper.findAll('.el-button').find(b => b.attributes('data-icon') === 'Refresh')
    expect(refreshBtn).toBeDefined()
    await refreshBtn!.trigger('click')
    await flushPromises()
    expect(mockGetDashboardAll).toHaveBeenCalledTimes(1)
  })

  it('模块点击触发 router.push', async () => {
    const wrapper = mountAdmin()
    await flushPromises()
    const firstModule = wrapper.findAll('.module-item')[0]
    await firstModule.trigger('click')
    expect(pushMock).toHaveBeenCalledWith('/admin/orders')
  })
})
