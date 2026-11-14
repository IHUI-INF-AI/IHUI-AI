// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

'use client'

import { useEffect } from 'react'
import { useExchangeRates } from '@/hooks/use-exchange-rates'
import { markDisplayCurrencyHydrated } from '@/lib/display-currency'

/**
 * 汇率预热 + 水合标记(2026-11-14 立):挂载在根布局,任意页面打开即预取实时汇率,
 * 不渲染任何 UI。水合完成前所有金额按 CNY 输出,避免 SSR/首帧币种不一致导致
 * React 水合失败(整页事件失效)。
 */
export function CurrencyRuntime() {
  useExchangeRates()
  useEffect(() => {
    markDisplayCurrencyHydrated()
  }, [])
  return null
}
