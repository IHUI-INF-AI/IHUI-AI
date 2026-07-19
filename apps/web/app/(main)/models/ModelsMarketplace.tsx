'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Search, Sparkles, Cpu, Zap, ArrowRight } from 'lucide-react'

import { Button, Card } from '@ihui/ui'
import { BrandIcon } from '@/components/ai/brand-icon'
import { cn } from '@/lib/utils'
import type { Model } from './types'

interface Props {
  list: Model[]
}

/**
 * 模型市场客户端组件:搜索 + 卡片网格
 * 参考 yunwu.ai/pricing 卡片样式
 */
export function ModelsMarketplace({ list }: Props) {
  const t = useTranslations('models')
  const [query, setQuery] = React.useState('')
  const [capability, setCapability] = React.useState<string>('all')

  // 收集所有能力标签
  const allCapabilities = React.useMemo(() => {
    const set = new Set<string>()
    list.forEach((m) => m.features.forEach((f) => set.add(f)))
    return ['all', ...Array.from(set).sort()]
  }, [list])

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return list.filter((m) => {
      const matchQuery =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        m.provider.toLowerCase().includes(q) ||
        t(`providers.${m.provider}`).toLowerCase().includes(q)
      const matchCap = capability === 'all' || m.features.includes(capability)
      return matchQuery && matchCap
    })
  }, [list, query, capability, t])

  return (
    <div className="space-y-4">
      {/* 搜索 + 筛选 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('market.searchPlaceholder')}
            className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm text-foreground transition-colors placeholder:text-muted-foreground/70 focus:border-border focus:outline-none focus:ring-2 focus:ring-ring/20 dark:bg-input/30"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {allCapabilities.slice(0, 8).map((cap) => {
            const active = capability === cap
            const label = cap === 'all' ? t('market.allCapabilities') : cap
            return (
              <button
                key={cap}
                type="button"
                onClick={() => setCapability(cap)}
                className={cn(
                  'h-8 rounded-full border px-3 text-xs font-medium transition-colors',
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* 结果统计 */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{t('market.resultCount', { count: filtered.length, total: list.length })}</span>
      </div>

      {/* 卡片网格 */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 py-16 text-center">
          <Search className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">{t('market.empty')}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((m) => {
            const outputPrice = m.outputPrice ?? m.inputPrice * 3
            const vendorLabel = t(`providers.${m.provider}`)
            return (
              <Card
                key={m.id}
                className="group flex flex-col gap-3 p-4 transition-all hover:border-primary/40 hover:shadow-md"
              >
                {/* 头部:厂商图标 + 模型名 + 厂商标签 */}
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                    <BrandIcon vendor={m.provider} size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold leading-tight">
                      {m.name.startsWith('model.') ? t(m.name) : m.name}
                    </h3>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{vendorLabel}</p>
                  </div>
                </div>

                {/* 描述 */}
                <p className="line-clamp-2 min-h-[2.5rem] text-xs text-muted-foreground">
                  {m.description ? t(m.description) : t('market.defaultDescription')}
                </p>

                {/* 元信息 */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-md bg-muted/50 px-2 py-1.5">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Cpu className="h-3 w-3" />
                      <span>{t('contextLength')}</span>
                    </div>
                    <div className="mt-0.5 truncate font-medium text-foreground">
                      {formatContext(m.contextLength)}
                    </div>
                  </div>
                  <div className="rounded-md bg-muted/50 px-2 py-1.5">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Zap className="h-3 w-3" />
                      <span>{t('market.inputPrice')}</span>
                    </div>
                    <div className="mt-0.5 truncate font-medium text-foreground">
                      {m.inputPrice === 0 ? t('free') : `$${m.inputPrice.toFixed(2)}`}
                    </div>
                  </div>
                </div>

                {/* 输出价 */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{t('market.outputPrice')}</span>
                  <span className="font-medium text-foreground">
                    {outputPrice === 0 ? t('free') : `$${outputPrice.toFixed(2)}`}
                    <span className="ml-1 text-muted-foreground">{t('perMillion')}</span>
                  </span>
                </div>

                {/* 能力标签 */}
                <div className="flex flex-wrap gap-1">
                  {m.features.slice(0, 4).map((f) => (
                    <span
                      key={f}
                      className="rounded-full bg-primary/8 px-2 py-0.5 text-[10px] font-medium text-primary"
                    >
                      {f}
                    </span>
                  ))}
                </div>

                {/* 立即体验按钮 */}
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-auto h-8 w-full gap-1.5 text-xs"
                  asChild
                >
                  <a href={`/chat?model=${encodeURIComponent(m.id)}`}>
                    <Sparkles className="h-3.5 w-3.5" />
                    {t('market.tryNow')}
                    <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                  </a>
                </Button>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function formatContext(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${Math.round(n / 1000)}K`
  return String(n)
}
