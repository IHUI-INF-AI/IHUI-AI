import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BalanceAlert from '../BalanceAlert.vue'

describe('BalanceAlert.vue - A11y', () => {
  it('普通状态下不应渲染', () => {
    const wrapper = mount(BalanceAlert, {
      props: { balanceCents: 50000 }, // 500 元，正常
    })
    expect(wrapper.find('.balance-alert').exists()).toBe(false)
  })

  it('warning 等级应使用 role=status', () => {
    const wrapper = mount(BalanceAlert, {
      props: { balanceCents: 5000, showAction: true, actionLabel: '充值' },
    })
    const alert = wrapper.find('.balance-alert')
    expect(alert.exists()).toBe(true)
    expect(alert.attributes('role')).toBe('status')
    expect(alert.attributes('aria-live')).toBe('polite')
  })

  it('critical 等级应使用 role=alert（关键告警）', () => {
    const wrapper = mount(BalanceAlert, {
      props: { balanceCents: 500, showAction: true, actionLabel: '充值' },
    })
    const alert = wrapper.find('.balance-alert')
    expect(alert.exists()).toBe(true)
    expect(alert.attributes('role')).toBe('alert')
    expect(alert.attributes('aria-live')).toBe('polite')
  })

  it('关闭按钮应具有 aria-label', () => {
    const wrapper = mount(BalanceAlert, {
      props: { balanceCents: 500, showAction: false },
    })
    const closeBtn = wrapper.find('.alert-close')
    expect(closeBtn.exists()).toBe(true)
    expect(closeBtn.attributes('aria-label')).toBe('关闭余额提醒')
  })

  it('操作按钮应具有 aria-label', () => {
    const wrapper = mount(BalanceAlert, {
      props: { balanceCents: 500, showAction: true, actionLabel: '立即充值' },
    })
    const btn = wrapper.find('.alert-btn')
    expect(btn.exists()).toBe(true)
    expect(btn.attributes('aria-label')).toBe('立即充值')
  })

  it('点击关闭按钮应 dismiss 并不再渲染', async () => {
    const wrapper = mount(BalanceAlert, {
      props: { balanceCents: 500, showAction: false },
    })
    expect(wrapper.find('.balance-alert').exists()).toBe(true)
    await wrapper.find('.alert-close').trigger('click')
    expect(wrapper.find('.balance-alert').exists()).toBe(false)
    expect(wrapper.emitted('dismiss')).toBeTruthy()
  })

  it('标题应使用 h3 语义化标签', () => {
    const wrapper = mount(BalanceAlert, {
      props: { balanceCents: 500, showAction: false },
    })
    const title = wrapper.find('.alert-title')
    expect(title.element.tagName).toBe('H3')
  })

  it('图标应被 aria-hidden 隐藏（避免屏幕阅读器重复朗读）', () => {
    const wrapper = mount(BalanceAlert, {
      props: { balanceCents: 500, showAction: false },
    })
    const icon = wrapper.find('.alert-icon')
    expect(icon.attributes('aria-hidden')).toBe('true')
  })
})
