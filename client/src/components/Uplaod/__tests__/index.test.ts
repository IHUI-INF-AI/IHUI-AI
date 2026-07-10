// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Uplaod from '@/components/Uplaod/index.vue'

describe('Uplaod', () => {
  it('应该能正常挂载', () => {
    const wrapper = mount(Uplaod, {
      props: { modelValue: '', accept: 'image/*', limit: 1 },
    })
    expect(wrapper.exists()).toBe(true)
  })

  it('应该正确传递 props (modelValue, accept, limit)', () => {
    const wrapper = mount(Uplaod, {
      props: { modelValue: '', accept: 'image/png', limit: 3 },
    })
    const input = wrapper.find('input[type="file"]')
    expect(input.attributes('accept')).toBe('image/png')
    // limit=3, 未达上限时显示上传按钮
    expect(wrapper.text()).toContain('点击上传')
  })

  it('应该存在文件输入元素', () => {
    const wrapper = mount(Uplaod, {
      props: { modelValue: '', accept: 'image/*', limit: 1 },
    })
    const input = wrapper.find('input[type="file"]')
    expect(input.exists()).toBe(true)
  })

  it('删除文件应该触发 update:modelValue 事件', async () => {
    const wrapper = mount(Uplaod, {
      props: {
        modelValue: 'http://example.com/test.png',
        accept: 'image/*',
        limit: 1,
        files: [{ name: 'test.png', url: 'http://example.com/test.png' }],
      },
    })
    // limit=1 且已有 1 个文件, 上传按钮隐藏, 只剩删除按钮
    const removeButton = wrapper.find('button')
    expect(removeButton.exists()).toBe(true)
    await removeButton.trigger('click')

    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')![0]).toEqual([''])
  })
})
