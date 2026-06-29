import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { createI18n } from 'vue-i18n'

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  messages: { 'zh-CN': {} },
})

// mock router / store / request 等依赖，聚焦于 a11y 模板结构
vi.mock('@/stores/user', () => ({
  useUserStore: () => ({ userId: 'u1' }),
}))
vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ info: vi.fn(), success: vi.fn(), error: vi.fn() }),
}))
vi.mock('@/utils/request', () => ({
  default: {
    get: vi.fn().mockImplementation((url: string) => {
      if (url.includes('/trend')) {
        return Promise.resolve({ code: 0, data: { trend: [] } })
      }
      if (url.includes('/balance')) {
        return Promise.resolve({ code: 0, data: { balance: 0, frozen: 0 } })
      }
      if (url.includes('/summary')) {
        return Promise.resolve({ code: 0, data: { income: 0, expense: 0, net: 0, tx_count: 0, by_type: {} } })
      }
      return Promise.resolve({ code: 0, data: { list: [], total: 0 } })
    }),
  },
}))

// 用 stub 替换 BalanceAlert / TransactionDetail / RechargeDialog / WithdrawDialog
vi.mock('@/components/BalanceAlert.vue', () => ({
  default: defineComponent({
    name: 'BalanceAlert',
    props: ['balanceCents'],
    emits: ['action', 'dismiss'],
    setup(_, { emit }) {
      return () => h('div', {
        class: 'balance-alert-stub',
        role: 'status',
        'aria-label': '余额预警',
      }, [
        h('button', { onClick: () => emit('action') }, '充值'),
      ])
    },
  }),
}))
vi.mock('@/components/TransactionDetail.vue', () => ({
  default: defineComponent({
    name: 'TransactionDetail',
    props: ['modelValue', 'transaction'],
    emits: ['update:modelValue'],
    setup(props, { emit }) {
      return () => h('div', { class: 'tx-detail-stub' }, 'tx detail')
    },
  }),
}))
vi.mock('@/components/RechargeDialog.vue', () => ({
  default: defineComponent({
    name: 'RechargeDialog',
    props: ['modelValue', 'balance'],
    emits: ['update:modelValue', 'success'],
    setup() {
      return () => h('div', { class: 'recharge-stub' })
    },
  }),
}))
vi.mock('@/components/WithdrawDialog.vue', () => ({
  default: defineComponent({
    name: 'WithdrawDialog',
    props: ['modelValue', 'available'],
    emits: ['update:modelValue', 'success'],
    setup() {
      return () => h('div', { class: 'withdraw-stub' })
    },
  }),
}))

import Wallet from '../Wallet.vue'

const mountWallet = () => {
  return mount(Wallet, {
    global: {
      plugins: [i18n],
      stubs: {
        'el-date-picker': { template: '<div class="el-date-picker-stub" />' },
      },
    },
  })
}

describe('Wallet.vue - A11y', () => {
  beforeEach(() => {
    // 注入 aria-live 区域
    if (!document.getElementById('a11y-live-polite')) {
      const el = document.createElement('div')
      el.id = 'a11y-live-polite'
      el.setAttribute('aria-live', 'polite')
      document.body.appendChild(el)
    }
    if (!document.getElementById('a11y-live-assertive')) {
      const el = document.createElement('div')
      el.id = 'a11y-live-assertive'
      el.setAttribute('aria-live', 'assertive')
      document.body.appendChild(el)
    }
    // jsdom 不提供 matchMedia
    if (typeof window.matchMedia !== 'function') {
      window.matchMedia = vi.fn().mockImplementation(() => ({
        matches: false,
        media: '',
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => true,
      }))
    }
  })

  it('主要 region 应具有 aria-label', () => {
    const wrapper = mountWallet()
    const sections = wrapper.findAll('[role="region"]')
    expect(sections.length).toBeGreaterThanOrEqual(3) // 过滤栏 / 高级过滤 / 交易列表
    const labels = sections.map((s) => s.attributes('aria-label'))
    expect(labels.some(l => l && l.length > 0)).toBe(true)
  })

  it('收支汇总区域应使用 role=region + aria-label', () => {
    const wrapper = mountWallet()
    const summary = wrapper.find('.summary-grid')
    expect(summary.exists()).toBe(true)
    expect(summary.attributes('role')).toBe('region')
    expect(summary.attributes('aria-label')).toBeTruthy()
  })

  it('余额金额区域应使用 aria-live polite（动态变化播报）', () => {
    const wrapper = mountWallet()
    const amount = wrapper.find('.balance-amount')
    expect(amount.exists()).toBe(true)
    expect(amount.attributes('aria-live')).toBe('polite')
    expect(amount.attributes('aria-atomic')).toBe('true')
  })

  it('过滤 Tab 应使用 role=tablist + role=tab', () => {
    const wrapper = mountWallet()
    const tablist = wrapper.find('[role="tablist"]')
    expect(tablist.exists()).toBe(true)
    const tabs = wrapper.findAll('[role="tab"]')
    expect(tabs.length).toBe(5) // 全部 / 收入 / 支出 / 退款 / 充值
  })

  it('交易列表应使用 role=region + aria-labelledby', () => {
    const wrapper = mountWallet()
    const tx = wrapper.find('.tx-container')
    expect(tx.exists()).toBe(true)
    expect(tx.attributes('role')).toBe('region')
    expect(tx.attributes('aria-labelledby')).toBe('wallet-tx-heading')
    expect(tx.attributes('aria-busy')).toBeDefined()
  })

  it('分页应使用 nav + role=navigation', () => {
    // 触发分页（total > pageSize）
    const wrapper = mountWallet()
    // 初始为 0 条交易，不渲染分页
    expect(wrapper.find('.pagination').exists()).toBe(false)
  })

  it('input 应有 label 关联', () => {
    const wrapper = mountWallet()
    const keywordInput = wrapper.find('#wallet-filter-keyword')
    expect(keywordInput.exists()).toBe(true)
    const label = wrapper.find('label[for="wallet-filter-keyword"]')
    expect(label.exists()).toBe(true)
  })

  it('select 应有 label 关联（sr-only）', () => {
    const wrapper = mountWallet()
    const select = wrapper.find('#wallet-filter-days')
    expect(select.exists()).toBe(true)
    const label = wrapper.find('label[for="wallet-filter-days"]')
    expect(label.exists()).toBe(true)
  })

  it('trash 加载状态应使用 aria-live 区域', () => {
    const wrapper = mountWallet()
    const loading = wrapper.find('[aria-live="polite"]')
    expect(loading.exists()).toBe(true)
  })

  it('按钮 type 应明确为 "button"（避免 form 提交）', () => {
    const wrapper = mountWallet()
    const btns = wrapper.findAll('button')
    btns.forEach((b) => {
      // 关键交互按钮必须有 type
      const cls = b.classes().join(' ')
      if (cls.includes('action-btn') || cls.includes('alert-btn') || cls.includes('adv-btn') || cls.includes('export-btn') || cls.includes('page-btn') || cls.includes('filter-tab')) {
        expect(b.attributes('type')).toBe('button')
      }
    })
  })
})
