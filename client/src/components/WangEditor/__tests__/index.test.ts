// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import WangEditor from '@/components/WangEditor/index.vue'

describe('WangEditor', () => {
  it('应该能正常挂载', () => {
    const wrapper = mount(WangEditor, {
      props: { modelValue: '', placeholder: '请输入内容', height: 300 },
    })
    expect(wrapper.exists()).toBe(true)
  })

  it('应该正确传递 props (modelValue, placeholder, height)', () => {
    const wrapper = mount(WangEditor, {
      props: { modelValue: '初始内容', placeholder: '请输入', height: 500 },
    })
    const textarea = wrapper.find('textarea')
    expect(textarea.exists()).toBe(true)
    expect(textarea.attributes('placeholder')).toBe('请输入')
    expect(textarea.element.value).toBe('初始内容')
    expect(textarea.element.style.minHeight).toBe('500px')
  })

  it('应该存在 textarea 元素', () => {
    const wrapper = mount(WangEditor, {
      props: { modelValue: '', placeholder: '请输入内容', height: 300 },
    })
    const textarea = wrapper.find('textarea')
    expect(textarea.exists()).toBe(true)
  })

  it('输入应该触发 update:modelValue 事件', async () => {
    const wrapper = mount(WangEditor, {
      props: { modelValue: '', placeholder: '请输入内容', height: 300 },
    })
    const textarea = wrapper.find('textarea')
    await textarea.setValue('新内容')

    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')![0]).toEqual(['新内容'])
  })
})
