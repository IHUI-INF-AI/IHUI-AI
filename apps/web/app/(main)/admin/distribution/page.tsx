'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import {
  Wallet,
  TrendingUp,
  Clock,
  CalendarPlus,
  Loader2,
  ArrowRight,
  ShoppingCart,
  Receipt,
  Settings2,
  Banknote,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent } from '@ihui/ui'
import { Alert } from '@/components/feedback'

interface Overview {
  totalCommission?: number
  settledCommission?: number
  pendingCommission?: number
  monthNew?: number
  availableCommission?: number
  withdrawnCommission?: number
  frozenCommission?: number
}

async function safeFetch<T>(url: string, fallback: T): Promise<T> {
  try {
    const r = await fetchApi<T>(url)
    return r.success ? r.data : fallback
  } catch {
    return fallback
  }
}

const fmtYuan = (n: number) => `¥${(n / 100).toFixed(2)}`

export default function AdminDistributionPage() {
  const ovQ = useQuery({
    queryKey: ['admin', 'distribution', 'overview'],
    queryFn: () => safeFetch<Overview>('/commission/overview', {}),
  })

  const ov = ovQ.data ?? {}
  const loading = ovQ.isLoading && !ovQ.data

  const stats = [
    {
      label: '总佣金',
      value: loading ? '—' : fmtYuan(ov.totalCommission ?? ov.availableCommission ?? 0),
      icon: Wallet,
      tone: 'text-primary',
    },
    {
      label: '已结算',
      value: loading ? '—' : fmtYuan(ov.settledCommission ?? ov.withdrawnCommission ?? 0),
      icon: TrendingUp,
      tone: 'text-emerald-600 dark:text-emerald-500',
    },
    {
      label: '待结算',
      value: loading ? '—' : fmtYuan(ov.pendingCommission ?? ov.frozenCommission ?? 0),
      icon: Clock,
      tone: 'text-amber-600 dark:text-amber-500',
    },
    {
      label: '本月新增',
      value: loading ? '—' : fmtYuan(ov.monthNew ?? 0),
      icon: CalendarPlus,
      tone: 'text-purple-600 dark:text-purple-500',
    },
  ]

  const entries = [
    {
      href: '/admin/distribution/orders',
      label: '分销订单',
      desc: '查看佣金订单明细与状态',
      icon: ShoppingCart,
    },
    {
      href: '/admin/distribution/settlements',
      label: '结算记录',
      desc: '佣金结算单与周期记录',
      icon: Receipt,
    },
    {
      href: '/admin/distribution/rules',
      label: '佣金规则',
      desc: '配置分级佣金比例',
      icon: Settings2,
    },
    {
      href: '/admin/distribution/withdrawals',
      label: '提现申请',
      desc: '审核用户提现请求',
      icon: Banknote,
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">分销中心</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          管理分销订单、佣金结算、规则配置与提现审核
        </p>
      </div>

      {ovQ.isError && <Alert variant="warning" description="统计接口暂不可用,展示为默认值" />}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <Card key={s.label}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{s.label}</span>
                  <Icon className={`h-4 w-4 ${s.tone}`} />
                </div>
                <div className="mt-2 text-2xl font-bold tracking-tight">
                  {loading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  ) : (
                    s.value
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">快捷入口</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {entries.map((e) => {
            const Icon = e.icon
            return (
              <Link key={e.href} href={e.href}>
                <Card className="transition-colors hover:bg-accent">
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-medium">{e.label}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">{e.desc}</div>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
