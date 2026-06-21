import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextTick, ref } from 'vue'

vi.mock('vue', async () => {
  const actual = await vi.importActual('vue')
  return {
    ...actual,
    onUnmounted: vi.fn(),
  }
})

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('useDebounce', () => {
    it('应该延迟执行函数', async () => {
      const { useDebounce } = await import('../useDebounce')
      const fn = vi.fn()
      const { run } = useDebounce(fn, 100)

      run('test')
      expect(fn).not.toHaveBeenCalled()

      vi.advanceTimersByTime(100)
      expect(fn).toHaveBeenCalledWith('test')
    })

    it('应该取消之前的调用', async () => {
      const { useDebounce } = await import('../useDebounce')
      const fn = vi.fn()
      const { run } = useDebounce(fn, 100)

      run('first')
      vi.advanceTimersByTime(50)
      run('second')
      vi.advanceTimersByTime(100)

      expect(fn).toHaveBeenCalledTimes(1)
      expect(fn).toHaveBeenCalledWith('second')
    })

    it('应该支持immediate选项', async () => {
      const { useDebounce } = await import('../useDebounce')
      const fn = vi.fn()
      const { run } = useDebounce(fn, 100, { immediate: true })

      run('test')
      expect(fn).toHaveBeenCalledWith('test')
    })

    it('cancel应该取消待执行的调用', async () => {
      const { useDebounce } = await import('../useDebounce')
      const fn = vi.fn()
      const { run, cancel } = useDebounce(fn, 100)

      run('test')
      cancel()
      vi.advanceTimersByTime(100)

      expect(fn).not.toHaveBeenCalled()
    })

    it('flush应该立即执行', async () => {
      const { useDebounce } = await import('../useDebounce')
      const fn = vi.fn()
      const { run, flush } = useDebounce(fn, 100)

      run('test')
      flush()

      expect(fn).toHaveBeenCalledWith('test')
    })
  })

  describe('useThrottle', () => {
    it('应该限制函数执行频率', async () => {
      const { useThrottle } = await import('../useDebounce')
      const fn = vi.fn()
      const { run } = useThrottle(fn, 100)

      run('first')
      vi.advanceTimersByTime(50)
      run('second')
      vi.advanceTimersByTime(50)
      run('third')

      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('应该支持leading选项', async () => {
      const { useThrottle } = await import('../useDebounce')
      const fn = vi.fn()
      const { run } = useThrottle(fn, 100, { leading: true })

      run('test')
      expect(fn).toHaveBeenCalledWith('test')
    })

    it('应该支持trailing选项', async () => {
      const { useThrottle } = await import('../useDebounce')
      const fn = vi.fn()
      const { run } = useThrottle(fn, 100, { leading: false, trailing: true })

      run('test')
      expect(fn).not.toHaveBeenCalled()

      vi.advanceTimersByTime(100)
      expect(fn).toHaveBeenCalledWith('test')
    })

    it('cancel应该取消待执行的调用', async () => {
      const { useThrottle } = await import('../useDebounce')
      const fn = vi.fn()
      const { run, cancel } = useThrottle(fn, 100, { trailing: true })

      run('test')
      cancel()
      vi.advanceTimersByTime(100)

      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('flush应该立即执行', async () => {
      const { useThrottle } = await import('../useDebounce')
      const fn = vi.fn()
      const { run, flush } = useThrottle(fn, 100, { trailing: true })

      run('test')
      flush()

      expect(fn).toHaveBeenCalled()
    })
  })

  // ============ useDebounce 补充用例 ============
  describe('useDebounce 补充覆盖', () => {
    it('immediate模式下二次调用不应再次立即执行', async () => {
      const { useDebounce } = await import('../useDebounce')
      const fn = vi.fn()
      const { run } = useDebounce(fn, 100, { immediate: true })

      // 第一次立即执行
      run('first')
      // 第二次因 timeoutId 存在不再立即执行
      run('second')

      expect(fn).toHaveBeenCalledTimes(1)
      expect(fn).toHaveBeenCalledWith('first')

      // 定时器到期后也不会再执行（immediate 模式下定时器内不调用 fn）
      vi.advanceTimersByTime(100)
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('cancel在无待执行任务时调用应安全无副作用', async () => {
      const { useDebounce } = await import('../useDebounce')
      const fn = vi.fn()
      const { cancel } = useDebounce(fn, 100)

      // 未调用 run 直接 cancel，不应抛错
      expect(() => cancel()).not.toThrow()
    })

    it('flush在无待执行任务时调用应安全无副作用', async () => {
      const { useDebounce } = await import('../useDebounce')
      const fn = vi.fn()
      const { flush } = useDebounce(fn, 100)

      // 未调用 run 直接 flush，不应执行 fn
      flush()
      expect(fn).not.toHaveBeenCalled()
    })

    it('cancel后flush不应执行', async () => {
      const { useDebounce } = await import('../useDebounce')
      const fn = vi.fn()
      const { run, cancel, flush } = useDebounce(fn, 100)

      run('test')
      cancel()
      // cancel 后 lastArgs 被清空，flush 不应执行
      flush()
      expect(fn).not.toHaveBeenCalled()
    })
  })

  // ============ useThrottle 补充用例 ============
  describe('useThrottle 补充覆盖', () => {
    it('leading为false时首次调用不应执行', async () => {
      const { useThrottle } = await import('../useDebounce')
      const fn = vi.fn()
      const { run } = useThrottle(fn, 100, { leading: false, trailing: false })

      run('test')
      expect(fn).not.toHaveBeenCalled()

      // 定时器到期后 trailing 为 false 也不执行
      vi.advanceTimersByTime(100)
      expect(fn).not.toHaveBeenCalled()
    })

    it('cancel在无待执行任务时调用应安全无副作用', async () => {
      const { useThrottle } = await import('../useDebounce')
      const fn = vi.fn()
      const { cancel } = useThrottle(fn, 100)

      expect(() => cancel()).not.toThrow()
    })

    it('flush在无待执行任务时调用应安全无副作用', async () => {
      const { useThrottle } = await import('../useDebounce')
      const fn = vi.fn()
      const { flush } = useThrottle(fn, 100)

      flush()
      expect(fn).not.toHaveBeenCalled()
    })

    it('leading和trailing都为true时首次立即执行且trailing也会执行', async () => {
      const { useThrottle } = await import('../useDebounce')
      const fn = vi.fn()
      const { run } = useThrottle(fn, 100, { leading: true, trailing: true })

      run('test')
      expect(fn).toHaveBeenCalledTimes(1)

      vi.advanceTimersByTime(100)
      // trailing 也会执行一次
      expect(fn).toHaveBeenCalledTimes(2)
    })
  })

  // ============ useDebouncedRef ============
  describe('useDebouncedRef', () => {
    it('应该返回初始值', async () => {
      const { useDebouncedRef } = await import('../useDebounce')
      const debounced = useDebouncedRef('initial', 100)
      expect(debounced.value).toBe('initial')
    })

    it('immediate触发后定时器应执行且值保持不变', async () => {
      const { useDebouncedRef } = await import('../useDebounce')
      const debounced = useDebouncedRef('initial', 100)
      // immediate: true 会立即触发 watch，设置定时器
      vi.advanceTimersByTime(100)
      // 定时器执行后值仍为初始值（watch 源是普通值不会变化）
      expect(debounced.value).toBe('initial')
    })
  })

  // ============ useThrottledRef ============
  describe('useThrottledRef', () => {
    it('应该返回初始值', async () => {
      const { useThrottledRef } = await import('../useDebounce')
      const throttled = useThrottledRef('initial', 100)
      expect(throttled.value).toBe('initial')
    })

    it('immediate触发时应立即更新（lastCallTime为0满足间隔条件）', async () => {
      const { useThrottledRef } = await import('../useDebounce')
      const throttled = useThrottledRef('initial', 100)
      // immediate: true 触发 watch，now - 0 >= 100 走立即更新分支
      vi.advanceTimersByTime(100)
      expect(throttled.value).toBe('initial')
    })
  })

  // ============ useDebouncedWatch ============
  describe('useDebouncedWatch', () => {
    it('应该在延迟后执行回调', async () => {
      const { useDebouncedWatch } = await import('../useDebounce')
      const source = ref('a')
      const callback = vi.fn()

      useDebouncedWatch(source, callback, 100)

      source.value = 'b'
      await nextTick()
      expect(callback).not.toHaveBeenCalled()

      vi.advanceTimersByTime(100)
      expect(callback).toHaveBeenCalledWith('b', 'a')
    })

    it('应该在多次快速变化时只执行最后一次回调', async () => {
      const { useDebouncedWatch } = await import('../useDebounce')
      const source = ref('a')
      const callback = vi.fn()

      useDebouncedWatch(source, callback, 100)

      source.value = 'b'
      await nextTick()
      vi.advanceTimersByTime(50)
      source.value = 'c'
      await nextTick()
      vi.advanceTimersByTime(100)

      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith('c', 'b')
    })
  })
})
