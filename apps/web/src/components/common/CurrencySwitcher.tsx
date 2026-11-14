// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

'use client'

import * as React from 'react'
import { useExchangeRates } from '@/hooks/use-exchange-rates'
import {
  formatRateLine,
  getSelectedCurrency,
  markDisplayCurrencyHydrated,
  resolveEffectiveCurrency,
  setSelectedCurrency,
  type CurrencyCode,
} from '@/lib/display-currency'
import { cn } from '@/lib/utils'

/**
 * 展示货币一键切换(2026-11-14 立)。
 *
 * USD / CNY / USDT 三段切换;偏好持久化到 localStorage。切换后整页 reload:
 * 全站金额既有 SSR 直出、也有纯函数格式化,reload 是让所有展示点同时生效的
 * 最小可靠方案(见 @/lib/display-currency 头注)。
 *
 * 计费不受影响:平台仍以 CNY 为扣费基准,这里只换展示币种。
 */
const OPTIONS: CurrencyCode[] = ['USD', 'CNY', 'USDT']

export function CurrencySwitcher({ className }: { className?: string }) {
  const { data } = useExchangeRates()
  // 首帧固定按 CNY 渲染(与服务端一致);挂载后再读取本地偏好,避免水合错位
  const [selected, setSelected] = React.useState<CurrencyCode | 'auto'>('auto')
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => {
    markDisplayCurrencyHydrated()
    setSelected(getSelectedCurrency())
    setMounted(true)
  }, [])
  const active = mounted ? resolveEffectiveCurrency(selected) : 'CNY'
  const rateLine = formatRateLine()
  const staleHint = data?.stale ? ' · 非实时(上游不可用)' : ''
  const title = `展示货币(实际扣费以人民币结算) · ${
    selected === 'auto' ? '当前跟随浏览器语言 · ' : ''
  }${rateLine || '实时汇率加载中'}${staleHint}`

  const pick = React.useCallback((currency: CurrencyCode) => {
    if (getSelectedCurrency() === currency) return
    setSelectedCurrency(currency)
    // 全站展示点统一刷新(SSR 直出与纯格式化调用点都会重新取值)
    window.location.reload()
  }, [])

  return (
    <div
      role="group"
      aria-label="展示货币"
      title={title}
      className={cn(
        'flex h-8 shrink-0 items-center gap-0.5 rounded-md bg-muted/40 p-0.5',
        className,
      )}
    >
      {OPTIONS.map((code) => {
        const isActive = selected === 'auto' ? active === code : selected === code
        return (
          <button
            key={code}
            type="button"
            onClick={() => pick(code)}
            aria-pressed={isActive}
            className={cn(
              'h-7 rounded-sm px-1.5 text-[10px] font-medium tabular-nums transition-colors',
              isActive
                ? 'bg-background text-foreground shadow-elevation-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {code}
          </button>
        )
      })}
    </div>
  )
}
