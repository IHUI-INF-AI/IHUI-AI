// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePagination } from '../use-pagination'

describe('usePagination', () => {
  it('初始页为1,totalPages正确计算', () => {
    const { result } = renderHook(() => usePagination({ total: 25, pageSize: 10 }))
    expect(result.current.page).toBe(1)
    expect(result.current.totalPages).toBe(3)
  })

  it('total为0时totalPages至少为1', () => {
    const { result } = renderHook(() => usePagination({ total: 0 }))
    expect(result.current.totalPages).toBe(1)
    expect(result.current.hasNext).toBe(false)
    expect(result.current.hasPrev).toBe(false)
  })

  it('setPage设置当前页', () => {
    const { result } = renderHook(() => usePagination({ total: 50, pageSize: 10 }))
    act(() => result.current.setPage(3))
    expect(result.current.page).toBe(3)
  })

  it('setPage超出上限被钳制到totalPages', () => {
    const { result } = renderHook(() => usePagination({ total: 25, pageSize: 10 }))
    act(() => result.current.setPage(99))
    expect(result.current.page).toBe(3)
  })

  it('setPage低于1被钳制到1', () => {
    const { result } = renderHook(() => usePagination({ total: 25, pageSize: 10 }))
    act(() => result.current.setPage(2))
    act(() => result.current.setPage(-1))
    expect(result.current.page).toBe(1)
  })

  it('hasNext/hasPrev正确反映边界', () => {
    const { result } = renderHook(() => usePagination({ total: 25, pageSize: 10 }))
    expect(result.current.hasPrev).toBe(false)
    expect(result.current.hasNext).toBe(true)
    act(() => result.current.setPage(3))
    expect(result.current.hasNext).toBe(false)
    expect(result.current.hasPrev).toBe(true)
  })

  it('setPageSize重置到第1页并重算totalPages', () => {
    const { result } = renderHook(() => usePagination({ total: 50, pageSize: 10 }))
    act(() => result.current.setPage(3))
    act(() => result.current.setPageSize(5))
    expect(result.current.pageSize).toBe(5)
    expect(result.current.page).toBe(1)
    expect(result.current.totalPages).toBe(10)
  })

  it('initialPage自定义初始页', () => {
    const { result } = renderHook(() => usePagination({ total: 50, initialPage: 2 }))
    expect(result.current.page).toBe(2)
  })
})
