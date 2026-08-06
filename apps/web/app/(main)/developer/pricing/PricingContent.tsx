'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import { Coins, Loader2, Search, Database, Tag } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, Input, Button } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import { cn } from '@/lib/utils'
import { BackButton } from '@/components/common'

import { BillingRules } from './BillingRules'
import { CodeExamples } from './CodeExamples'

interface RegionPricing {
  cn?: number | null
  us?: number | null
  eu?: number | null
}

interface AiPricingItem {
  id: string
  modelId: string
  inputPrice: number
  outputPrice: number
  regionPricing: RegionPricing
  discount?: number | null
  currency: 'CNY' | 'USD'
  effectiveAt?: string | null
  vendor: string
  vendorLabel: string
}

interface AiPricingListResponse {
  items: AiPricingItem[]
  total: number
  page: number
  pageSize: number
}

interface AiPricingStats {
  total: number
  vendors: Array<{ vendor: string; label: string; count: number }>
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const CURRENCY_SYMBOL: Record<string, string> = {
  CNY: '¥',
  USD: '$',
}

// 分/千 token → 元/百万 token: 乘以 10(对齐 models-pricing 折算规则)
const formatPrice = (centsPerKToken: number): string => {
  const yuan = centsPerKToken * 10
  return yuan.toLocaleString('zh-CN', { maximumFractionDigits: 4 })
}

export function PricingContent(): React.JSX.Element {
  const t = useTranslations('developerPricingPage')
  const locale = useLocale()
  const numFmt = new Intl.NumberFormat(locale)
  const [keyword, setKeyword] = React.useState('')
  const [activeVendor, setActiveVendor] = React.useState<string>('all')

  const listQ = useQuery({
    queryKey: ['ai-pricing', 'list', activeVendor, keyword],
    queryFn: () => {
      const params = new URLSearchParams()
      params.set('pageSize', '200')
      if (activeVendor && activeVendor !== 'all') params.set('vendor', activeVendor)
      return api<AiPricingListResponse>(`/api/ai-pricing?${params.toString()}`)
    },
  })

  const statsQ = useQuery({
    queryKey: ['ai-pricing', 'stats'],
    queryFn: () => api<AiPricingStats>('/api/ai-pricing/stats'),
  })

  const vendors = statsQ.data?.vendors ?? []
  const total = statsQ.data?.total ?? 0

  // 前端二次过滤(精确匹配 + 关键词)
  const filtered = React.useMemo(() => {
    const allItems = listQ.data?.items ?? []
    const kw = keyword.trim().toLowerCase()
    if (!kw) return allItems
    return allItems.filter((p) => p.modelId.toLowerCase().includes(kw))
  }, [listQ.data, keyword])

  // 按厂商分组
  const grouped = React.useMemo(() => {
    const map = new Map<string, AiPricingItem[]>()
    for (const item of filtered) {
      const key = item.vendorLabel
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(item)
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [filtered])

  return (
    <div className="space-y-4">
      <BackButton />
      {/* Hero */}
      <div className="rounded-lg border bg-card p-5">
        <div className="flex flex-col gap-3 min-[640px]:flex-row min-[640px]:items-center min-[640px]:justify-between">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
              <Coins className="h-5 w-5 text-primary" />
              {t('title')}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">{t('subtitle')}</p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Database className="h-3.5 w-3.5" />
              <span>{t('modelCount', { count: numFmt.format(total) })}</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Tag className="h-3.5 w-3.5" />
              <span>{t('vendorCount', { count: numFmt.format(vendors.length) })}</span>
            </div>
          </div>
        </div>
      </div>

      {(listQ.error || statsQ.error) && (
        <Alert variant="danger" description={((listQ.error || statsQ.error) as Error).message} />
      )}

      {/* 搜索 + 厂商 Tab */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant={activeVendor === 'all' ? 'default' : 'outline'}
            onClick={() => setActiveVendor('all')}
            className="h-7"
          >
            {t('vendorAll')}
            <span className="ml-1.5 text-xs opacity-70">{numFmt.format(total)}</span>
          </Button>
          {vendors.slice(0, 24).map((v) => (
            <Button
              key={v.vendor}
              size="sm"
              variant={activeVendor === v.vendor ? 'default' : 'outline'}
              onClick={() => setActiveVendor(v.vendor)}
              className="h-7"
            >
              {v.label}
              <span className="ml-1.5 text-xs opacity-70">{numFmt.format(v.count)}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* 定价表 */}
      {listQ.isLoading || statsQ.isLoading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {t('loading')}
        </div>
      ) : grouped.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t('noResults')}</p>
      ) : (
        <div className="space-y-3">
          {grouped.map(([vendor, items]) => (
            <Card key={vendor}>
              <CardHeader className="px-4 py-2.5 pb-2">
                <CardTitle className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate">{vendor}</span>
                  <span className="shrink-0 whitespace-nowrap text-xs font-normal text-muted-foreground tabular-nums">
                    {t('itemsCount', { count: items.length })}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40">
                      <tr className="text-left">
                        <th className="px-3 py-1.5 font-medium">{t('colModel')}</th>
                        <th className="px-3 py-1.5 text-right font-medium">{t('colInput')}</th>
                        <th className="px-3 py-1.5 text-right font-medium">{t('colOutput')}</th>
                        <th className="px-3 py-1.5 font-medium">{t('colCurrency')}</th>
                        <th className="px-3 py-1.5 font-medium">{t('colRegion')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((p) => {
                        const sym = CURRENCY_SYMBOL[p.currency] ?? p.currency
                        const regions = [
                          p.regionPricing?.cn !== null &&
                            p.regionPricing?.cn !== undefined &&
                            `CN ${p.regionPricing.cn}`,
                          p.regionPricing?.us !== null &&
                            p.regionPricing?.us !== undefined &&
                            `US ${p.regionPricing.us}`,
                          p.regionPricing?.eu !== null &&
                            p.regionPricing?.eu !== undefined &&
                            `EU ${p.regionPricing.eu}`,
                        ]
                          .filter(Boolean)
                          .join(' / ')
                        return (
                          <tr key={p.id} className={cn('transition-colors hover:bg-muted/30')}>
                            <td className="px-3 py-1.5 font-mono">{p.modelId}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums">
                              {sym}
                              {formatPrice(p.inputPrice)}
                            </td>
                            <td className="px-3 py-1.5 text-right tabular-nums">
                              {sym}
                              {formatPrice(p.outputPrice)}
                            </td>
                            <td className="px-3 py-1.5 text-muted-foreground">{p.currency}</td>
                            <td className="px-3 py-1.5 text-xs text-muted-foreground">
                              {regions || '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 按量计费规则说明 */}
      <BillingRules />

      {/* 调用示例 */}
      <CodeExamples />
    </div>
  )
}
