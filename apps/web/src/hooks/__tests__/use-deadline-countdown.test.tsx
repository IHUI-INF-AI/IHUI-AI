// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import * as React from 'react'
import { act, render, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useDeadlineCountdown } from '../use-deadline-countdown'

const DAY = '2026-11-08T10:00:00.000Z'

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  })
}

/** 与考试页同一形状:倒计时读数归零即交卷,交卷锁复用同一枚 ref。 */
function ExamAutoSubmitHarness({
  deadline,
  onSubmit,
}: {
  deadline: number | null
  onSubmit: () => void
}) {
  const leftSec = useDeadlineCountdown(deadline)
  const autoSubmitRef = React.useRef(false)

  React.useEffect(() => {
    if (deadline === null || leftSec > 0) return
    if (autoSubmitRef.current) return
    autoSubmitRef.current = true
    onSubmit()
  }, [leftSec, deadline, onSubmit])

  return null
}

describe('useDeadlineCountdown(W-01/W-02 截止时间戳倒计时)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(DAY))
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('剩余秒数由截止时间戳派生,而不是按 tick 次数自减', () => {
    const deadline = Date.now() + 120_000
    const { result } = renderHook(() => useDeadlineCountdown(deadline))

    expect(result.current).toBe(120)
    act(() => {
      vi.advanceTimersByTime(5_000)
    })
    expect(result.current).toBe(115)
  })

  it('后台标签页定时器被节流时,visibilitychange 能按墙钟对表', () => {
    const deadline = Date.now() + 120_000
    const { result } = renderHook(() => useDeadlineCountdown(deadline))

    // 模拟后台:墙钟流逝 90s,但 interval 一次都没触发
    vi.setSystemTime(Date.now() + 90_000)
    expect(result.current).toBe(120) // 未对表前仍是旧值,证明不是自减模型

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(result.current).toBe(30)
  })

  it('窗口重新获得焦点时同样按墙钟对表', () => {
    const deadline = Date.now() + 120_000
    const { result } = renderHook(() => useDeadlineCountdown(deadline))

    vi.setSystemTime(Date.now() + 60_000)
    act(() => {
      window.dispatchEvent(new Event('focus'))
    })
    expect(result.current).toBe(60)
  })

  it('截止时间已过后钳到 0,不会变成负数', () => {
    const deadline = Date.now() + 1_000
    const { result } = renderHook(() => useDeadlineCountdown(deadline))

    act(() => {
      vi.advanceTimersByTime(3_000)
    })
    expect(result.current).toBe(0)
  })

  it('deadline=null(未开始/无限时长)时恒为 0', () => {
    const { result } = renderHook(() => useDeadlineCountdown(null))
    expect(result.current).toBe(0)
    act(() => {
      vi.advanceTimersByTime(10_000)
    })
    expect(result.current).toBe(0)
  })

  it('后台跨过截止再恢复:交卷发生在恢复可见的那一刻,不等下一次 tick', () => {
    const onSubmit = vi.fn()
    const deadline = Date.now() + 60_000
    render(<ExamAutoSubmitHarness deadline={deadline} onSubmit={onSubmit} />)
    expect(onSubmit).not.toHaveBeenCalled()

    // 隐藏:墙钟越过 deadline,但 interval 一次都没触发
    setVisibility('hidden')
    vi.setSystemTime(Date.now() + 70_000)
    expect(onSubmit).not.toHaveBeenCalled()

    // 恢复可见:当场对表归零并交卷(改前自减模型在这里会等到下一次 tick)
    setVisibility('visible')
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('复用同一枚 autoSubmitRef:重复的恢复事件也只交卷一次', () => {
    const onSubmit = vi.fn()
    const deadline = Date.now() + 10_000
    render(<ExamAutoSubmitHarness deadline={deadline} onSubmit={onSubmit} />)

    setVisibility('hidden')
    vi.setSystemTime(Date.now() + 20_000)
    setVisibility('visible')
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    act(() => {
      window.dispatchEvent(new Event('focus'))
    })
    act(() => {
      vi.advanceTimersByTime(5_000)
    })
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
