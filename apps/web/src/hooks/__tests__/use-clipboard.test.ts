// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useClipboard } from '../use-clipboard'

describe('useClipboard', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('初始copied为false', () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn() },
      configurable: true,
    })
    const { result } = renderHook(() => useClipboard())
    expect(result.current.copied).toBe(false)
  })

  it('使用navigator.clipboard复制成功返回true', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
    const { result } = renderHook(() => useClipboard())
    let ok = false
    await act(async () => {
      ok = await result.current.copy('hello')
    })
    expect(ok).toBe(true)
    expect(writeText).toHaveBeenCalledWith('hello')
  })

  it('复制成功后copied为true,2秒后重置为false', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
    const { result } = renderHook(() => useClipboard())
    await act(async () => {
      await result.current.copy('text')
    })
    expect(result.current.copied).toBe(true)
    act(() => vi.advanceTimersByTime(2000))
    expect(result.current.copied).toBe(false)
  })

  it('navigator.clipboard不可用时降级到execCommand', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
    })
    const execCommand = vi.fn().mockReturnValue(true)
    document.execCommand = execCommand
    const { result } = renderHook(() => useClipboard())
    let ok = false
    await act(async () => {
      ok = await result.current.copy('fallback')
    })
    expect(ok).toBe(true)
    expect(execCommand).toHaveBeenCalledWith('copy')
  })

  it('所有方法失败时返回false', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
    })
    document.execCommand = vi.fn().mockReturnValue(false)
    const { result } = renderHook(() => useClipboard())
    let ok = true
    await act(async () => {
      ok = await result.current.copy('x')
    })
    expect(ok).toBe(false)
  })
})
