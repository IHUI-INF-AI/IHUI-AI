// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDebounce, useDebouncedCallback } from '../use-debounce'

describe('useDebounce', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('初始返回原始值', () => {
    const { result } = renderHook(({ v }) => useDebounce(v, 300), {
      initialProps: { v: 'hello' },
    })
    expect(result.current).toBe('hello')
  })

  it('延迟后更新值', () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 300), {
      initialProps: { v: 'hello' },
    })
    rerender({ v: 'world' })
    expect(result.current).toBe('hello')
    act(() => vi.advanceTimersByTime(300))
    expect(result.current).toBe('world')
  })

  it('延迟时间内多次更新只取最后值', () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 300), {
      initialProps: { v: 'a' },
    })
    rerender({ v: 'b' })
    act(() => vi.advanceTimersByTime(150))
    rerender({ v: 'c' })
    act(() => vi.advanceTimersByTime(150))
    expect(result.current).toBe('a')
    act(() => vi.advanceTimersByTime(150))
    expect(result.current).toBe('c')
  })

  it('卸载时清除定时器不报错', () => {
    const { rerender, unmount } = renderHook(({ v }) => useDebounce(v, 300), {
      initialProps: { v: 'a' },
    })
    rerender({ v: 'b' })
    unmount()
    expect(() => act(() => vi.advanceTimersByTime(300))).not.toThrow()
  })
})

describe('useDebouncedCallback', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('延迟执行回调', () => {
    const cb = vi.fn()
    const { result } = renderHook(() => useDebouncedCallback(cb, 300))
    act(() => result.current('arg'))
    expect(cb).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(300))
    expect(cb).toHaveBeenCalledWith('arg')
  })

  it('多次调用只执行最后一次', () => {
    const cb = vi.fn()
    const { result } = renderHook(() => useDebouncedCallback(cb, 300))
    act(() => result.current('a'))
    act(() => vi.advanceTimersByTime(150))
    act(() => result.current('b'))
    act(() => vi.advanceTimersByTime(300))
    expect(cb).toHaveBeenCalledTimes(1)
    expect(cb).toHaveBeenCalledWith('b')
  })

  it('卸载时清除定时器,回调不执行', () => {
    const cb = vi.fn()
    const { result, unmount } = renderHook(() => useDebouncedCallback(cb, 300))
    act(() => result.current('a'))
    unmount()
    act(() => vi.advanceTimersByTime(300))
    expect(cb).not.toHaveBeenCalled()
  })

  it('delay变更后使用新延迟', () => {
    const cb = vi.fn()
    const { result, rerender } = renderHook(({ d }) => useDebouncedCallback(cb, d), {
      initialProps: { d: 300 },
    })
    rerender({ d: 100 })
    act(() => result.current('x'))
    act(() => vi.advanceTimersByTime(100))
    expect(cb).toHaveBeenCalledWith('x')
  })
})
