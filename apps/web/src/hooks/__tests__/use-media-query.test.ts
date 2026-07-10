// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useMediaQuery, useIsMobile, useIsTablet, useIsDesktop } from '../use-media-query'

/** 创建 matchMedia mock,返回 mql 及事件监听器列表 */
function mockMatchMedia(matches: boolean) {
  const listeners: ((e: MediaQueryListEvent) => void)[] = []
  const mql = {
    matches,
    addEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => listeners.push(cb),
    removeEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => {
      const i = listeners.indexOf(cb)
      if (i >= 0) listeners.splice(i, 1)
    },
  }
  vi.stubGlobal('matchMedia', vi.fn(() => mql))
  return { mql, listeners }
}

describe('useMediaQuery', () => {
  afterEach(() => vi.restoreAllMocks())

  it('matchMedia匹配时返回true', () => {
    mockMatchMedia(true)
    const { result } = renderHook(() => useMediaQuery('(min-width: 1024px)'))
    expect(result.current).toBe(true)
  })

  it('matchMedia不匹配时返回false', () => {
    mockMatchMedia(false)
    const { result } = renderHook(() => useMediaQuery('(min-width: 1024px)'))
    expect(result.current).toBe(false)
  })

  it('卸载时移除事件监听器', () => {
    const { listeners } = mockMatchMedia(true)
    const { unmount } = renderHook(() => useMediaQuery('(min-width: 1024px)'))
    expect(listeners.length).toBe(1)
    unmount()
    expect(listeners.length).toBe(0)
  })

  it('useIsMobile查询max-width:768px', () => {
    mockMatchMedia(true)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
    expect(window.matchMedia).toHaveBeenCalledWith('(max-width: 768px)')
  })

  it('useIsTablet查询769px-1024px区间', () => {
    mockMatchMedia(true)
    const { result } = renderHook(() => useIsTablet())
    expect(result.current).toBe(true)
    expect(window.matchMedia).toHaveBeenCalledWith('(min-width: 769px) and (max-width: 1024px)')
  })

  it('useIsDesktop查询min-width:1025px', () => {
    mockMatchMedia(true)
    const { result } = renderHook(() => useIsDesktop())
    expect(result.current).toBe(true)
    expect(window.matchMedia).toHaveBeenCalledWith('(min-width: 1025px)')
  })
})
