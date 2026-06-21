import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { useA11y } from '../useA11y'

// 用 jsdom 风格的 matchMedia stub
const createMatchMedia = (matches: boolean) => {
  const listeners: Array<(e: MediaQueryListEvent) => void> = []
  return {
    matches,
    media: '',
    onchange: null,
    addEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => {
      listeners.push(cb)
    },
    removeEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => {
      const idx = listeners.indexOf(cb)
      if (idx >= 0) listeners.splice(idx, 1)
    },
    addListener: (cb: (e: MediaQueryListEvent) => void) => listeners.push(cb),
    removeListener: (cb: (e: MediaQueryListEvent) => void) => {
      const idx = listeners.indexOf(cb)
      if (idx >= 0) listeners.splice(idx, 1)
    },
    dispatchEvent: () => true,
    _listeners: listeners,
  }
}

const mountComposable = (setup: () => any) => {
  let captured: any = null
  const Comp = defineComponent({
    setup() {
      captured = setup()
      return () => h('div')
    },
  })
  const wrapper = mount(Comp)
  return { wrapper, result: captured }
}

describe('useA11y.ts', () => {
  let originalMatchMedia: typeof window.matchMedia

  beforeEach(() => {
    originalMatchMedia = window.matchMedia
    // jsdom 不提供 matchMedia，统一 stub
    window.matchMedia = vi.fn().mockImplementation((query: string) => createMatchMedia(false)) as any
    document.body.innerHTML = ''
    vi.useFakeTimers()
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  describe('announce - aria-live 区域', () => {
    it('应该在 polite 区域写入消息', async () => {
      const { result } = mountComposable(() => useA11y())
      result.announce('操作成功')
      // setTimeout 0 在 fakeTimers 下需要 advance
      vi.advanceTimersByTime(0)
      const el = document.getElementById('a11y-live-polite')
      expect(el).toBeTruthy()
      expect(el?.getAttribute('aria-live')).toBe('polite')
      expect(el?.textContent).toBe('操作成功')
    })

    it('应该在 assertive 区域写入消息', async () => {
      const { result } = mountComposable(() => useA11y())
      result.announce('余额不足', { politeness: 'assertive' })
      vi.advanceTimersByTime(0)
      const el = document.getElementById('a11y-live-assertive')
      expect(el).toBeTruthy()
      expect(el?.getAttribute('aria-live')).toBe('assertive')
      expect(el?.getAttribute('role')).toBe('alert')
      expect(el?.textContent).toBe('余额不足')
    })

    it('应该在 clearAfter 毫秒后清空', async () => {
      const { result } = mountComposable(() => useA11y())
      result.announce('已提交', { clearAfter: 1000 })
      vi.advanceTimersByTime(0)
      const el = document.getElementById('a11y-live-polite')
      expect(el?.textContent).toBe('已提交')
      vi.advanceTimersByTime(1100)
      expect(el?.textContent).toBe('')
    })

    it('连续两次相同文本应能重新朗读（先清空后写入）', () => {
      const { result } = mountComposable(() => useA11y())
      result.announce('重复消息')
      vi.advanceTimersByTime(0)
      const el = document.getElementById('a11y-live-polite')
      expect(el?.textContent).toBe('重复消息')
      // 第二次相同消息
      result.announce('重复消息')
      // 此时 textContent 应已被清空
      expect(el?.textContent).toBe('')
      vi.advanceTimersByTime(0)
      expect(el?.textContent).toBe('重复消息')
    })
  })

  describe('focusFirst / focusLast / getFocusable', () => {
    it('focusFirst 应聚焦容器内第一个可聚焦元素', () => {
      const host = document.createElement('div')
      host.innerHTML = `
        <button>1</button>
        <button>2</button>
        <button>3</button>
      `
      document.body.appendChild(host)
      const { result } = mountComposable(() => useA11y())
      result.focusFirst(host)
      const focused = document.activeElement as HTMLElement
      expect(focused?.tagName).toBe('BUTTON')
      expect(focused?.textContent).toBe('1')
    })

    it('focusLast 应聚焦容器内最后一个可聚焦元素', () => {
      const host = document.createElement('div')
      host.innerHTML = `
        <button>1</button>
        <button>2</button>
        <button>3</button>
      `
      document.body.appendChild(host)
      const { result } = mountComposable(() => useA11y())
      result.focusLast(host)
      const focused = document.activeElement as HTMLElement
      expect(focused?.textContent).toBe('3')
    })

    it('getFocusable 应过滤掉 disabled 和 tabindex=-1 的元素', () => {
      const host = document.createElement('div')
      host.innerHTML = `
        <button>1</button>
        <button disabled>2</button>
        <button tabindex="-1">3</button>
        <button>4</button>
      `
      document.body.appendChild(host)
      const { result } = mountComposable(() => useA11y())
      const list = result.getFocusable(host)
      expect(list.length).toBe(2)
      expect(list[0].textContent).toBe('1')
      expect(list[1].textContent).toBe('4')
    })
  })

  describe('trapFocus - 焦点陷阱', () => {
    it('Tab 在最后一个元素时应回到第一个', async () => {
      const host = document.createElement('div')
      host.innerHTML = `
        <button id="a">1</button>
        <button id="b">2</button>
        <button id="c">3</button>
      `
      document.body.appendChild(host)
      const ref = { value: host as HTMLElement | null }
      const { result } = mountComposable(() => {
        const a = useA11y()
        a.trapFocus(ref)
        return a
      })
      const last = host.querySelector('#c') as HTMLElement
      last.focus()
      const ev = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })
      document.dispatchEvent(ev)
      const focused = document.activeElement as HTMLElement
      expect(focused?.id).toBe('a')
    })

    it('Shift+Tab 在第一个元素时应跳到最后一个', async () => {
      const host = document.createElement('div')
      host.innerHTML = `
        <button id="a">1</button>
        <button id="b">2</button>
        <button id="c">3</button>
      `
      document.body.appendChild(host)
      const ref = { value: host as HTMLElement | null }
      const { result } = mountComposable(() => {
        const a = useA11y()
        a.trapFocus(ref)
        return a
      })
      const first = host.querySelector('#a') as HTMLElement
      first.focus()
      const ev = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true })
      document.dispatchEvent(ev)
      const focused = document.activeElement as HTMLElement
      expect(focused?.id).toBe('c')
    })

    it('Escape 应触发 onEscape 回调', () => {
      const onEsc = vi.fn()
      const host = document.createElement('div')
      document.body.appendChild(host)
      const ref = { value: host as HTMLElement | null }
      const { result } = mountComposable(() => {
        const a = useA11y()
        a.trapFocus(ref, onEsc)
        return a
      })
      const ev = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
      document.dispatchEvent(ev)
      expect(onEsc).toHaveBeenCalled()
    })
  })

  describe('媒体查询响应', () => {
    it('isReducedMotion 初始值应与 matchMedia 一致', () => {
      window.matchMedia = vi.fn().mockImplementation((query: string) => {
        if (query.includes('reduced-motion')) return createMatchMedia(true)
        if (query.includes('contrast')) return createMatchMedia(false)
        if (query.includes('forced-colors')) return createMatchMedia(false)
        return createMatchMedia(false)
      })
      const { result } = mountComposable(() => useA11y())
      expect(result.isReducedMotion.value).toBe(true)
      expect(result.isHighContrast.value).toBe(false)
      expect(result.isForcedColors.value).toBe(false)
    })

    it('isHighContrast 应响应 prefers-contrast: more', () => {
      const mq = createMatchMedia(false)
      window.matchMedia = vi.fn().mockImplementation((query: string) => {
        if (query.includes('contrast')) return mq
        return createMatchMedia(false)
      })
      const { result } = mountComposable(() => useA11y())
      // 同步初始化已完成
      expect(result.isHighContrast.value).toBe(false)
      // 模拟变化：mq.matches 改变 + 触发 change
      mq.matches = true
      // 触发 change 事件
      const ev = { matches: true, media: '(prefers-contrast: more)' } as MediaQueryListEvent
      mq.dispatchEvent(ev)
      mq._listeners.forEach((cb) => cb(ev))
      expect(result.isHighContrast.value).toBe(true)
    })
  })
})
