// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

'use client'

import { useExchangeRates } from '@/hooks/use-exchange-rates'

/**
 * 汇率预热(2026-11-14 立):挂载在根布局,任意页面打开即预取实时汇率,
 * 不渲染任何 UI。真正的格式化读取 @/lib/display-currency 的模块快照。
 */
export function CurrencyRuntime() {
  useExchangeRates()
  return null
}
