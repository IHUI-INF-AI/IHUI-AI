import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import LiveRegion from '../LiveRegion.vue'

describe('LiveRegion.vue', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('应渲染两个 aria-live 区域（polite + assertive）', () => {
    const wrapper = mount(LiveRegion)
    const polite = wrapper.find('#a11y-live-polite')
    const assertive = wrapper.find('#a11y-live-assertive')
    expect(polite.exists()).toBe(true)
    expect(assertive.exists()).toBe(true)
  })

  it('polite 区域应具有正确的 ARIA 属性', () => {
    const wrapper = mount(LiveRegion)
    const polite = wrapper.find('#a11y-live-polite')
    expect(polite.attributes('aria-live')).toBe('polite')
    expect(polite.attributes('aria-atomic')).toBe('true')
    expect(polite.attributes('role')).toBe('status')
  })

  it('assertive 区域应具有 role=alert（关键告警）', () => {
    const wrapper = mount(LiveRegion)
    const assertive = wrapper.find('#a11y-live-assertive')
    expect(assertive.attributes('aria-live')).toBe('assertive')
    expect(assertive.attributes('aria-atomic')).toBe('true')
    expect(assertive.attributes('role')).toBe('alert')
  })

  it('两个区域均应用 sr-only 类（视觉隐藏）', () => {
    const wrapper = mount(LiveRegion)
    expect(wrapper.find('#a11y-live-polite').classes()).toContain('sr-only')
    expect(wrapper.find('#a11y-live-assertive').classes()).toContain('sr-only')
  })
})
