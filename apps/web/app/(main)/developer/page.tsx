'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import {
  BarChart,
  Key,
  Webhook,
  CreditCard,
  Loader2,
  ArrowRight,
  Code,
  FlaskConical,
  FileText,
  GitBranch,
  Coins,
  Check,
  KeyRound,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardContent } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import { cn } from '@/lib/utils'

interface DevSummary {
  callCount?: number
  keyCount?: number
  webhookCount?: number
  monthFee?: number
  planName?: string
  quotaUsed?: number
  quotaTotal?: number
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function DeveloperHomePage() {
  const t = useTranslations('developerHomePage')
  const tPricing = useTranslations('developerPricingPage')
  const tByok = useTranslations('byokGuide')
  const locale = useLocale()
  const summaryQ = useQuery({
    queryKey: ['developer', 'summary'],
    queryFn: () => api<DevSummary>('/api/developer/summary').catch(() => ({}) as DevSummary),
  })

  const summary = summaryQ.data ?? {}
  const currencyFmt = new Intl.NumberFormat(locale, { style: 'currency', currency: 'CNY' })
  const numFmt = new Intl.NumberFormat(locale)

  const stats = [
    {
      label: t('statCalls'),
      value: summary.callCount ?? 0,
      icon: BarChart,
      href: '/developer/logs',
      cls: 'text-primary',
      fmt: (v: number | string) => numFmt.format(Number(v)),
    },
    {
      label: t('statApiKeys'),
      value: summary.keyCount ?? 0,
      icon: Key,
      href: '/developer/keys',
      cls: 'text-amber-600 dark:text-amber-400',
      fmt: (v: number | string) => numFmt.format(Number(v)),
    },
    {
      label: t('statWebhook'),
      value: summary.webhookCount ?? 0,
      icon: Webhook,
      href: '/developer/webhooks',
      cls: 'text-emerald-600 dark:text-emerald-400',
      fmt: (v: number | string) => numFmt.format(Number(v)),
    },
    {
      label: t('statMonthFee'),
      value: summary.monthFee ?? 0,
      icon: CreditCard,
      href: '/developer/billing',
      cls: 'text-rose-600 dark:text-rose-400',
      fmt: (v: number | string) => currencyFmt.format(Number(v)),
    },
  ]

  const quickEntries = [
    { label: t('qeApiDocsLabel'), desc: t('qeApiDocsDesc'), href: '/developer/api-docs', icon: Code },
    { label: t('qeSandboxLabel'), desc: t('qeSandboxDesc'), href: '/developer/sandbox', icon: FlaskConical },
    { label: t('qeLogsLabel'), desc: t('qeLogsDesc'), href: '/developer/logs', icon: FileText },
    { label: t('qeVersionsLabel'), desc: t('qeVersionsDesc'), href: '/developer/versions', icon: GitBranch },
    { label: tPricing('cardLabel'), desc: tPricing('cardDesc'), href: '/developer/pricing', icon: Coins },
  ]

  return (
    <div className="space-y-4">
      {summaryQ.error && <Alert variant="danger" description={(summaryQ.error as Error).message} />}

      <div className="grid grid-cols-2 gap-3 min-[1024px]:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <Link
              key={s.label}
              href={s.href}
              className="group rounded-lg border bg-card p-3 transition-colors hover:bg-accent"
            >
              <div className="flex items-center justify-between">
                <Icon className={cn('h-5 w-5', s.cls)} />
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <p className="mt-2 truncate text-lg font-semibold tabular-nums">{s.fmt(s.value)}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </Link>
          )
        })}
      </div>

      {summary.planName && (
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs text-muted-foreground">{t('currentPlan')}</p>
              <p className="mt-0.5 text-sm font-semibold">{summary.planName}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">{t('quotaUsage')}</p>
                <p className="whitespace-nowrap tabular-nums text-sm font-medium">
                  {numFmt.format(summary.quotaUsed ?? 0)} / {numFmt.format(summary.quotaTotal ?? 0)}
                </p>
              </div>
              <Link
                href="/developer/subscription"
                className="rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
              >
                {t('upgrade')}
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="border-b px-4 py-2.5 text-sm font-semibold">{t('quickEntries')}</div>
          <div className="grid grid-cols-2 gap-px bg-border/40 min-[1024px]:grid-cols-5">
            {quickEntries.map((q) => {
              const Icon = q.icon
              return (
                <Link
                  key={q.href}
                  href={q.href}
                  className="group flex flex-col gap-1 bg-card p-4 transition-colors hover:bg-accent"
                >
                  <Icon className="h-5 w-5 shrink-0 text-primary" />
                  <p className="mt-1 whitespace-nowrap text-sm font-medium">{q.label}</p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{q.desc}</p>
                </Link>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* BYOK 引导:自带 API Key,零中间商加价,免费模型不收费 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 [&>span]:translate-y-[0.5px]">
                <KeyRound className="h-4 w-4 shrink-0 text-primary" />
                <span className="whitespace-nowrap text-sm font-semibold">{tByok('cardTitle')}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{tByok('cardDesc')}</p>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground [&>li]:translate-y-[0px]">
                <li className="flex items-center gap-1.5">
                  <Check className="h-3 w-3 shrink-0 text-emerald-500" />
                  <span className="whitespace-nowrap">{tByok('feature1')}</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="h-3 w-3 shrink-0 text-emerald-500" />
                  <span className="whitespace-nowrap">{tByok('feature2')}</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="h-3 w-3 shrink-0 text-emerald-500" />
                  <span className="whitespace-nowrap">{tByok('feature3')}</span>
                </li>
              </ul>
            </div>
            <Button asChild variant="outline" size="sm" className="shrink-0">
              <Link href="/settings/llm">{tByok('cta')}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {summaryQ.isLoading && (
        <div className="flex items-center justify-center py-6 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" />
          <span className="whitespace-nowrap">{t('loading')}</span>
        </div>
      )}
    </div>
  )
}
