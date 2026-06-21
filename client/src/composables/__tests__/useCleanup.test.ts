import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { useCleanup } from '../useCleanup'

// 在组件 setup 上下文中执行 composable，返回结果与卸载方法
function withSetup<T>(composable: () => T): { result: T; unmount: () => void } {
  let result!: T
  const Comp = defineComponent({
    setup() {
      result = composable()
      return () => h('div')
    },
  })
  const wrapper = mount(Comp)
  return { result, unmount: () => wrapper.unmount() }
}

describe('useCleanup', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ============ 基础 API ============
  describe('基础 API', () => {
    it('应该返回所有清理方法', () => {
      const { result } = withSetup(() => useCleanup())
      expect(typeof result.add).toBe('function')
      expect(typeof result.addTimer).toBe('function')
      expect(typeof result.addInterval).toBe('function')
      expect(typeof result.addEventListener).toBe('function')
      expect(typeof result.addAbortController).toBe('function')
      expect(typeof result.run).toBe('function')
      expect(typeof result.size).toBe('function')
    })

    it('初始 size 应该为 0', () => {
      const { result } = withSetup(() => useCleanup())
      expect(result.size()).toBe(0)
    })
  })

  // ============ add 方法 ============
  describe('add', () => {
    it('应该注册清理函数并增加 size', () => {
      const { result } = withSetup(() => useCleanup())
      const fn = vi.fn()
      result.add(fn)
      expect(result.size()).toBe(1)
    })

    it('应该返回传入的函数', () => {
      const { result } = withSetup(() => useCleanup())
      const fn = vi.fn()
      const returned = result.add(fn)
      expect(returned).toBe(fn)
    })

    it('run 时应该执行清理函数', () => {
      const { result } = withSetup(() => useCleanup(false))
      const fn = vi.fn()
      result.add(fn)
      result.run()
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('run 后 size 应该归零', () => {
      const { result } = withSetup(() => useCleanup(false))
      result.add(vi.fn())
      result.run()
      expect(result.size()).toBe(0)
    })
  })

  // ============ addTimer 方法 ============
  describe('addTimer', () => {
    it('应该注册 setTimeout 并增加 size', () => {
      const { result } = withSetup(() => useCleanup())
      const id = result.addTimer(vi.fn(), 1000)
      expect(id).toBeDefined()
      expect(result.size()).toBe(1)
    })

    it('到时间应该执行回调', () => {
      const { result } = withSetup(() => useCleanup(false))
      const fn = vi.fn()
      result.addTimer(fn, 1000)
      vi.advanceTimersByTime(1000)
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('run 时应该取消未执行的 setTimeout', () => {
      const { result } = withSetup(() => useCleanup(false))
      const fn = vi.fn()
      result.addTimer(fn, 1000)
      result.run()
      vi.advanceTimersByTime(1000)
      expect(fn).not.toHaveBeenCalled()
    })
  })

  // ============ addInterval 方法 ============
  describe('addInterval', () => {
    it('应该注册 setInterval 并增加 size', () => {
      const { result } = withSetup(() => useCleanup())
      const id = result.addInterval(vi.fn(), 1000)
      expect(id).toBeDefined()
      expect(result.size()).toBe(1)
    })

    it('应该按间隔重复执行回调', () => {
      const { result } = withSetup(() => useCleanup(false))
      const fn = vi.fn()
      result.addInterval(fn, 1000)
      vi.advanceTimersByTime(3000)
      expect(fn).toHaveBeenCalledTimes(3)
    })

    it('run 时应该取消 setInterval', () => {
      const { result } = withSetup(() => useCleanup(false))
      const fn = vi.fn()
      result.addInterval(fn, 1000)
      result.run()
      vi.advanceTimersByTime(3000)
      expect(fn).not.toHaveBeenCalled()
    })
  })

  // ============ addEventListener 方法 ============
  describe('addEventListener', () => {
    it('应该注册事件监听器并增加 size', () => {
      const { result } = withSetup(() => useCleanup())
      const target = new EventTarget()
      result.addEventListener(target, 'test', vi.fn())
      expect(result.size()).toBe(1)
    })

    it('应该触发事件回调', () => {
      const { result } = withSetup(() => useCleanup(false))
      const target = new EventTarget()
      const handler = vi.fn()
      result.addEventListener(target, 'test', handler)
      target.dispatchEvent(new Event('test'))
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('run 时应该移除事件监听器', () => {
      const { result } = withSetup(() => useCleanup(false))
      const target = new EventTarget()
      const handler = vi.fn()
      result.addEventListener(target, 'test', handler)
      result.run()
      target.dispatchEvent(new Event('test'))
      expect(handler).not.toHaveBeenCalled()
    })

    it('应该支持 options 参数', () => {
      const { result } = withSetup(() => useCleanup(false))
      const target = new EventTarget()
      const handler = vi.fn()
      const removeSpy = vi.spyOn(target, 'removeEventListener')
      result.addEventListener(target, 'test', handler, { passive: true })
      result.run()
      expect(removeSpy).toHaveBeenCalledWith('test', handler, { passive: true })
    })
  })

  // ============ addAbortController 方法 ============
  describe('addAbortController', () => {
    it('应该返回 AbortController 并增加 size', () => {
      const { result } = withSetup(() => useCleanup())
      const controller = result.addAbortController()
      expect(controller).toBeInstanceOf(AbortController)
      expect(result.size()).toBe(1)
    })

    it('run 时应该调用 abort', () => {
      const { result } = withSetup(() => useCleanup(false))
      const controller = result.addAbortController()
      result.run()
      expect(controller.signal.aborted).toBe(true)
    })
  })

  // ============ run 方法 ============
  describe('run', () => {
    it('应该按倒序执行清理函数（LIFO）', () => {
      const { result } = withSetup(() => useCleanup(false))
      const order: number[] = []
      result.add(() => order.push(1))
      result.add(() => order.push(2))
      result.add(() => order.push(3))
      result.run()
      expect(order).toEqual([3, 2, 1])
    })

    it('一个清理函数抛错不应该影响其他清理函数', () => {
      const { result } = withSetup(() => useCleanup(false))
      const fn1 = vi.fn()
      const fn2 = vi.fn(() => { throw new Error('清理失败') })
      const fn3 = vi.fn()
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      result.add(fn1)
      result.add(fn2)
      result.add(fn3)
      result.run()
      expect(fn1).toHaveBeenCalled()
      expect(fn2).toHaveBeenCalled()
      expect(fn3).toHaveBeenCalled()
      expect(errorSpy).toHaveBeenCalled()
      errorSpy.mockRestore()
    })

    it('多次调用 run 应该是安全的', () => {
      const { result } = withSetup(() => useCleanup(false))
      result.add(vi.fn())
      result.run()
      result.run()
      expect(result.size()).toBe(0)
    })
  })

  // ============ 防重复清理 ============
  describe('防重复清理', () => {
    it('run 后再次调用 run 不应该重复执行清理函数', () => {
      const { result } = withSetup(() => useCleanup(false))
      const fn = vi.fn()
      result.add(fn)
      result.run()
      result.run()
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('run 后调用 add 应该立即执行新清理函数', () => {
      const { result } = withSetup(() => useCleanup(false))
      result.run()
      const fn = vi.fn()
      result.add(fn)
      expect(fn).toHaveBeenCalledTimes(1)
      expect(result.size()).toBe(0)
    })

    it('run 后调用 addTimer 应该立即取消定时器', () => {
      const { result } = withSetup(() => useCleanup(false))
      result.run()
      const fn = vi.fn()
      result.addTimer(fn, 1000)
      vi.advanceTimersByTime(2000)
      expect(fn).not.toHaveBeenCalled()
      expect(result.size()).toBe(0)
    })

    it('run 后调用 addInterval 应该立即取消定时器', () => {
      const { result } = withSetup(() => useCleanup(false))
      result.run()
      const fn = vi.fn()
      result.addInterval(fn, 1000)
      vi.advanceTimersByTime(3000)
      expect(fn).not.toHaveBeenCalled()
      expect(result.size()).toBe(0)
    })

    it('run 后调用 addEventListener 应该立即移除监听器', () => {
      const { result } = withSetup(() => useCleanup(false))
      const target = new EventTarget()
      result.run()
      const handler = vi.fn()
      result.addEventListener(target, 'test', handler)
      target.dispatchEvent(new Event('test'))
      expect(handler).not.toHaveBeenCalled()
      expect(result.size()).toBe(0)
    })

    it('run 后调用 addAbortController 应该立即 abort', () => {
      const { result } = withSetup(() => useCleanup(false))
      result.run()
      const controller = result.addAbortController()
      expect(controller.signal.aborted).toBe(true)
      expect(result.size()).toBe(0)
    })

    it('run 后 add 抛错不应该影响后续 add', () => {
      const { result } = withSetup(() => useCleanup(false))
      result.run()
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const fn1 = vi.fn(() => { throw new Error('清理失败') })
      const fn2 = vi.fn()
      result.add(fn1)
      result.add(fn2)
      expect(fn1).toHaveBeenCalledTimes(1)
      expect(fn2).toHaveBeenCalledTimes(1)
      expect(errorSpy).toHaveBeenCalled()
      errorSpy.mockRestore()
    })
  })

  // ============ size 方法 ============
  describe('size', () => {
    it('应该返回当前已注册的清理任务数', () => {
      const { result } = withSetup(() => useCleanup(false))
      expect(result.size()).toBe(0)
      result.add(vi.fn())
      expect(result.size()).toBe(1)
      result.addTimer(vi.fn(), 1000)
      expect(result.size()).toBe(2)
      result.addInterval(vi.fn(), 1000)
      expect(result.size()).toBe(3)
    })

    it('run 后 size 应该归零', () => {
      const { result } = withSetup(() => useCleanup(false))
      result.add(vi.fn())
      result.addTimer(vi.fn(), 1000)
      result.addInterval(vi.fn(), 1000)
      result.run()
      expect(result.size()).toBe(0)
    })
  })

  // ============ autoDispose 自动清理 ============
  describe('autoDispose 自动清理', () => {
    it('组件卸载时应该自动执行清理（默认 autoDispose=true）', async () => {
      const fn = vi.fn()
      const Comp = defineComponent({
        setup() {
          const cleanup = useCleanup()
          cleanup.add(fn)
          return () => h('div')
        },
      })
      const wrapper = mount(Comp)
      await nextTick()
      expect(fn).not.toHaveBeenCalled()
      wrapper.unmount()
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('autoDispose=false 时组件卸载不自动清理', async () => {
      const fn = vi.fn()
      const Comp = defineComponent({
        setup() {
          const cleanup = useCleanup(false)
          cleanup.add(fn)
          return () => h('div')
        },
      })
      const wrapper = mount(Comp)
      await nextTick()
      wrapper.unmount()
      expect(fn).not.toHaveBeenCalled()
    })

    it('组件卸载时应该清理所有注册的资源', async () => {
      const timerFn = vi.fn()
      const intervalFn = vi.fn()
      const eventHandler = vi.fn()
      const target = new EventTarget()

      const Comp = defineComponent({
        setup() {
          const cleanup = useCleanup()
          cleanup.addTimer(timerFn, 10000)
          cleanup.addInterval(intervalFn, 10000)
          cleanup.addEventListener(target, 'test', eventHandler)
          return () => h('div')
        },
      })
      const wrapper = mount(Comp)
      await nextTick()
      wrapper.unmount()

      // 卸载后推进时间，定时器不应执行
      vi.advanceTimersByTime(20000)
      expect(timerFn).not.toHaveBeenCalled()
      expect(intervalFn).not.toHaveBeenCalled()

      // 卸载后派发事件，监听器不应执行
      target.dispatchEvent(new Event('test'))
      expect(eventHandler).not.toHaveBeenCalled()
    })
  })

  // ============ addCancellableTimer 方法 ============
  describe('addCancellableTimer', () => {
    it('应该返回 cancel 函数和 id 并增加 size', () => {
      const { result } = withSetup(() => useCleanup())
      const ctrl = result.addCancellableTimer(vi.fn(), 1000)
      expect(typeof ctrl.cancel).toBe('function')
      expect(ctrl.id).toBeDefined()
      expect(result.size()).toBe(1)
    })

    it('到时间应该执行回调', () => {
      const { result } = withSetup(() => useCleanup(false))
      const fn = vi.fn()
      result.addCancellableTimer(fn, 1000)
      vi.advanceTimersByTime(1000)
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('主动 cancel 后到时不再执行', () => {
      const { result } = withSetup(() => useCleanup(false))
      const fn = vi.fn()
      const ctrl = result.addCancellableTimer(fn, 1000)
      ctrl.cancel()
      vi.advanceTimersByTime(2000)
      expect(fn).not.toHaveBeenCalled()
    })

    it('多次调用 cancel 应该是安全的', () => {
      const { result } = withSetup(() => useCleanup(false))
      const fn = vi.fn()
      const ctrl = result.addCancellableTimer(fn, 1000)
      ctrl.cancel()
      ctrl.cancel()
      ctrl.cancel()
      expect(fn).not.toHaveBeenCalled()
    })

    it('run 时应该自动 cancel 未执行的定时器', () => {
      const { result } = withSetup(() => useCleanup(false))
      const fn = vi.fn()
      result.addCancellableTimer(fn, 1000)
      result.run()
      vi.advanceTimersByTime(2000)
      expect(fn).not.toHaveBeenCalled()
    })

    it('disposed 后调用 addCancellableTimer 应该立即 cancel', () => {
      const { result } = withSetup(() => useCleanup(false))
      result.run()
      const fn = vi.fn()
      result.addCancellableTimer(fn, 1000)
      vi.advanceTimersByTime(2000)
      expect(fn).not.toHaveBeenCalled()
      expect(result.size()).toBe(0)
    })
  })

  // ============ addCancellableInterval 方法 ============
  describe('addCancellableInterval', () => {
    it('应该返回 cancel 函数和 id 并增加 size', () => {
      const { result } = withSetup(() => useCleanup())
      const ctrl = result.addCancellableInterval(vi.fn(), 1000)
      expect(typeof ctrl.cancel).toBe('function')
      expect(ctrl.id).toBeDefined()
      expect(result.size()).toBe(1)
    })

    it('应该按间隔重复执行回调', () => {
      const { result } = withSetup(() => useCleanup(false))
      const fn = vi.fn()
      result.addCancellableInterval(fn, 1000)
      vi.advanceTimersByTime(3000)
      expect(fn).toHaveBeenCalledTimes(3)
    })

    it('主动 cancel 后应该停止执行', () => {
      const { result } = withSetup(() => useCleanup(false))
      const fn = vi.fn()
      const ctrl = result.addCancellableInterval(fn, 1000)
      vi.advanceTimersByTime(1000)
      ctrl.cancel()
      vi.advanceTimersByTime(3000)
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('多次调用 cancel 应该是安全的', () => {
      const { result } = withSetup(() => useCleanup(false))
      const ctrl = result.addCancellableInterval(vi.fn(), 1000)
      ctrl.cancel()
      ctrl.cancel()
      vi.advanceTimersByTime(3000)
      // 不应该抛错，且回调未执行
      expect(ctrl.id).toBeDefined()
    })

    it('run 时应该自动 cancel 定时器', () => {
      const { result } = withSetup(() => useCleanup(false))
      const fn = vi.fn()
      result.addCancellableInterval(fn, 1000)
      result.run()
      vi.advanceTimersByTime(3000)
      expect(fn).not.toHaveBeenCalled()
    })

    it('disposed 后调用 addCancellableInterval 应该立即 cancel', () => {
      const { result } = withSetup(() => useCleanup(false))
      result.run()
      const fn = vi.fn()
      result.addCancellableInterval(fn, 1000)
      vi.advanceTimersByTime(3000)
      expect(fn).not.toHaveBeenCalled()
      expect(result.size()).toBe(0)
    })

    it('组件卸载时应该自动 cancel', async () => {
      const fn = vi.fn()
      const Comp = defineComponent({
        setup() {
          const cleanup = useCleanup()
          cleanup.addCancellableInterval(fn, 1000)
          return () => h('div')
        },
      })
      const wrapper = mount(Comp)
      await nextTick()
      wrapper.unmount()
      vi.advanceTimersByTime(3000)
      expect(fn).not.toHaveBeenCalled()
    })
  })

  // ============ 综合场景 ============
  describe('综合场景', () => {
    it('混合注册多种资源后统一清理', () => {
      const { result } = withSetup(() => useCleanup(false))
      const customFn = vi.fn()
      const timerFn = vi.fn()
      const intervalFn = vi.fn()
      const eventHandler = vi.fn()
      const target = new EventTarget()

      result.add(customFn)
      result.addTimer(timerFn, 1000)
      result.addInterval(intervalFn, 1000)
      result.addEventListener(target, 'click', eventHandler)
      const controller = result.addAbortController()

      expect(result.size()).toBe(5)

      result.run()

      expect(customFn).toHaveBeenCalledTimes(1)
      expect(controller.signal.aborted).toBe(true)

      vi.advanceTimersByTime(2000)
      expect(timerFn).not.toHaveBeenCalled()
      expect(intervalFn).not.toHaveBeenCalled()

      target.dispatchEvent(new Event('click'))
      expect(eventHandler).not.toHaveBeenCalled()

      expect(result.size()).toBe(0)
    })
  })
})
