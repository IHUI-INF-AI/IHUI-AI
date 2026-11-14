// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

'use client'

import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import type { LiveFxRates } from '@ihui/api-client'
import { useExchangeRates } from '@/hooks/use-exchange-rates'
import {
  getActiveCurrency,
  markDisplayCurrencyHydrated,
  setFxSnapshot,
  setServerDisplayCurrency,
  subscribeDisplayCurrency,
  type CurrencyCode,
  type DisplayCurrency,
} from '@/lib/display-currency'

/**
 * 汇率预热 + 首帧口径播种 + 货币切换重算(2026-11-14 立):包裹在 GlobalShell 外层,
 * 不渲染任何可见 UI。
 *
 * 1) 渲染期播种(SSR 与客户端水合首帧都执行):Next 的服务端组件层与客户端组件层是两个
 *    模块实例,根布局里 setServerDisplayCurrency/setFxSnapshot 传不到客户端组件的 SSR,
 *    只有经 props 在这里再写一次,首屏金额才能与服务端壳层一致(否则水合失败、整页事件失效)。
 *    用 ref 保证客户端只在首帧播种,后续拉到的实时汇率不会被初始值覆盖。
 * 2) 水合后对账:SSR 首屏可能来自 CDN 缓存(或 en 浏览器按语言解析),与本地偏好不同时
 *    重挂载内容树,让金额立即按所选币种重算。
 * 3) 货币切换/汇率首次到达时,以 key 重挂载内容树就地重算全站金额 —— 不再整页 reload
 *    (整页 reload 会命中 CDN 上的旧 HTML,反而看不到换算结果)。
 */
export function CurrencyRuntime({
  initialCurrency = 'auto',
  initialEffective = 'CNY',
  initialRates = null,
  children,
}: {
  initialCurrency?: DisplayCurrency
  initialEffective?: CurrencyCode
  initialRates?: LiveFxRates | null
  children?: ReactNode
}) {
  const seededRef = useRef(false)
  if (!seededRef.current) {
    seededRef.current = true
    setServerDisplayCurrency(initialCurrency, initialEffective)
    if (initialRates) setFxSnapshot(initialRates)
  }

  useExchangeRates()

  const [epoch, setEpoch] = useState(0)
  useEffect(() => {
    // 对账:水合前(SSR 口径)与水合后(本地偏好/浏览器语言)不一致 ⇒ 立即重算一次
    const before = getActiveCurrency()
    markDisplayCurrencyHydrated()
    if (getActiveCurrency() !== before) setEpoch((n) => n + 1)
    return subscribeDisplayCurrency(() => setEpoch((n) => n + 1))
  }, [])

  return <Fragment key={epoch}>{children}</Fragment>
}
