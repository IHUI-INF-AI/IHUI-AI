import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useTimeoutFn, useIntervalFn, useTimer } from '../useTimer'

vi.mock('vue', () => ({
  onUnmounted: vi.fn(),
  ref: vi.fn((value: any) => ({ value })),
}))

describe('useTimer.ts', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('useTimeoutFn', () => {
    it('应该在延迟后执行回调', async () => {
      const callback = vi.fn()
      useTimeoutFn(callback, 1000, { autostart: true })

      expect(callback).not.toHaveBeenCalled()

      vi.advanceTimersByTime(1000)

      expect(callback).toHaveBeenCalledTimes(1)
    })

    it('immediate选项应该立即执行回调', () => {
      const callback = vi.fn()
      useTimeoutFn(callback, 1000, { immediate: true, autostart: true })

      expect(callback).toHaveBeenCalledTimes(1)
    })

    it('stop应该取消定时器', () => {
      const callback = vi.fn()
      const { stop } = useTimeoutFn(callback, 1000, { autostart: true })

      stop()
      vi.advanceTimersByTime(1000)

      expect(callback).not.toHaveBeenCalled()
    })

    it('restart应该重新启动定时器', async () => {
      const callback = vi.fn()
      const { restart } = useTimeoutFn(callback, 1000, { autostart: false })

      restart()
      vi.advanceTimersByTime(1000)

      expect(callback).toHaveBeenCalledTimes(1)
    })
  })

  describe('useIntervalFn', () => {
    it('应该定期执行回调', async () => {
      const callback = vi.fn()
      useIntervalFn(callback, 100, { autostart: true })

      vi.advanceTimersByTime(350)

      expect(callback).toHaveBeenCalledTimes(3)
    })

    it('stop应该取消间隔', () => {
      const callback = vi.fn()
      const { stop } = useIntervalFn(callback, 100, { autostart: true })

      vi.advanceTimersByTime(150)
      stop()
      vi.advanceTimersByTime(200)

      expect(callback).toHaveBeenCalledTimes(1)
    })
  })

  describe('useTimer', () => {
    it('setTimeout应该正确工作', () => {
      const timer = useTimer()
      const callback = vi.fn()

      timer.setTimeout(callback, 100)
      vi.advanceTimersByTime(100)

      expect(callback).toHaveBeenCalledTimes(1)
    })

    it('clearTimeout应该取消定时器', () => {
      const timer = useTimer()
      const callback = vi.fn()

      const id = timer.setTimeout(callback, 100)
      timer.clearTimeout(id)
      vi.advanceTimersByTime(100)

      expect(callback).not.toHaveBeenCalled()
    })

    it('setInterval应该正确工作', () => {
      const timer = useTimer()
      const callback = vi.fn()

      timer.setInterval(callback, 100)
      vi.advanceTimersByTime(250)

      expect(callback).toHaveBeenCalledTimes(2)
    })

    it('clearAll应该清除所有定时器', () => {
      const timer = useTimer()
      const callback1 = vi.fn()
      const callback2 = vi.fn()

      timer.setTimeout(callback1, 100)
      timer.setInterval(callback2, 100)
      timer.clearAll()
      vi.advanceTimersByTime(200)

      expect(callback1).not.toHaveBeenCalled()
      expect(callback2).not.toHaveBeenCalled()
    })
  })
})
