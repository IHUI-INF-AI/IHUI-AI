// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

'use client'

import { useQuery } from '@tanstack/react-query'
import { getLiveExchangeRates } from '@ihui/api-client'
import { setFxSnapshot, writeFxSnapshotCookie } from '@/lib/display-currency'

/**
 * 实时汇率查询(2026-11-14 立)。
 *
 * 拉取 `/api/exchange-rates/live` 并写入展示层模块快照;5 分钟内复用缓存,
 * 每 10 分钟后台刷新。接口失败时返回 null —— 格式化函数会降级为原币种,
 * 不按写死汇率造假数字。
 *
 * 同时把快照写进 cookie:服务端首屏(SSR 直出的静态金额)能按同一份汇率换算,
 * 刷新/切换货币后不会回落到原币种。
 */
export function useExchangeRates() {
  return useQuery({
    queryKey: ['fx-live'],
    queryFn: async () => {
      const rates = await getLiveExchangeRates()
      setFxSnapshot(rates)
      writeFxSnapshotCookie(rates)
      return rates
    },
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
    retry: 1,
  })
}
