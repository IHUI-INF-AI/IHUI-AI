// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useLocalStorage } from '../use-local-storage'

describe('useLocalStorage', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('无存储时返回初始值', () => {
    const { result } = renderHook(() => useLocalStorage('k1', 'default'))
    expect(result.current[0]).toBe('default')
  })

  it('有存储时读取已存值', () => {
    window.localStorage.setItem('k2', JSON.stringify('stored'))
    const { result } = renderHook(() => useLocalStorage('k2', 'default'))
    expect(result.current[0]).toBe('stored')
  })

  it('setValue写入localStorage并更新状态', () => {
    const { result } = renderHook(() => useLocalStorage('k3', 0))
    act(() => result.current[1](42))
    expect(result.current[0]).toBe(42)
    expect(JSON.parse(window.localStorage.getItem('k3')!)).toBe(42)
  })

  it('setValue支持函数更新', () => {
    const { result } = renderHook(() => useLocalStorage('k4', 10))
    act(() => result.current[1]((prev) => prev + 5))
    expect(result.current[0]).toBe(15)
    expect(JSON.parse(window.localStorage.getItem('k4')!)).toBe(15)
  })

  it('remove清除localStorage并重置为初始值', () => {
    window.localStorage.setItem('k5', JSON.stringify('data'))
    const { result } = renderHook(() => useLocalStorage('k5', 'init'))
    act(() => result.current[2]())
    expect(result.current[0]).toBe('init')
    expect(window.localStorage.getItem('k5')).toBeNull()
  })

  it('损坏的JSON回退到初始值', () => {
    window.localStorage.setItem('k6', '{broken')
    const { result } = renderHook(() => useLocalStorage('k6', 'fallback'))
    expect(result.current[0]).toBe('fallback')
  })

  it('SSR安全:typeof window检查不抛错', () => {
    // jsdom环境下window存在,验证读取路径正常执行即可
    const { result } = renderHook(() => useLocalStorage('k7', { a: 1 }))
    expect(result.current[0]).toEqual({ a: 1 })
  })
})
