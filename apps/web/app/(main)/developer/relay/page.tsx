'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import Link from 'next/link'
import { Zap, Key, Activity, Coins, TrendingUp, Loader2, ArrowRight, Bot } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { Card, CardContent, Button } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import { cn } from '@/lib/utils'

interface RelayKey {
  id: string
  name: string
  key: string
  permissions: string[]
  status: string
  rateLimit: number
  tokenBalance: number
  costBalanceCents: number
  tokenUsedTotal: number
  costUsedTotalCents: number
  lastUsedAt: string | null
  createdAt: string
  updatedAt: string
}

interface UsageSummary {
  groupBy: string
  rows: unknown[]
  summary: { totalCalls: number; totalTokens: number; totalCostCents: number }
}

interface KeysData {
  list: RelayKey[]
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

function formatBalance(cents: number): string {
  if (cents === -1) return '无限额度'
  if (cents === 0) return '0.00 元'
  return (cents / 100).toFixed(2) + ' 元'
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint?: string
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {icon}
          <span>{label}</span>
        </div>
        <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
        {hint && <p className="text-xs text-amber-600 dark:text-amber-400">{hint}</p>}
      </CardContent>
    </Card>
  )
}

export default function RelayOverviewPage() {
  const locale = useLocale()
  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' })
  const num = new Intl.NumberFormat(locale)

  const {
    data: keysData,
    isLoading: keysLoading,
    error: keysError,
  } = useQuery({
    queryKey: ['developer', 'relay', 'keys'],
    queryFn: () =>
      api<KeysData>('/api/developer/relay/keys').catch(() => ({ list: [] }) as KeysData),
  })
  const { data: usageData, isLoading: usageLoading } = useQuery({
    queryKey: ['developer', 'relay', 'usage', 'overview'],
    queryFn: () => api<UsageSummary>('/api/developer/relay/usage?groupBy=model').catch(() => null),
  })

  const list = keysData?.list ?? []
  const summary = usageData?.summary
  const totalBalanceCents = list.reduce(
    (s, k) => s + (k.costBalanceCents > 0 ? k.costBalanceCents : 0),
    0,
  )
  const hasInfinite = list.some((k) => k.costBalanceCents === -1)
  const activeCount = list.filter((k) => k.status === 'active').length

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Zap className="h-6 w-6 text-primary" />
          中转站概览
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          模型 API 中转站 · 我的 Key 与近 30 天用量
        </p>
      </div>

      {keysError && <Alert variant="danger" description={(keysError as Error).message} />}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={<Key className="h-3.5 w-3.5" />}
          label="API Key"
          value={keysLoading ? '—' : `${activeCount} / ${list.length}`}
        />
        <StatCard
          icon={<Coins className="h-3.5 w-3.5" />}
          label="可用余额"
          value={keysLoading ? '—' : formatBalance(totalBalanceCents)}
          hint={hasInfinite ? '含无限额度 Key' : undefined}
        />
        <StatCard
          icon={<Activity className="h-3.5 w-3.5" />}
          label="近 30 天调用"
          value={usageLoading || !summary ? '—' : num.format(summary.totalCalls)}
        />
        <StatCard
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          label="近 30 天消耗"
          value={usageLoading || !summary ? '—' : formatBalance(summary.totalCostCents)}
        />
      </div>

      <Card className="bg-muted/50">
        <CardContent className="flex items-center justify-between gap-3 p-3">
          <div className="flex min-w-0 flex-1 items-start gap-2">
            <div className="rounded-md bg-background p-1.5">
              <Bot className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium">或使用自己的 API Key(BYOK)</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                自带大厂 API Key(OpenAI/DeepSeek/智谱等),平台只收 5-20% 服务费。Cloudflare/GitHub
                Models/HuggingFace 等免费 provider 不收费。
              </p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link href="/settings/llm">
              配置 BYOK
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">我的 Key</h2>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/developer/relay/keys">
              管理 Key
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/developer/relay/usage">
              用量明细
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {keysLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            加载中...
          </div>
        ) : list.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">暂无数据</p>
        ) : (
          <div className="space-y-2 p-3">
            {list.map((k) => (
              <div key={k.id} className="flex items-center gap-3 rounded-md bg-muted/40 p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{k.name}</p>
                    <span
                      className={cn(
                        'rounded-md px-2 py-0.5 text-xs font-medium',
                        k.status === 'active'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
                      )}
                    >
                      {k.status === 'active' ? '启用' : '已吊销'}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    余额 {formatBalance(k.costBalanceCents)} · 已用 {num.format(k.tokenUsedTotal)}{' '}
                    token
                    {k.lastUsedAt && ` · ${dateFmt.format(new Date(k.lastUsedAt))}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
