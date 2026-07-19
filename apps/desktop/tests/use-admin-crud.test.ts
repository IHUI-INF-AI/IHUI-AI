import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useAdminCrud } from '../src/hooks/use-admin-crud'

interface Params {
  q: string
  page: number
}

interface Row {
  id: string
  name: string
}

const fetcher = vi.fn()

beforeEach(() => {
  fetcher.mockReset()
  fetcher.mockResolvedValue({ list: [{ id: '1', name: 'a' }], total: 1 })
})

describe('useAdminCrud', () => {
  it('loads rows on mount and exposes them', async () => {
    const { result } = renderHook(() =>
      useAdminCrud<Params, Row>({ fetcher, params: { q: 'foo', page: 1 } }),
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.rows).toEqual([{ id: '1', name: 'a' }])
    expect(result.current.total).toBe(1)
    expect(fetcher).toHaveBeenCalledWith({ q: 'foo', page: 1 })
  })

  it('refetches when params change', async () => {
    const { result, rerender } = renderHook(
      ({ q, page }: Params) => useAdminCrud<Params, Row>({ fetcher, params: { q, page } }),
      { initialProps: { q: 'foo', page: 1 } },
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(fetcher).toHaveBeenCalledTimes(1)
    rerender({ q: 'foo', page: 2 })
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))
    expect(fetcher).toHaveBeenLastCalledWith({ q: 'foo', page: 2 })
  })

  it('mutate runs the action and refreshes', async () => {
    const { result } = renderHook(() =>
      useAdminCrud<Params, Row>({ fetcher, params: { q: '', page: 1 } }),
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    fetcher.mockClear()
    fetcher.mockResolvedValue({ list: [{ id: '2', name: 'b' }], total: 1 })
    await act(async () => {
      await result.current.mutate(async () => 'ok')
    })
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(result.current.rows).toEqual([{ id: '2', name: 'b' }])
  })

  it('mutate sets error and rethrows on failure', async () => {
    const { result } = renderHook(() =>
      useAdminCrud<Params, Row>({ fetcher, params: { q: '', page: 1 } }),
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      try {
        await result.current.mutate(async () => {
          throw new Error('boom')
        })
      } catch {
        // expected
      }
    })
    expect(result.current.error).toBe('boom')
  })

  it('reload re-invokes the fetcher with current params', async () => {
    const { result } = renderHook(() =>
      useAdminCrud<Params, Row>({ fetcher, params: { q: 'abc', page: 3 } }),
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    fetcher.mockClear()
    act(() => {
      result.current.reload()
    })
    expect(fetcher).toHaveBeenCalledWith({ q: 'abc', page: 3 })
  })
})
