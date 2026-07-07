/**
 * 验证 onClickOutside subTree 错误修复 (2026-07-06)
 *
 * 背景: AIChat.vue 原用 onClickOutside([ref1, ref2], handler) 传数组 target.
 * VueUse 14.3.0 的 listener 里: `if (!(el instanceof Element) && hasMultipleRoots(target) ...)`
 *   - 数组 target 时, unrefElement(array) 返回数组本身 (非 Element)
 *   - 于是走到 hasMultipleRoots: vm = toValue(array) = array; vm.$ = undefined
 *   - vm.$.subTree → 抛 "Cannot read properties of undefined (reading 'subTree')"
 *   - 异常中断 listener, handler 永不执行 → click-outside-to-close 失效
 *
 * 修复: onClickOutside(ref1, handler, { ignore: [ref2] })
 *   - 单 HTMLElement ref: el instanceof Element = true → hasMultipleRoots 短路不调用 → 不抛
 *   - ignore: 点击 ref2 (teleported panel) 时 shouldIgnore=true → handler 不触发
 *   - 点击外部: handler 正常触发
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import { onClickOutside } from '@vueuse/core'

const tick = (ms = 10) => new Promise<void>(r => setTimeout(r, ms))

function dispatchClick(el: Element) {
  el.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true, detail: 1 }))
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }))
}

describe('onClickOutside subTree bug — array target vs single ref + ignore', () => {
  let errors: string[] = []
  let onerror: (e: ErrorEvent) => void

  beforeEach(() => {
    errors = []
    onerror = (e: ErrorEvent) => {
      errors.push(e.error?.message || e.message || String(e))
    }
    window.addEventListener('error', onerror as EventListener)
  })
  afterEach(() => {
    window.removeEventListener('error', onerror as EventListener)
  })

  it('reproduces bug: array target throws subTree error on outside click', async () => {
    const handler = vi.fn()
    const Comp = defineComponent({
      setup() {
        const r1 = ref<HTMLElement | null>(null)
        const r2 = ref<HTMLElement | null>(null)
        // @ts-expect-error 故意复现 bug: 传数组 (VueUse 14.3.0 不支持)
        onClickOutside([r1, r2], handler)
        return () => h('div', [h('div', { ref: r1, class: 'a' }), h('div', { ref: r2, class: 'b' })])
      },
    })
    const wrapper = mount(Comp, { attachTo: document.body })
    await nextTick()
    await tick()

    // 在 body 上点击 (target 之外)
    dispatchClick(document.body)
    await tick()

    // bug: hasMultipleRoots 抛 subTree 错误, handler 永不执行
    expect(errors.some(m => m.includes('subTree'))).toBe(true)
    expect(handler).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('fix: single ref + ignore does NOT throw, handler fires on outside click', async () => {
    const handler = vi.fn()
    const Comp = defineComponent({
      setup() {
        const r1 = ref<HTMLElement | null>(null)
        const r2 = ref<HTMLElement | null>(null)
        onClickOutside(r1, handler, { ignore: [r2] })
        return () => h('div', [h('div', { ref: r1, class: 'a' }), h('div', { ref: r2, class: 'b' })])
      },
    })
    const wrapper = mount(Comp, { attachTo: document.body })
    await nextTick()
    await tick()

    dispatchClick(document.body)
    await tick()

    expect(errors.some(m => m.includes('subTree'))).toBe(false)
    expect(handler).toHaveBeenCalled()
    wrapper.unmount()
  })

  it('fix: clicking the ignored element (teleported panel) does NOT close', async () => {
    const handler = vi.fn()
    const Comp = defineComponent({
      setup() {
        const r1 = ref<HTMLElement | null>(null)
        const r2 = ref<HTMLElement | null>(null)
        onClickOutside(r1, handler, { ignore: [r2] })
        return () => h('div', [h('div', { ref: r1, class: 'a' }), h('div', { ref: r2, class: 'b' })])
      },
    })
    const wrapper = mount(Comp, { attachTo: document.body })
    await nextTick()
    await tick()

    const b = wrapper.find('.b').element
    dispatchClick(b)
    await tick()

    expect(errors.some(m => m.includes('subTree'))).toBe(false)
    expect(handler).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('fix: clicking the trigger (target) does NOT close', async () => {
    const handler = vi.fn()
    const Comp = defineComponent({
      setup() {
        const r1 = ref<HTMLElement | null>(null)
        const r2 = ref<HTMLElement | null>(null)
        onClickOutside(r1, handler, { ignore: [r2] })
        return () => h('div', [h('div', { ref: r1, class: 'a' }), h('div', { ref: r2, class: 'b' })])
      },
    })
    const wrapper = mount(Comp, { attachTo: document.body })
    await nextTick()
    await tick()

    const a = wrapper.find('.a').element
    dispatchClick(a)
    await tick()

    expect(errors.some(m => m.includes('subTree'))).toBe(false)
    expect(handler).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
