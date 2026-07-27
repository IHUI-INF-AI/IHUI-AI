'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Search, Loader2, AlertCircle, Sparkles, Database, TrendingUp } from 'lucide-react'
import { Card, CardContent, Input } from '@ihui/ui-react'
import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'

// =============================================================================
// 类型定义(与后端 /api/ai-pricing 响应对齐)
// =============================================================================

interface AiPricingItem {
  id: string
  modelId: string
  // 后端用别名 inputPrice/outputPrice(去掉 "Token" 子串,避免 response-sanitizer 脱敏)
  inputPrice: number
  outputPrice: number
  regionPricing: { cn: number; us?: number; eu?: number }
  discount: { type: 'percentage'; value: number; minTokens: number } | null
  currency: string
  effectiveAt: string
  vendor: string
  vendorLabel: string
}

// API 原始响应类型(数值字段可能偶发为 string,前端兜底转换)
interface AiPricingItemRaw {
  id: string
  modelId: string
  inputPrice: number | string
  outputPrice: number | string
  regionPricing: { cn: number; us?: number; eu?: number }
  discount: { type: 'percentage'; value: number; minTokens: number } | null
  currency: string
  effectiveAt: string
  vendor: string
  vendorLabel: string
}

interface AiPricingListResponse {
  items: AiPricingItemRaw[]
  total: number
  page?: number
  pageSize?: number
}

interface VendorStat {
  vendor: string
  label: string
  count: number
}

interface AiPricingStatsResponse {
  total: number
  vendors: VendorStat[]
}

// =============================================================================
// 价格格式化
// =============================================================================
//
// 数据库存的是"元/百万 token"(CNY per 1M tokens,整数)。
// 注:packages/database/src/schema/billing.ts 注释写的是"分/千 token",
// 但 seed 数据(ai-pricing-seed.ts)实际存的是"元/百万 token"
// (例:gpt-4o in=18 对应 $2.5/1M × 7.2 = ¥18/1M)。
// 此处按 seed 数据实际语义展示,与 OpenAI/Anthropic 官方价格表口径一致。

const CNY_PER_USD = 7.2

function formatCNY(yuan: number): string {
  if (yuan === 0) return '免费'
  if (yuan < 1) return `¥${yuan.toFixed(3)}`
  return `¥${yuan.toFixed(2)}`
}

function formatUSD(yuan: number): string {
  if (yuan === 0) return '免费'
  const usd = yuan / CNY_PER_USD
  if (usd < 1) return `$${usd.toFixed(3)}`
  return `$${usd.toFixed(2)}`
}

// =============================================================================
// API 请求
// =============================================================================

async function fetchAllPricing(): Promise<AiPricingItem[]> {
  const r = await fetchApi<AiPricingListResponse>(
    '/api/ai-pricing?pageSize=200&page=1',
  )
  if (!r.success || !r.data?.items) {
    throw new Error(r.error ?? '加载模型价格失败')
  }
  // 强制 number 类型(API 偶发返回 string,前端兜底转换)
  return r.data.items.map((i) => ({
    ...i,
    inputPrice: Number(i.inputPrice),
    outputPrice: Number(i.outputPrice),
  }))
}

async function fetchStats(): Promise<AiPricingStatsResponse> {
  const r = await fetchApi<AiPricingStatsResponse>('/api/ai-pricing/stats')
  if (!r.success || !r.data) {
    throw new Error(r.error ?? '加载统计失败')
  }
  return r.data
}

// =============================================================================
// 主组件
// =============================================================================

export function ModelsPricingContent(): React.JSX.Element {
  const t = useTranslations('modelsPricingPage')

  const { data: items, isLoading, error } = useQuery({
    queryKey: ['ai-pricing-all'],
    queryFn: fetchAllPricing,
  })
  const { data: stats } = useQuery({
    queryKey: ['ai-pricing-stats'],
    queryFn: fetchStats,
  })

  const [search, setSearch] = React.useState('')
  const [activeVendor, setActiveVendor] = React.useState<string>('all')

  // 客户端过滤(176 条数据量小,无需服务端分页)
  const filtered = React.useMemo(() => {
    if (!items) return []
    const lower = search.trim().toLowerCase()
    return items.filter((item) => {
      if (activeVendor !== 'all' && item.vendor !== activeVendor) return false
      if (lower && !item.modelId.toLowerCase().includes(lower)) return false
      return true
    })
  }, [items, search, activeVendor])

  // 按厂商分组
  const grouped = React.useMemo(() => {
    const map = new Map<string, { label: string; items: AiPricingItem[] }>()
    for (const item of filtered) {
      const existing = map.get(item.vendor)
      if (existing) {
        existing.items.push(item)
      } else {
        map.set(item.vendor, { label: item.vendorLabel, items: [item] })
      }
    }
    return [...map.entries()].map(([vendor, { label, items }]) => ({
      vendor,
      label,
      items: items.sort((a, b) => a.inputPrice - b.inputPrice),
    }))
  }, [filtered])

  // 统计:最便宜/最贵/平均
  const aggregate = React.useMemo(() => {
    if (!items || items.length === 0) return null
    const priced = items.filter((i) => i.inputPrice > 0)
    if (priced.length === 0) return null
    const cheapest = priced.reduce((min, i) => (i.inputPrice < min.inputPrice ? i : min))
    const expensive = priced.reduce((max, i) => (i.inputPrice > max.inputPrice ? i : max))
    const avg = priced.reduce((s, i) => s + i.inputPrice, 0) / priced.length
    return { cheapest, expensive, avg }
  }, [items])

  const vendorList = stats?.vendors ?? []

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 md:px-8 md:py-14">
      {/* Hero */}
      <section className="space-y-3 text-center">
        <div className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          {t('hero.badge')}
        </div>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{t('hero.title')}</h1>
        <p className="mx-auto max-w-2xl text-sm text-muted-foreground md:text-base">
          {t('hero.subtitle')}
        </p>
      </section>

      {/* 统计卡片 */}
      <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Database className="h-4 w-4 text-primary" />}
          label={t('stats.totalModels')}
          value={stats?.total?.toString() ?? '—'}
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4 text-emerald-500" />}
          label={t('stats.totalVendors')}
          value={vendorList.length.toString()}
        />
        <StatCard
          icon={<span className="text-xs text-emerald-600 dark:text-emerald-400">↓</span>}
          label={t('stats.cheapest')}
          value={aggregate ? `${aggregate.cheapest.modelId} · ${formatCNY(aggregate.cheapest.inputPrice)}` : '—'}
        />
        <StatCard
          icon={<span className="text-xs text-rose-600 dark:text-rose-400">↑</span>}
          label={t('stats.mostExpensive')}
          value={aggregate ? `${aggregate.expensive.modelId} · ${formatCNY(aggregate.expensive.inputPrice)}` : '—'}
        />
      </section>

      {/* 搜索框 */}
      <section className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder={t('search.placeholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="text-xs text-muted-foreground sm:text-right">
          {t('search.resultCount', { count: filtered.length })}
        </div>
      </section>

      {/* 厂商 Tab */}
      <section className="mt-4 flex flex-wrap gap-1.5">
        <VendorTab
          active={activeVendor === 'all'}
          onClick={() => setActiveVendor('all')}
          label={t('vendor.all')}
          count={items?.length ?? 0}
        />
        {vendorList.map((v) => (
          <VendorTab
            key={v.vendor}
            active={activeVendor === v.vendor}
            onClick={() => setActiveVendor(v.vendor)}
            label={v.label}
            count={v.count}
          />
        ))}
      </section>

      {/* 价格表 */}
      <section className="mt-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {t('loading')}
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {(error as Error).message}
          </div>
        ) : grouped.length === 0 ? (
          <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
            {t('empty')}
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map((group) => (
              <PricingGroup key={group.vendor} label={group.label} items={group.items} />
            ))}
          </div>
        )}
      </section>

      {/* 说明 */}
      <section className="mt-10 rounded-md border bg-muted/30 p-4 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">{t('note.title')}</p>
        <ul className="mt-2 space-y-1">
          <li>{t('note.unit')}</li>
          <li>{t('note.region')}</li>
          <li>{t('note.discount')}</li>
          <li>{t('note.update')}</li>
        </ul>
      </section>
    </main>
  )
}

// =============================================================================
// 子组件
// =============================================================================

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }): React.JSX.Element {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">{icon}</div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          <p className="truncate text-sm font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function VendorTab({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean
  onClick: () => void
  label: string
  count: number
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-md px-3 py-1 text-xs transition-colors',
        active
          ? 'bg-primary text-primary-foreground'
          : 'border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      {label}
      <span className={cn('ml-1', active ? 'text-primary-foreground/80' : 'text-muted-foreground/60')}>
        {count}
      </span>
    </button>
  )
}

function PricingGroup({
  label,
  items,
}: {
  label: string
  items: AiPricingItem[]
}): React.JSX.Element {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2.5">
          <h3 className="text-sm font-semibold">{label}</h3>
          <span className="text-xs text-muted-foreground">{items.length} 个模型</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">模型 ID</th>
                <th className="px-4 py-2 text-right font-medium">输入价格</th>
                <th className="px-4 py-2 text-right font-medium">输出价格</th>
                <th className="px-4 py-2 text-right font-medium">USD 等价(输入)</th>
                <th className="px-4 py-2 text-center font-medium">区域系数</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <span className="font-mono text-xs">{item.modelId}</span>
                    {item.discount && (
                      <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                        -{Math.round((1 - item.discount.value) * 100)}%
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium">
                    {formatCNY(item.inputPrice)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium">
                    {formatCNY(item.outputPrice)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">
                    {formatUSD(item.inputPrice)}
                  </td>
                  <td className="px-4 py-2.5 text-center text-xs text-muted-foreground">
                    {item.regionPricing.us && item.regionPricing.us !== 1.0 ? (
                      <span>US ×{item.regionPricing.us}</span>
                    ) : (
                      <span>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
