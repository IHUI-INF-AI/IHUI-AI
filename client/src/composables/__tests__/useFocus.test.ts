import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useFocus, useActiveElement, useFocusTrap } from '../useFocus'
import { watch, onUnmounted } from 'vue'

vi.mock('vue', async () => {
  const actual = await vi.importActual('vue')
  return {
    ...actual,
    ref: actual.ref,
    watch: vi.fn(),
    onMounted: vi.fn((fn) => fn()),
    onUnmounted: vi.fn(),
  }
})

describe('useFocus.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('useFocus', () => {
    it('应该返回焦点状态', () => {
      const target = { value: document.createElement('input') }
      const { focused, focus, blur } = useFocus(target as unknown as { value: HTMLElement | null })

      expect(focused.value).toBeDefined()
      expect(typeof focus).toBe('function')
      expect(typeof blur).toBe('function')
    })

    it('应该支持初始值', () => {
      const target = { value: document.createElement('input') }
      const { focused } = useFocus(target as unknown as { value: HTMLElement | null }, { initialValue: true })

      expect(focused.value).toBe(true)
    })

    it('focus 方法应该调用元素的 focus', () => {
      const el = document.createElement('input')
      const focusSpy = vi.spyOn(el, 'focus')
      const target = { value: el }
      const { focus } = useFocus(target as unknown as { value: HTMLElement | null })

      focus()
      expect(focusSpy).toHaveBeenCalled()
    })

    it('blur 方法应该调用元素的 blur', () => {
      const el = document.createElement('input')
      const blurSpy = vi.spyOn(el, 'blur')
      const target = { value: el }
      const { blur } = useFocus(target as unknown as { value: HTMLElement | null })

      blur()
      expect(blurSpy).toHaveBeenCalled()
    })

    it('focus 事件应该将 focused 设为 true', () => {
      const el = document.createElement('input')
      const target = { value: el }
      const { focused } = useFocus(target as unknown as { value: HTMLElement | null })

      el.dispatchEvent(new Event('focus'))
      expect(focused.value).toBe(true)
    })

    it('blur 事件应该将 focused 设为 false', () => {
      const el = document.createElement('input')
      const target = { value: el }
      const { focused } = useFocus(target as unknown as { value: HTMLElement | null }, { initialValue: true })

      el.dispatchEvent(new Event('blur'))
      expect(focused.value).toBe(false)
    })

    it('target 为 null 时 focus 和 blur 不应报错', () => {
      const target = { value: null }
      const { focus, blur } = useFocus(target as unknown as { value: HTMLElement | null })

      expect(() => focus()).not.toThrow()
      expect(() => blur()).not.toThrow()
    })

    it('target 为 null 时初始化不应报错', () => {
      const target = { value: null }
      expect(() => useFocus(target as unknown as { value: HTMLElement | null })).not.toThrow()
    })

    it('watch 回调应该在 target 变化时切换事件绑定', () => {
      const el1 = document.createElement('input')
      const el2 = document.createElement('input')
      const target = { value: el1 }
      useFocus(target as unknown as { value: HTMLElement | null })

      const watchCalls = vi.mocked(watch).mock.calls
      const callback = watchCalls[0][1] as (newTarget: HTMLElement | null, oldTarget: HTMLElement | null) => void

      const removeSpy1 = vi.spyOn(el1, 'removeEventListener')
      const addSpy2 = vi.spyOn(el2, 'addEventListener')

      callback(el2, el1)
      expect(removeSpy1).toHaveBeenCalledWith('focus', expect.any(Function))
      expect(removeSpy1).toHaveBeenCalledWith('blur', expect.any(Function))
      expect(addSpy2).toHaveBeenCalledWith('focus', expect.any(Function))
      expect(addSpy2).toHaveBeenCalledWith('blur', expect.any(Function))
    })

    it('watch 回调中 oldTarget 为 null 时不应报错', () => {
      const el = document.createElement('input')
      const target = { value: null }
      useFocus(target as unknown as { value: HTMLElement | null })

      const watchCalls = vi.mocked(watch).mock.calls
      const callback = watchCalls[0][1] as (newTarget: HTMLElement | null, oldTarget: HTMLElement | null) => void

      expect(() => callback(el, null)).not.toThrow()
    })

    it('watch 回调中 newTarget 为 null 时不应报错', () => {
      const el = document.createElement('input')
      const target = { value: el }
      useFocus(target as unknown as { value: HTMLElement | null })

      const watchCalls = vi.mocked(watch).mock.calls
      const callback = watchCalls[0][1] as (newTarget: HTMLElement | null, oldTarget: HTMLElement | null) => void

      expect(() => callback(null, el)).not.toThrow()
    })

    it('onUnmounted 应该解绑事件', () => {
      const el = document.createElement('input')
      const removeSpy = vi.spyOn(el, 'removeEventListener')
      const target = { value: el }
      useFocus(target as unknown as { value: HTMLElement | null })

      const onUnmountedCalls = vi.mocked(onUnmounted).mock.calls
      const callback = onUnmountedCalls[0][0] as () => void
      callback()

      expect(removeSpy).toHaveBeenCalledWith('focus', expect.any(Function))
      expect(removeSpy).toHaveBeenCalledWith('blur', expect.any(Function))
    })

    it('onUnmounted 中 target 为 null 时不应报错', () => {
      const target = { value: null }
      useFocus(target as unknown as { value: HTMLElement | null })

      const onUnmountedCalls = vi.mocked(onUnmounted).mock.calls
      const callback = onUnmountedCalls[0][0] as () => void

      expect(() => callback()).not.toThrow()
    })
  })

  describe('useActiveElement', () => {
    it('应该返回当前活动元素', () => {
      const activeElement = useActiveElement()
      expect(activeElement.value).toBeDefined()
    })

    it('focusin 事件应该触发更新', () => {
      const activeElement = useActiveElement()
      document.dispatchEvent(new Event('focusin'))
      expect(activeElement.value).toBe(document.activeElement)
    })

    it('focusout 事件应该触发更新', () => {
      const activeElement = useActiveElement()
      document.dispatchEvent(new Event('focusout'))
      expect(activeElement.value).toBe(document.activeElement)
    })

    it('onUnmounted 应该移除事件监听', () => {
      useActiveElement()
      const onUnmountedCalls = vi.mocked(onUnmounted).mock.calls
      // useCleanup 内部调用 onUnmounted 注册清理回调
      const callback = onUnmountedCalls[onUnmountedCalls.length - 1][0] as () => void

      const removeSpy = vi.spyOn(document, 'removeEventListener')
      callback()
      expect(removeSpy).toHaveBeenCalledWith('focusin', expect.any(Function), undefined)
      expect(removeSpy).toHaveBeenCalledWith('focusout', expect.any(Function), undefined)
    })
  })

  describe('useFocusTrap', () => {
    it('应该提供焦点陷阱方法', () => {
      const container = { value: document.createElement('div') }
      const { activate, deactivate } = useFocusTrap(container as unknown as { value: HTMLElement | null })

      expect(typeof activate).toBe('function')
      expect(typeof deactivate).toBe('function')
    })

    it('container 为 null 时 activate 不应报错', () => {
      const container = { value: null }
      const { activate, deactivate } = useFocusTrap(container as unknown as { value: HTMLElement | null })
      expect(() => activate()).not.toThrow()
      deactivate()
    })

    it('activate 应该聚焦第一个可聚焦元素', () => {
      const containerEl = document.createElement('div')
      const input1 = document.createElement('input')
      const input2 = document.createElement('input')
      containerEl.appendChild(input1)
      containerEl.appendChild(input2)
      document.body.appendChild(containerEl)

      const focusSpy = vi.spyOn(input1, 'focus')
      const container = { value: containerEl }
      const { activate, deactivate } = useFocusTrap(container as unknown as { value: HTMLElement | null })

      activate()
      expect(focusSpy).toHaveBeenCalled()
      deactivate()
      document.body.removeChild(containerEl)
    })

    it('activate 无可聚焦元素时不应报错', () => {
      const containerEl = document.createElement('div')
      document.body.appendChild(containerEl)

      const container = { value: containerEl }
      const { activate, deactivate } = useFocusTrap(container as unknown as { value: HTMLElement | null })

      expect(() => activate()).not.toThrow()
      deactivate()
      document.body.removeChild(containerEl)
    })

    it('deactivate 应该移除 keydown 监听', () => {
      const container = { value: document.createElement('div') }
      const { activate, deactivate } = useFocusTrap(container as unknown as { value: HTMLElement | null })
      activate()

      const removeSpy = vi.spyOn(document, 'removeEventListener')
      deactivate()
      expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
    })

    it('Tab 在最后一个元素应该循环到第一个', () => {
      const containerEl = document.createElement('div')
      const input1 = document.createElement('input')
      const input2 = document.createElement('input')
      containerEl.appendChild(input1)
      containerEl.appendChild(input2)
      document.body.appendChild(containerEl)

      const container = { value: containerEl }
      const { activate, deactivate } = useFocusTrap(container as unknown as { value: HTMLElement | null })
      activate()

      input2.focus()

      const focusSpy = vi.spyOn(input1, 'focus')
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))

      expect(focusSpy).toHaveBeenCalled()
      deactivate()
      document.body.removeChild(containerEl)
    })

    it('Shift+Tab 在第一个元素应该循环到最后一个', () => {
      const containerEl = document.createElement('div')
      const input1 = document.createElement('input')
      const input2 = document.createElement('input')
      containerEl.appendChild(input1)
      containerEl.appendChild(input2)
      document.body.appendChild(containerEl)

      const container = { value: containerEl }
      const { activate, deactivate } = useFocusTrap(container as unknown as { value: HTMLElement | null })
      activate()

      input1.focus()

      const focusSpy = vi.spyOn(input2, 'focus')
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }))

      expect(focusSpy).toHaveBeenCalled()
      deactivate()
      document.body.removeChild(containerEl)
    })

    it('未激活时 Tab 不应触发循环', () => {
      const containerEl = document.createElement('div')
      const input1 = document.createElement('input')
      containerEl.appendChild(input1)
      document.body.appendChild(containerEl)

      const container = { value: containerEl }
      useFocusTrap(container as unknown as { value: HTMLElement | null })

      const focusSpy = vi.spyOn(input1, 'focus')
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))

      expect(focusSpy).not.toHaveBeenCalled()
      document.body.removeChild(containerEl)
    })

    it('非 Tab 键不应触发循环', () => {
      const containerEl = document.createElement('div')
      const input1 = document.createElement('input')
      containerEl.appendChild(input1)
      document.body.appendChild(containerEl)

      const container = { value: containerEl }
      const { activate, deactivate } = useFocusTrap(container as unknown as { value: HTMLElement | null })
      activate()

      input1.focus()

      const focusSpy = vi.spyOn(input1, 'focus')
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))

      expect(focusSpy).not.toHaveBeenCalled()
      deactivate()
      document.body.removeChild(containerEl)
    })

    it('无可聚焦元素时 Tab 不应报错', () => {
      const containerEl = document.createElement('div')
      document.body.appendChild(containerEl)

      const container = { value: containerEl }
      const { activate, deactivate } = useFocusTrap(container as unknown as { value: HTMLElement | null })
      activate()

      expect(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))).not.toThrow()
      deactivate()
      document.body.removeChild(containerEl)
    })

    it('Tab 在中间元素不应循环', () => {
      const containerEl = document.createElement('div')
      const input1 = document.createElement('input')
      const input2 = document.createElement('input')
      const input3 = document.createElement('input')
      containerEl.appendChild(input1)
      containerEl.appendChild(input2)
      containerEl.appendChild(input3)
      document.body.appendChild(containerEl)

      const container = { value: containerEl }
      const { activate, deactivate } = useFocusTrap(container as unknown as { value: HTMLElement | null })
      activate()

      input2.focus()

      const focusSpy1 = vi.spyOn(input1, 'focus')
      const focusSpy3 = vi.spyOn(input3, 'focus')
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))

      expect(focusSpy1).not.toHaveBeenCalled()
      expect(focusSpy3).not.toHaveBeenCalled()
      deactivate()
      document.body.removeChild(containerEl)
    })

    it('Shift+Tab 在非首元素时不循环', () => {
      const containerEl = document.createElement('div')
      const input1 = document.createElement('input')
      const input2 = document.createElement('input')
      containerEl.appendChild(input1)
      containerEl.appendChild(input2)
      document.body.appendChild(containerEl)

      const container = { value: containerEl }
      const { activate, deactivate } = useFocusTrap(container as unknown as { value: HTMLElement | null })
      activate()

      input2.focus()

      const focusSpy1 = vi.spyOn(input1, 'focus')
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }))

      expect(focusSpy1).not.toHaveBeenCalled()
      deactivate()
      document.body.removeChild(containerEl)
    })

    it('onUnmounted 应该调用 deactivate', () => {
      const container = { value: document.createElement('div') }
      useFocusTrap(container as unknown as { value: HTMLElement | null })

      const onUnmountedCalls = vi.mocked(onUnmounted).mock.calls
      const callback = onUnmountedCalls[0][0] as () => void

      const removeSpy = vi.spyOn(document, 'removeEventListener')
      callback()
      expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
    })

    it('应该识别多种可聚焦元素类型', () => {
      const containerEl = document.createElement('div')

      const link = document.createElement('a')
      link.href = '#'
      const button = document.createElement('button')
      const input = document.createElement('input')
      const select = document.createElement('select')
      const textarea = document.createElement('textarea')
      const tabindexEl = document.createElement('div')
      tabindexEl.setAttribute('tabindex', '0')

      containerEl.appendChild(link)
      containerEl.appendChild(button)
      containerEl.appendChild(input)
      containerEl.appendChild(select)
      containerEl.appendChild(textarea)
      containerEl.appendChild(tabindexEl)
      document.body.appendChild(containerEl)

      const container = { value: containerEl }
      const { activate, deactivate } = useFocusTrap(container as unknown as { value: HTMLElement | null })

      const focusSpy = vi.spyOn(link, 'focus')
      activate()
      expect(focusSpy).toHaveBeenCalled()
      deactivate()
      document.body.removeChild(containerEl)
    })
  })
})
