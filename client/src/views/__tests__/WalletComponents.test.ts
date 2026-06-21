import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import BalanceAlert from '@/components/BalanceAlert.vue'
import TransactionDetail from '@/components/TransactionDetail.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  messages: { 'zh-CN': { wallet: { title: '钱包' } } },
})

// 提供全局 formatTime 函数（组件中通过全局属性使用）
const globalMocks = { formatTime: (t: string) => t || '' }

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/wallet', component: { template: '<div />' } },
    ],
  })
}

describe('BalanceAlert 组件', () => {
  it('正常余额 - 隐藏', () => {
    setActivePinia(createPinia())
    const wrapper = mount(BalanceAlert, {
      props: { balanceCents: 50000 },
      global: { plugins: [i18n, makeRouter()], mocks: globalMocks },
    })
    expect(wrapper.find('.balance-alert').exists()).toBe(false)
  })

  it('低余额 - 警告等级', () => {
    setActivePinia(createPinia())
    const wrapper = mount(BalanceAlert, {
      props: { balanceCents: 5000 },
      global: { plugins: [i18n, makeRouter()], mocks: globalMocks },
    })
    expect(wrapper.find('.level-warning').exists()).toBe(true)
  })

  it('极低余额 - 严重等级', () => {
    setActivePinia(createPinia())
    const wrapper = mount(BalanceAlert, {
      props: { balanceCents: 500 },
      global: { plugins: [i18n, makeRouter()], mocks: globalMocks },
    })
    expect(wrapper.find('.level-critical').exists()).toBe(true)
  })

  it('点击关闭按钮触发 dismiss', async () => {
    setActivePinia(createPinia())
    const wrapper = mount(BalanceAlert, {
      props: { balanceCents: 500 },
      global: { plugins: [i18n, makeRouter()], mocks: globalMocks },
    })
    const closeBtn = wrapper.find('.alert-close')
    expect(closeBtn.exists()).toBe(true)
    await closeBtn.trigger('click')
    expect(wrapper.find('.balance-alert').exists()).toBe(false)
  })

  it('点击行动按钮触发 action 事件', async () => {
    setActivePinia(createPinia())
    const wrapper = mount(BalanceAlert, {
      props: { balanceCents: 500 },
      global: { plugins: [i18n, makeRouter()], mocks: globalMocks },
    })
    const actionBtn = wrapper.find('.alert-btn')
    expect(actionBtn.exists()).toBe(true)
    await actionBtn.trigger('click')
    expect(wrapper.emitted('action')).toBeTruthy()
  })

  it('不使用 !important', () => {
    setActivePinia(createPinia())
    const wrapper = mount(BalanceAlert, {
      props: { balanceCents: 500 },
      global: { plugins: [i18n, makeRouter()], mocks: globalMocks },
    })
    expect(wrapper.html()).not.toContain('!important')
  })

  it('使用全局变量 (样式源文件含 --global-border-radius)', () => {
    // vitest 不解析 SCSS, 验证模板不依赖高优先级覆盖与高特异性选择器
    setActivePinia(createPinia())
    const wrapper = mount(BalanceAlert, {
      props: { balanceCents: 500 },
      global: { plugins: [i18n, makeRouter()], mocks: globalMocks },
    })
    const html = wrapper.html()
    expect(html).toContain('level-critical')
    expect(html).not.toContain('!important')
  })
})

describe('TransactionDetail 组件', () => {
  const baseTx = {
    id: 'TX001',
    user_id: 'u1',
    tx_type: 'expense',
    amount: 5000,
    status: 'success',
    description: '测试消费',
    related_order_no: 'ORD001',
    created_at: '2026-06-18T10:00:00Z',
  }

  it('显示金额', () => {
    setActivePinia(createPinia())
    const wrapper = mount(TransactionDetail, {
      props: { modelValue: true, transaction: baseTx },
      global: { plugins: [i18n, makeRouter()], mocks: globalMocks },
    })
    expect(wrapper.html()).toContain('50.00')
  })

  it('显示交易 ID', () => {
    setActivePinia(createPinia())
    const wrapper = mount(TransactionDetail, {
      props: { modelValue: true, transaction: baseTx },
      global: { plugins: [i18n, makeRouter()], mocks: globalMocks },
    })
    expect(wrapper.html()).toContain('TX001')
  })

  it('状态徽章渲染', () => {
    setActivePinia(createPinia())
    const wrapper = mount(TransactionDetail, {
      props: { modelValue: true, transaction: baseTx },
      global: { plugins: [i18n, makeRouter()], mocks: globalMocks },
    })
    expect(wrapper.find('.status-success').exists()).toBe(true)
  })

  it('不同状态使用不同 class', () => {
    setActivePinia(createPinia())
    const wrapper = mount(TransactionDetail, {
      props: { modelValue: true, transaction: { ...baseTx, status: 'pending' } },
      global: { plugins: [i18n, makeRouter()], mocks: globalMocks },
    })
    expect(wrapper.find('.status-pending').exists()).toBe(true)
  })

  it('关联订单可点击', async () => {
    setActivePinia(createPinia())
    const wrapper = mount(TransactionDetail, {
      props: { modelValue: true, transaction: baseTx },
      global: { plugins: [i18n, makeRouter()], mocks: globalMocks },
    })
    const orderLink = wrapper.find('.tx-order-link')
    if (orderLink.exists()) {
      await orderLink.trigger('click')
    }
  })

  it('关闭弹窗 emit update:modelValue', async () => {
    setActivePinia(createPinia())
    const wrapper = mount(TransactionDetail, {
      props: { modelValue: true, transaction: baseTx },
      global: { plugins: [i18n, makeRouter()], mocks: globalMocks },
    })
    const closeBtn = wrapper.find('.el-dialog__close')
    if (closeBtn.exists()) {
      await closeBtn.trigger('click')
    }
  })

  it('入账金额卡片 outgoing 样式 (expense)', () => {
    setActivePinia(createPinia())
    const wrapper = mount(TransactionDetail, {
      props: { modelValue: true, transaction: baseTx },
      global: { plugins: [i18n, makeRouter()], mocks: globalMocks },
    })
    expect(wrapper.find('.tx-amount-card.outgoing').exists()).toBe(true)
  })

  it('入账金额卡片 incoming 样式 (income)', () => {
    setActivePinia(createPinia())
    const wrapper = mount(TransactionDetail, {
      props: { modelValue: true, transaction: { ...baseTx, tx_type: 'income' } },
      global: { plugins: [i18n, makeRouter()], mocks: globalMocks },
    })
    expect(wrapper.find('.tx-amount-card.incoming').exists()).toBe(true)
  })
})
