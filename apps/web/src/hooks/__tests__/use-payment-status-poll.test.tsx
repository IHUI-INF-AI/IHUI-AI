// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { usePaymentStatusPoll } from '../use-payment-status-poll'

function setVisibility(value: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => value })
}

async function flush() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

async function tick(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms)
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('支付状态轮询(W-06 无界 setInterval 收口)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setVisibility('visible')
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('首次立即轮询,之后按 3s 链式继续', async () => {
    const fetcher = vi.fn(async () => ({ status: 'pending' }))
    const { result } = renderHook(() =>
      usePaymentStatusPoll({ enabled: true, orderNo: 'NO-1', fetcher, onSettled: () => {} }),
    )
    await flush()
    expect(fetcher).toHaveBeenCalledTimes(1)
    await tick(3000)
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(result.current.exhausted).toBe(false)
  })

  it('in-flight 闸门:慢响应期间不会并发叠加请求', async () => {
    let resolve!: (v: { status: string }) => void
    const fetcher = vi.fn(
      () => new Promise<{ status: string }>((r) => { resolve = r }),
    )
    renderHook(() =>
      usePaymentStatusPoll({ enabled: true, orderNo: 'NO-1', fetcher, onSettled: () => {} }),
    )
    await flush()
    expect(fetcher).toHaveBeenCalledTimes(1)
    await tick(10_000)
    expect(fetcher).toHaveBeenCalledTimes(1)
    await act(async () => {
      resolve({ status: 'pending' })
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
    await tick(3000)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('支付成功后回调只触发一次并停止轮询', async () => {
    const onSettled = vi.fn()
    const fetcher = vi.fn(async () => ({ status: 'paid' }))
    renderHook(() =>
      usePaymentStatusPoll({ enabled: true, orderNo: 'NO-1', fetcher, onSettled }),
    )
    await flush()
    expect(onSettled).toHaveBeenCalledTimes(1)
    expect(onSettled).toHaveBeenCalledWith('paid')
    await tick(30_000)
    expect(onSettled).toHaveBeenCalledTimes(1)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('失败按指数退避:3s 不重试,6s 后才重试', async () => {
    const fetcher = vi.fn(async () => {
      throw new Error('network')
    })
    renderHook(() =>
      usePaymentStatusPoll({ enabled: true, orderNo: 'NO-1', fetcher, onSettled: () => {} }),
    )
    await flush()
    expect(fetcher).toHaveBeenCalledTimes(1)
    await tick(3000)
    expect(fetcher).toHaveBeenCalledTimes(1)
    await tick(3000)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('后台标签页暂停轮询,重新可见立即补一次', async () => {
    const fetcher = vi.fn(async () => ({ status: 'pending' }))
    renderHook(() =>
      usePaymentStatusPoll({ enabled: true, orderNo: 'NO-1', fetcher, onSettled: () => {} }),
    )
    await flush()
    expect(fetcher).toHaveBeenCalledTimes(1)

    setVisibility('hidden')
    await tick(10_000)
    expect(fetcher).toHaveBeenCalledTimes(1)

    setVisibility('visible')
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
      vi.advanceTimersByTime(0)
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('达到次数上限后停止并暴露 exhausted 供页面提示', async () => {
    const fetcher = vi.fn(async () => ({ status: 'pending' }))
    const { result } = renderHook(() =>
      usePaymentStatusPoll({
        enabled: true,
        orderNo: 'NO-1',
        fetcher,
        onSettled: () => {},
        maxAttempts: 2,
      }),
    )
    await flush()
    await tick(3000)
    expect(result.current.exhausted).toBe(true)
    await tick(30_000)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
