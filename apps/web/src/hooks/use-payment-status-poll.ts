// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

'use client'

import * as React from 'react'

/**
 * 支付状态轮询提示(W-06,2026-11-08)。
 *
 * 旧实现 `setInterval(poll, 3000)`:
 * - 没有 in-flight 闸门:后端一次慢响应会叠出多路并发请求;
 * - 没有上限:用户离开后仍无限轮询,页面常驻也不收敛;
 * - 失败不 backoff:接口抖动时按 3s 硬打;
 * - 后台标签页不停:节流下既浪费也可能被浏览器直接挂起成「假死」。
 *
 * 新实现:setTimeout 链 + in-flight 闸门 + 指数退避(封顶 8 个间隔)+ 次数上限;
 * 页面不可见时暂停,重新可见立即补一次;耗尽后由调用方展示可见提示。
 */

export interface PaymentPollResult {
  status?: string
  paid?: boolean
}

export interface UsePaymentStatusPollOptions {
  enabled: boolean
  orderNo: string
  fetcher: (orderNo: string) => Promise<PaymentPollResult | null>
  onSettled: (state: 'paid' | 'failed' | 'cancelled') => void
  intervalMs?: number
  maxAttempts?: number
}

export interface PaymentPollState {
  /** 达到次数上限后停止轮询;调用方应展示「自动刷新已停止」提示 */
  exhausted: boolean
}

export function usePaymentStatusPoll({
  enabled,
  orderNo,
  fetcher,
  onSettled,
  intervalMs = 3000,
  maxAttempts = 100,
}: UsePaymentStatusPollOptions): PaymentPollState {
  const [exhausted, setExhausted] = React.useState(false)
  const fetcherRef = React.useRef(fetcher)
  fetcherRef.current = fetcher
  const onSettledRef = React.useRef(onSettled)
  onSettledRef.current = onSettled

  React.useEffect(() => {
    if (!enabled || !orderNo) return
    setExhausted(false)

    let cancelled = false
    let inFlight = false
    let settled = false
    let attempts = 0
    let failures = 0
    let timer: ReturnType<typeof setTimeout> | null = null

    const clear = () => {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
    }

    const schedule = (ms: number) => {
      clear()
      if (!cancelled && !settled) timer = setTimeout(() => void run(), ms)
    }

    const backoff = () => Math.min(intervalMs * 2 ** failures, intervalMs * 8)

    const run = async () => {
      if (cancelled || settled || inFlight) return
      // 后台标签页不空转;visibilitychange 恢复时再补一次
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return

      inFlight = true
      attempts += 1
      let ok = true
      try {
        const result = await fetcherRef.current(orderNo)
        if (cancelled || settled) return
        if (result) {
          const status = (result.status ?? '').toLowerCase()
          if (result.paid || status === 'paid' || status === 'completed') {
            settled = true
            onSettledRef.current('paid')
            return
          }
          if (status === 'failed' || status === 'cancelled') {
            settled = true
            onSettledRef.current(status)
            return
          }
        }
      } catch {
        ok = false
      } finally {
        inFlight = false
      }

      if (cancelled || settled) return
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      if (attempts >= maxAttempts) {
        setExhausted(true)
        return
      }
      failures = ok ? 0 : failures + 1
      schedule(backoff())
    }

    const onVisibilityChange = () => {
      if (cancelled || settled) return
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        schedule(0)
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    void run()

    return () => {
      cancelled = true
      clear()
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
    // fetcher/onSettled 只通过 ref 读取:调用方传内联函数时不应重启轮询
  }, [enabled, orderNo, intervalMs, maxAttempts])

  return { exhausted }
}
