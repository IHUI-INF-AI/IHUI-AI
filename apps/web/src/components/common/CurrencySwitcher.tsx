// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

'use client'

import * as React from 'react'
import { useExchangeRates } from '@/hooks/use-exchange-rates'
import {
  formatRateLine,
  getActiveCurrency,
  getSelectedCurrency,
  setSelectedCurrency,
  type CurrencyCode,
} from '@/lib/display-currency'
import { cn } from '@/lib/utils'

/**
 * 展示货币一键切换(2026-11-14 立)。
 *
 * USD / CNY / USDT 三段切换;偏好写入 localStorage + cookie(见 @/lib/display-currency)。
 * 切换后由 CurrencyRuntime 就地重挂载内容树,全站金额立即按实时汇率重算;
 * 不整页 reload —— CDN 对 HTML 有 300s 缓存,reload 反而会拿到旧币种的页面。
 *
 * 计费不受影响:平台仍以 CNY 为扣费基准,这里只换展示币种。
 */
const OPTIONS: CurrencyCode[] = ['USD', 'CNY', 'USDT']

export function CurrencySwitcher({ className }: { className?: string }) {
  // 订阅汇率查询:数据到达后触发重渲染,标题里的实时汇率与生效币种随之更新。
  // 首帧口径由根布局写入的 cookie(data-currency / data-currency-effective)播种,
  // 服务端与客户端首帧一致,不会水合错位。
  const { data } = useExchangeRates()
  const selected = getSelectedCurrency()
  const active = getActiveCurrency()
  const rateLine = formatRateLine()
  const staleHint = data?.stale ? ' · 非实时(上游不可用)' : ''
  const title = `展示货币(实际扣费以人民币结算) · ${
    selected === 'auto' ? '当前跟随浏览器语言 · ' : ''
  }${rateLine || '实时汇率加载中'}${staleHint}`

  const pick = React.useCallback((currency: CurrencyCode) => {
    if (getSelectedCurrency() === currency) return
    // 写偏好(cookie 供 SSR 下次直出);CurrencyRuntime 会立即重挂载内容树做换算
    setSelectedCurrency(currency)
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
