'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
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
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent } from '@ihui/ui'
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
      label: '调用次数(本月)',
      value: summary.callCount ?? 0,
      icon: BarChart,
      href: '/developer/logs',
      cls: 'text-primary',
      fmt: (v: number | string) => numFmt.format(Number(v)),
    },
    {
      label: 'API 密钥',
      value: summary.keyCount ?? 0,
      icon: Key,
      href: '/developer/keys',
      cls: 'text-amber-600 dark:text-amber-400',
      fmt: (v: number | string) => numFmt.format(Number(v)),
    },
    {
      label: 'Webhook',
      value: summary.webhookCount ?? 0,
      icon: Webhook,
      href: '/developer/webhooks',
      cls: 'text-emerald-600 dark:text-emerald-400',
      fmt: (v: number | string) => numFmt.format(Number(v)),
    },
    {
      label: '本月费用',
      value: summary.monthFee ?? 0,
      icon: CreditCard,
      href: '/developer/billing',
      cls: 'text-rose-600 dark:text-rose-400',
      fmt: (v: number | string) => currencyFmt.format(Number(v)),
    },
  ]

  const quickEntries = [
    { label: 'API 文档', desc: '查阅接口说明', href: '/developer/api-docs', icon: Code },
    { label: '沙箱测试', desc: '在线调用 API', href: '/developer/sandbox', icon: FlaskConical },
    { label: '调用日志', desc: '查看请求记录', href: '/developer/logs', icon: FileText },
    { label: '版本管理', desc: 'API 版本状态', href: '/developer/versions', icon: GitBranch },
  ]

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">开发者概览</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">查看 API 使用情况与开发者资源</p>
      </div>

      {summaryQ.error && <Alert variant="danger" description={(summaryQ.error as Error).message} />}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
              <p className="mt-2 truncate text-lg font-semibold">{s.fmt(s.value)}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </Link>
          )
        })}
      </div>

      {summary.planName && (
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs text-muted-foreground">当前套餐</p>
              <p className="mt-0.5 text-sm font-semibold">{summary.planName}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">配额使用</p>
                <p className="text-sm font-medium">
                  {numFmt.format(summary.quotaUsed ?? 0)} / {numFmt.format(summary.quotaTotal ?? 0)}
                </p>
              </div>
              <Link
                href="/developer/subscription"
                className="rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
              >
                升级
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="border-b px-4 py-2.5 text-sm font-semibold">快速入口</div>
          <div className="grid grid-cols-2 gap-px bg-border/40 lg:grid-cols-4">
            {quickEntries.map((q) => {
              const Icon = q.icon
              return (
                <Link
                  key={q.href}
                  href={q.href}
                  className="group flex flex-col gap-1 bg-card p-4 transition-colors hover:bg-accent"
                >
                  <Icon className="h-5 w-5 text-primary" />
                  <p className="mt-1 text-sm font-medium">{q.label}</p>
                  <p className="text-xs text-muted-foreground">{q.desc}</p>
                </Link>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {summaryQ.isLoading && (
        <div className="flex items-center justify-center py-6 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          加载中...
        </div>
      )}
    </div>
  )
}
