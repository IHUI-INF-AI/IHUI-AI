// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCountdown } from '../use-countdown'

describe('useCountdown', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('初始count为传入秒数,未运行', () => {
    const { result } = renderHook(() => useCountdown(10))
    expect(result.current.count).toBe(10)
    expect(result.current.isRunning).toBe(false)
  })

  it('start开始倒计时,每秒递减', () => {
    const { result } = renderHook(() => useCountdown(5))
    act(() => result.current.start())
    expect(result.current.isRunning).toBe(true)
    act(() => vi.advanceTimersByTime(1000))
    expect(result.current.count).toBe(4)
    act(() => vi.advanceTimersByTime(1000))
    expect(result.current.count).toBe(3)
  })

  it('pause暂停倒计时,停止递减', () => {
    const { result } = renderHook(() => useCountdown(5))
    act(() => result.current.start())
    act(() => vi.advanceTimersByTime(2000))
    act(() => result.current.pause())
    expect(result.current.isRunning).toBe(false)
    expect(result.current.count).toBe(3)
    act(() => vi.advanceTimersByTime(5000))
    expect(result.current.count).toBe(3)
  })

  it('reset重置到初始秒数并停止', () => {
    const { result } = renderHook(() => useCountdown(10))
    act(() => result.current.start())
    act(() => vi.advanceTimersByTime(3000))
    act(() => result.current.reset())
    expect(result.current.count).toBe(10)
    expect(result.current.isRunning).toBe(false)
  })

  it('reset接受自定义秒数', () => {
    const { result } = renderHook(() => useCountdown(10))
    act(() => result.current.reset(30))
    expect(result.current.count).toBe(30)
  })

  it('倒计时到0自动停止', () => {
    const { result } = renderHook(() => useCountdown(3))
    act(() => result.current.start())
    act(() => vi.advanceTimersByTime(3000))
    expect(result.current.count).toBe(0)
    expect(result.current.isRunning).toBe(false)
  })

  it('倒计时到0后不再递减为负数', () => {
    const { result } = renderHook(() => useCountdown(2))
    act(() => result.current.start())
    act(() => vi.advanceTimersByTime(5000))
    expect(result.current.count).toBe(0)
  })
})
