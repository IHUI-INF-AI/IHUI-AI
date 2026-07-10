// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Page from '@/components/Page/index.vue'

describe('Page', () => {
  it('应该能正常挂载', () => {
    const wrapper = mount(Page, {
      props: { total: 100, current: 1, pageSize: 20 },
    })
    expect(wrapper.exists()).toBe(true)
  })

  it('应该正确传递 props (total, current, pageSize)', () => {
    const wrapper = mount(Page, {
      props: { total: 100, current: 1, pageSize: 20 },
    })
    // total 显示在文本中
    expect(wrapper.text()).toContain('100')
    // pageSize 体现在 select 的值
    const select = wrapper.find('select')
    expect(select.element.value).toBe('20')
  })

  it('应该渲染分页按钮', () => {
    // total=100, pageSize=20 -> totalPages=5, 渲染页码 1-5
    const wrapper = mount(Page, {
      props: { total: 100, current: 1, pageSize: 20 },
    })
    const buttons = wrapper.findAll('button')
    expect(buttons.length).toBeGreaterThan(0)
    expect(wrapper.text()).toContain('1')
    expect(wrapper.text()).toContain('5')
  })

  it('点击页码应该触发 current-change 和 update:current 事件', async () => {
    const wrapper = mount(Page, {
      props: { total: 100, current: 1, pageSize: 20 },
    })
    const page2Button = wrapper.findAll('button').find((b) => b.text().trim() === '2')
    expect(page2Button).toBeTruthy()
    await page2Button!.trigger('click')

    expect(wrapper.emitted('update:current')).toBeTruthy()
    expect(wrapper.emitted('update:current')![0]).toEqual([2])
    expect(wrapper.emitted('current-change')).toBeTruthy()
    expect(wrapper.emitted('current-change')![0]).toEqual([2])
    expect(wrapper.emitted('change')).toBeTruthy()
    expect(wrapper.emitted('change')![0]).toEqual([2, 20])
  })
})
