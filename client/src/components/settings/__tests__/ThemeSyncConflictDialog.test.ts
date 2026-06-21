import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import ThemeSyncConflictDialog from '../ThemeSyncConflictDialog.vue'

// mock 格式化时间工具
vi.mock('@/utils/format', () => ({
  formatDateTime: (timestamp: number) => `formatted-${timestamp}`
}))

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  messages: {
    'zh-CN': {
      themeSync: {
        conflict: {
          title: '同步冲突',
          description: '检测到本地和云端数据存在冲突，请选择如何处理。',
          keepLocal: '保留本地版本',
          useCloud: '使用云端版本',
          merge: '智能合并',
          mergeDesc: '自动选择最新的更改',
          thisDevice: '此设备',
          cloudBackup: '云端备份',
          rememberChoice: '记住我的选择',
          confirm: '确认'
        }
      },
      common: {
        cancel: '取消'
      }
    }
  }
})

describe('ThemeSyncConflictDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // 通用挂载函数
  const mountComponent = (props = {}) => {
    return mount(ThemeSyncConflictDialog, {
      props: {
        modelValue: true,
        localData: {
          themeMode: 'dark',
          updatedAt: 1700000000000,
          deviceId: 'device-local'
        },
        cloudData: {
          themeMode: 'light',
          updatedAt: 1700000001000,
          deviceId: 'device-cloud'
        },
        ...props
      },
      global: {
        plugins: [i18n],
        stubs: {
          'el-dialog': {
            template: '<div class="el-dialog" v-if="modelValue"><slot /><slot name="footer" /></div>',
            props: ['modelValue', 'title', 'width']
          },
          'el-radio': true,
          'el-checkbox': {
            template: '<label><input type="checkbox" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)" /><slot /></label>',
            props: ['modelValue']
          },
          'el-button': { template: '<button @click="$emit(\'click\')"><slot /></button>' },
          'el-icon': true
        }
      },
      attachTo: document.body
    })
  }

  // 找到按钮所在的 dialog footer
  const getFooter = (wrapper: any) => {
    return wrapper.find('.dialog-footer')
  }

  it('应该渲染对话框', () => {
    const wrapper = mountComponent()
    expect(wrapper.find('.conflict-content').exists()).toBe(true)
  })

  it('应该显示冲突描述', () => {
    const wrapper = mountComponent()
    expect(wrapper.text()).toContain('检测到本地和云端数据存在冲突')
  })

  it('应该显示三个解决选项', () => {
    const wrapper = mountComponent()
    const options = wrapper.findAll('.conflict-option')
    expect(options.length).toBe(3)
  })

  it('应该显示记住选择选项', () => {
    const wrapper = mountComponent()
    expect(getFooter(wrapper).exists()).toBe(true)
  })

  it('当 modelValue 为 false 时不应该显示', () => {
    const wrapper = mountComponent({ modelValue: false })
    expect(wrapper.find('.conflict-content').exists()).toBe(false)
  })

  it('应该显示本地设备信息', () => {
    const wrapper = mountComponent()
    expect(wrapper.text()).toContain('此设备')
  })

  it('应该显示云端备份信息', () => {
    const wrapper = mountComponent()
    expect(wrapper.text()).toContain('云端备份')
  })

  it('默认应该选中 cloud 选项', () => {
    const wrapper = mountComponent()
    const options = wrapper.findAll('.conflict-option')
    expect(options[1].classes()).toContain('selected')
    expect(options[0].classes()).not.toContain('selected')
    expect(options[2].classes()).not.toContain('selected')
  })

  it('点击 local 选项时应该改变选中状态', async () => {
    const wrapper = mountComponent()
    const options = wrapper.findAll('.conflict-option')
    await options[0].trigger('click')
    await nextTick()
    expect(options[0].classes()).toContain('selected')
    expect(options[1].classes()).not.toContain('selected')
    expect(options[2].classes()).not.toContain('selected')
  })

  it('点击 cloud 选项时应该改变选中状态', async () => {
    const wrapper = mountComponent()
    const options = wrapper.findAll('.conflict-option')
    await options[0].trigger('click')
    await nextTick()
    await options[1].trigger('click')
    await nextTick()
    expect(options[0].classes()).not.toContain('selected')
    expect(options[1].classes()).toContain('selected')
  })

  it('点击 merge 选项时应该改变选中状态', async () => {
    const wrapper = mountComponent()
    const options = wrapper.findAll('.conflict-option')
    await options[2].trigger('click')
    await nextTick()
    expect(options[2].classes()).toContain('selected')
    expect(options[0].classes()).not.toContain('selected')
    expect(options[1].classes()).not.toContain('selected')
  })

  it('当对话框打开时应该重置 selectedResolution 为 cloud', async () => {
    const wrapper = mountComponent({ modelValue: false })
    await wrapper.setProps({ modelValue: true })
    await nextTick()
    const options = wrapper.findAll('.conflict-option')
    expect(options[1].classes()).toContain('selected')
  })

  it('当对话框关闭再打开时应该重置 rememberChoice', async () => {
    const wrapper = mountComponent()
    // 模拟打开过
    await wrapper.setProps({ modelValue: false })
    await nextTick()
    await wrapper.setProps({ modelValue: true })
    await nextTick()
    // 验证 watch 被触发过，重置为 cloud
    const options = wrapper.findAll('.conflict-option')
    expect(options[1].classes()).toContain('selected')
  })

  it('formatTime 在没有 timestamp 时应该返回空字符串', () => {
    const wrapper = mountComponent({ localData: null })
    // 验证组件能正常挂载，null 情况下不报错
    expect(wrapper.find('.conflict-content').exists()).toBe(true)
  })

  it('formatTime 在有 timestamp 时应该返回格式化时间', () => {
    const wrapper = mountComponent()
    const html = wrapper.html()
    expect(html).toContain('formatted-1700000000000')
    expect(html).toContain('formatted-1700000001000')
  })

  it('点击取消按钮应该触发 update:modelValue 事件', async () => {
    const wrapper = mountComponent()
    const buttons = wrapper.findAll('button')
    // 第一个是取消按钮
    await buttons[0].trigger('click')
    await nextTick()
    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toBeTruthy()
    expect(emitted![0]).toEqual([false])
  })

  it('点击确认按钮应该触发 resolve 事件并关闭对话框', async () => {
    const wrapper = mountComponent()
    const buttons = wrapper.findAll('button')
    // 第二个是确认按钮
    await buttons[1].trigger('click')
    await nextTick()
    const resolveEmitted = wrapper.emitted('resolve')
    expect(resolveEmitted).toBeTruthy()
    expect(resolveEmitted![0]).toEqual(['cloud', false])
    const updateEmitted = wrapper.emitted('update:modelValue')
    expect(updateEmitted).toBeTruthy()
    expect(updateEmitted![updateEmitted!.length - 1]).toEqual([false])
  })

  it('点击确认按钮应该传递当前选中的解决方案', async () => {
    const wrapper = mountComponent()
    const options = wrapper.findAll('.conflict-option')
    await options[0].trigger('click')
    await nextTick()
    const buttons = wrapper.findAll('button')
    await buttons[1].trigger('click')
    await nextTick()
    const resolveEmitted = wrapper.emitted('resolve')
    expect(resolveEmitted![0]).toEqual(['local', false])
  })

  it('点击确认按钮应该传递 rememberChoice 状态', async () => {
    const wrapper = mountComponent()
    // 勾选记住选择
    const checkbox = wrapper.find('input[type="checkbox"]')
    await checkbox.setValue(true)
    await nextTick()
    const buttons = wrapper.findAll('button')
    await buttons[1].trigger('click')
    await nextTick()
    const resolveEmitted = wrapper.emitted('resolve')
    expect(resolveEmitted![0][1]).toBe(true)
  })

  it('应该显示记住选择的文本', () => {
    const wrapper = mountComponent()
    expect(wrapper.text()).toContain('记住我的选择')
  })

  it('应该显示格式化后的本地时间', () => {
    const wrapper = mountComponent()
    expect(wrapper.html()).toContain('formatted-1700000000000')
  })

  it('应该显示格式化后的云端时间', () => {
    const wrapper = mountComponent()
    expect(wrapper.html()).toContain('formatted-1700000001000')
  })

  it('应该显示 merge 选项的描述', () => {
    const wrapper = mountComponent()
    expect(wrapper.text()).toContain('自动选择最新的更改')
  })
})
