// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

'use client'

import { useEffect, useRef } from 'react'
import type { LiveFxRates } from '@ihui/api-client'
import { useExchangeRates } from '@/hooks/use-exchange-rates'
import {
  getActiveCurrency,
  markDisplayCurrencyHydrated,
  setFxSnapshot,
  setServerDisplayCurrency,
  type CurrencyCode,
  type DisplayCurrency,
} from '@/lib/display-currency'

/**
 * 汇率预热 + 首帧口径播种(2026-11-14 立):挂载在根布局,任意页面打开即预取实时汇率,
 * 不渲染任何 UI。
 *
 * 渲染期播种(SSR 与客户端水合首帧都执行):Next 的服务端组件层与客户端组件层是两个
 * 模块实例,根布局里 setServerDisplayCurrency/setFxSnapshot 传不到客户端组件的 SSR,
 * 只有经 props 在这里再写一次,首屏金额才能与服务端壳层一致(否则水合失败、整页事件失效)。
 * 用 ref 保证客户端只在首帧播种,后续拉到的实时汇率不会被初始值覆盖。
 *
 * 首访且目标币种非 CNY 时:SSR 手里没有汇率快照,静态金额只能回落原币种。等实时汇率
 * 到手(已写入 cookie)后整页重载一次,让服务端按快照直出;sessionStorage 记号防循环,
 * 第二次加载 initialRates 非空,直接命中不重载。
 */
export function CurrencyRuntime({
  initialCurrency = 'auto',
  initialEffective = 'CNY',
  initialRates = null,
}: {
  initialCurrency?: DisplayCurrency
  initialEffective?: CurrencyCode
  initialRates?: LiveFxRates | null
}) {
  const seededRef = useRef(false)
  if (!seededRef.current) {
    seededRef.current = true
    setServerDisplayCurrency(initialCurrency, initialEffective)
    if (initialRates) setFxSnapshot(initialRates)
  }

  const { data } = useExchangeRates()

  useEffect(() => {
    markDisplayCurrencyHydrated()
  }, [])

  useEffect(() => {
    if (!data || initialRates) return
    if (getActiveCurrency() === 'CNY') return
    try {
      if (sessionStorage.getItem('ihui-fx-reload') === '1') return
      sessionStorage.setItem('ihui-fx-reload', '1')
    } catch {
      // 隐私模式下拿不到 sessionStorage ⇒ 不做自动重载,避免刷新循环
      return
    }
    window.location.reload()
  }, [data, initialRates])

  return null
}
