import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useMouse, useMouseInElement, useMousePressed, useMouseHover } from '../useMouse'

// 收集 onUnmounted 回调，方便测试中手动触发清理
const unmountCallbacks: Array<() => void> = []

vi.mock('vue', async () => {
  const actual = await vi.importActual('vue')
  return {
    ...actual,
    ref: actual.ref,
    onMounted: vi.fn((fn: () => void) => fn()),
    onUnmounted: vi.fn((fn: () => void) => { unmountCallbacks.push(fn) }),
  }
})

// 创建 TouchEvent 的辅助函数（jsdom 不支持 TouchEvent 构造）
function createTouchEvent(type: string, touches: Array<{ clientX: number; clientY: number }> = []): TouchEvent {
  const event = new Event(type, { bubbles: true })
  Object.defineProperty(event, 'touches', { value: touches, configurable: true })
  return event as unknown as TouchEvent
}

// 创建带 pageX/pageY 的 MouseEvent（jsdom 构造函数不支持 pageX/pageY 参数）
function createMouseEvent(type: string, pageX: number, pageY: number): MouseEvent {
  const event = new MouseEvent(type)
  Object.defineProperty(event, 'pageX', { value: pageX, configurable: true })
  Object.defineProperty(event, 'pageY', { value: pageY, configurable: true })
  return event
}

// 保存原始 rAF，方便 afterEach 恢复
const originalRaf = window.requestAnimationFrame.bind(window)
const originalCancelRaf = window.cancelAnimationFrame.bind(window)

describe('useMouse.ts', () => {
  beforeEach(() => {
    // rAF 同步执行，方便测试
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 0 })
    vi.stubGlobal('cancelAnimationFrame', () => {})
  })

  afterEach(() => {
    // 触发所有清理函数，移除事件监听器，避免累积影响后续测试
    unmountCallbacks.forEach(fn => fn())
    vi.unstubAllGlobals()
    window.requestAnimationFrame = originalRaf
    window.cancelAnimationFrame = originalCancelRaf
    unmountCallbacks.length = 0
  })

  describe('useMouse', () => {
    it('应该返回鼠标位置', () => {
      const { x, y, sourceType } = useMouse()

      expect(x.value).toBeDefined()
      expect(y.value).toBeDefined()
      expect(sourceType.value).toBe('mouse')
    })

    it('mousemove 事件应该更新鼠标位置和 sourceType', () => {
      const { x, y, sourceType } = useMouse()
      window.dispatchEvent(createMouseEvent('mousemove', 100, 200))
      expect(x.value).toBe(100)
      expect(y.value).toBe(200)
      expect(sourceType.value).toBe('mouse')
    })

    it('touchmove 事件应该更新触摸位置和 sourceType', () => {
      const { x, y, sourceType } = useMouse()
      window.dispatchEvent(createTouchEvent('touchmove', [{ clientX: 50, clientY: 60 }]))
      expect(x.value).toBe(50)
      expect(y.value).toBe(60)
      expect(sourceType.value).toBe('touch')
    })

    it('touchmove 没有 touches 时不更新', () => {
      const { x, y } = useMouse()
      window.dispatchEvent(createTouchEvent('touchmove', []))
      expect(x.value).toBe(0)
      expect(y.value).toBe(0)
    })

    it('rAF 期间节流，不重复调度', () => {
      // rAF 不立即执行回调，模拟节流场景
      const rafMock = vi.fn(() => 1)
      vi.stubGlobal('requestAnimationFrame', rafMock)
      useMouse()
      window.dispatchEvent(createMouseEvent('mousemove', 10, 20))
      expect(rafMock).toHaveBeenCalledTimes(1)
      // 再次触发，应该被节流
      window.dispatchEvent(createMouseEvent('mousemove', 30, 40))
      expect(rafMock).toHaveBeenCalledTimes(1)
    })

    it('touchmove rAF 期间节流，不重复调度', () => {
      const rafMock = vi.fn(() => 1)
      vi.stubGlobal('requestAnimationFrame', rafMock)
      useMouse()
      window.dispatchEvent(createTouchEvent('touchmove', [{ clientX: 10, clientY: 20 }]))
      expect(rafMock).toHaveBeenCalledTimes(1)
      // 再次触发，应该被节流
      window.dispatchEvent(createTouchEvent('touchmove', [{ clientX: 30, clientY: 40 }]))
      expect(rafMock).toHaveBeenCalledTimes(1)
    })

    it('组件卸载时取消未完成的 rAF', () => {
      // rAF 不立即执行，保留 rAF id
      vi.stubGlobal('requestAnimationFrame', vi.fn(() => 42))
      const cancelMock = vi.fn(() => {})
      vi.stubGlobal('cancelAnimationFrame', cancelMock)
      useMouse()
      window.dispatchEvent(createMouseEvent('mousemove', 10, 20))
      // 触发清理
      unmountCallbacks.forEach(fn => fn())
      expect(cancelMock).toHaveBeenCalledWith(42)
    })
  })

  describe('useMouseInElement', () => {
    it('应该返回元素内的鼠标位置', () => {
      const mockElement = { getBoundingClientRect: () => ({ left: 0, top: 0, right: 100, bottom: 100 }) }
      const target = { value: mockElement as unknown as HTMLElement }
      const { x, y, isOutside } = useMouseInElement(target as unknown as { value: HTMLElement | null })

      expect(x.value).toBeDefined()
      expect(y.value).toBeDefined()
      expect(isOutside.value).toBeDefined()
    })

    it('mousemove 在元素内时计算相对坐标且 isOutside 为 false', () => {
      const mockElement = { getBoundingClientRect: () => ({ left: 10, top: 20, right: 110, bottom: 120 }) }
      const target = { value: mockElement as unknown as HTMLElement }
      const { x, y, isOutside } = useMouseInElement(target as unknown as { value: HTMLElement | null })
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 50, clientY: 60 }))
      expect(x.value).toBe(40) // 50 - 10
      expect(y.value).toBe(40) // 60 - 20
      expect(isOutside.value).toBe(false)
    })

    it('mousemove 在元素右侧外时 isOutside 为 true', () => {
      const mockElement = { getBoundingClientRect: () => ({ left: 10, top: 10, right: 110, bottom: 110 }) }
      const target = { value: mockElement as unknown as HTMLElement }
      const { isOutside } = useMouseInElement(target as unknown as { value: HTMLElement | null })
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 60 }))
      expect(isOutside.value).toBe(true)
    })

    it('mousemove 在元素左侧外时 isOutside 为 true', () => {
      const mockElement = { getBoundingClientRect: () => ({ left: 100, top: 100, right: 200, bottom: 200 }) }
      const target = { value: mockElement as unknown as HTMLElement }
      const { isOutside } = useMouseInElement(target as unknown as { value: HTMLElement | null })
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 50, clientY: 150 }))
      expect(isOutside.value).toBe(true)
    })

    it('mousemove 在元素上方外时 isOutside 为 true', () => {
      const mockElement = { getBoundingClientRect: () => ({ left: 100, top: 100, right: 200, bottom: 200 }) }
      const target = { value: mockElement as unknown as HTMLElement }
      const { isOutside } = useMouseInElement(target as unknown as { value: HTMLElement | null })
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 150, clientY: 50 }))
      expect(isOutside.value).toBe(true)
    })

    it('mousemove 在元素下方外时 isOutside 为 true', () => {
      const mockElement = { getBoundingClientRect: () => ({ left: 100, top: 100, right: 200, bottom: 200 }) }
      const target = { value: mockElement as unknown as HTMLElement }
      const { isOutside } = useMouseInElement(target as unknown as { value: HTMLElement | null })
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 150, clientY: 300 }))
      expect(isOutside.value).toBe(true)
    })

    it('target.value 为 null 时不报错且不更新', () => {
      const target = { value: null }
      const { x, y } = useMouseInElement(target as any)
      expect(() => {
        window.dispatchEvent(new MouseEvent('mousemove', { clientX: 50, clientY: 60 }))
      }).not.toThrow()
      expect(x.value).toBe(0)
      expect(y.value).toBe(0)
    })

    it('rAF 期间节流，不重复调度', () => {
      const rafMock = vi.fn(() => 1)
      vi.stubGlobal('requestAnimationFrame', rafMock)
      const mockElement = { getBoundingClientRect: () => ({ left: 0, top: 0, right: 100, bottom: 100 }) }
      const target = { value: mockElement as unknown as HTMLElement }
      useMouseInElement(target as any)
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 10, clientY: 20 }))
      expect(rafMock).toHaveBeenCalledTimes(1)
      // 再次触发，应该被节流
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 30, clientY: 40 }))
      expect(rafMock).toHaveBeenCalledTimes(1)
    })

    it('组件卸载时取消未完成的 rAF', () => {
      vi.stubGlobal('requestAnimationFrame', vi.fn(() => 42))
      const cancelMock = vi.fn(() => {})
      vi.stubGlobal('cancelAnimationFrame', cancelMock)
      const mockElement = { getBoundingClientRect: () => ({ left: 0, top: 0, right: 100, bottom: 100 }) }
      const target = { value: mockElement as unknown as HTMLElement }
      useMouseInElement(target as any)
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 50, clientY: 60 }))
      unmountCallbacks.forEach(fn => fn())
      expect(cancelMock).toHaveBeenCalledWith(42)
    })
  })

  describe('useMousePressed', () => {
    it('初始状态应该是未按下', () => {
      const { pressed, sourceType } = useMousePressed()

      expect(pressed.value).toBe(false)
      expect(sourceType.value).toBe('mouse')
    })

    it('mousedown 设置 pressed 为 true，sourceType 为 mouse', () => {
      const { pressed, sourceType } = useMousePressed()
      window.dispatchEvent(new MouseEvent('mousedown'))
      expect(pressed.value).toBe(true)
      expect(sourceType.value).toBe('mouse')
    })

    it('mouseup 设置 pressed 为 false', () => {
      const { pressed } = useMousePressed()
      window.dispatchEvent(new MouseEvent('mousedown'))
      window.dispatchEvent(new MouseEvent('mouseup'))
      expect(pressed.value).toBe(false)
    })

    it('touchstart 设置 pressed 为 true，sourceType 为 touch', () => {
      const { pressed, sourceType } = useMousePressed()
      window.dispatchEvent(createTouchEvent('touchstart'))
      expect(pressed.value).toBe(true)
      expect(sourceType.value).toBe('touch')
    })

    it('touchend 设置 pressed 为 false', () => {
      const { pressed } = useMousePressed()
      window.dispatchEvent(createTouchEvent('touchstart'))
      window.dispatchEvent(createTouchEvent('touchend'))
      expect(pressed.value).toBe(false)
    })
  })

  describe('useMouseHover', () => {
    it('target 为 null 时返回 false 且不注册事件', () => {
      const target = { value: null }
      const isHovered = useMouseHover(target as any)
      expect(isHovered.value).toBe(false)
    })

    it('mouseenter/mouseleave 切换 isHovered 状态', () => {
      const el = { addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as HTMLElement
      const target = { value: el }
      const isHovered = useMouseHover(target as any)
      expect(isHovered.value).toBe(false)
      // 触发 mouseenter 回调
      const enterCall = (el.addEventListener as any).mock.calls.find((c: any[]) => c[0] === 'mouseenter')
      enterCall[1]()
      expect(isHovered.value).toBe(true)
      // 触发 mouseleave 回调
      const leaveCall = (el.addEventListener as any).mock.calls.find((c: any[]) => c[0] === 'mouseleave')
      leaveCall[1]()
      expect(isHovered.value).toBe(false)
    })
  })
})
