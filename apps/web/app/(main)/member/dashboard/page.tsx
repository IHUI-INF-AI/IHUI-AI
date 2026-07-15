'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { Crown, Coins, Ticket, ShoppingBag, Loader2, ArrowRight } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent } from '@ihui/ui'
import { Alert } from '@/components/feedback'
import { cn } from '@/lib/utils'

interface MemberSummary {
  levelName?: string
  levelValue?: number
  points?: number
  couponCount?: number
  orderCount?: number
  expireAt?: string | null
}

interface OrderRow {
  id: string
  orderNo: string
  targetTitle?: string | null
  payAmount: string
  status: string
  createdAt: string
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function MemberDashboardPage() {
  const locale = useLocale()
  const summaryQ = useQuery({
    queryKey: ['member', 'summary'],
    queryFn: () => api<MemberSummary>('/api/members/me').catch(() => ({}) as MemberSummary),
  })
  const ordersQ = useQuery({
    queryKey: ['member', 'recent-orders'],
    queryFn: () => api<{ list: OrderRow[] }>('/api/orders/me?pageSize=5').then((d) => d.list ?? []),
  })

  const summary = summaryQ.data ?? {}
  const orders = ordersQ.data ?? []
  const dateFmt = new Intl.DateTimeFormat(locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const currencyFmt = new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
  })

  const stats = [
    {
      label: '会员等级',
      value: summary.levelName ?? '普通会员',
      icon: Crown,
      href: '/member/benefits',
      cls: 'text-amber-600 dark:text-amber-400',
    },
    {
      label: '可用积分',
      value: summary.points ?? 0,
      icon: Coins,
      href: '/member/points',
      cls: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      label: '优惠券',
      value: summary.couponCount ?? 0,
      icon: Ticket,
      href: '/member/coupons',
      cls: 'text-primary',
    },
    {
      label: '订单总数',
      value: summary.orderCount ?? 0,
      icon: ShoppingBag,
      href: '/member/orders',
      cls: 'text-teal-600 dark:text-teal-400',
    },
  ]

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">会员中心</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          一站式管理你的会员权益、订单、积分与优惠
        </p>
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
              <p className="mt-2 truncate text-lg font-semibold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </Link>
          )
        })}
      </div>

      {summary.expireAt && (
        <Card className="border-amber-500/30 bg-amber-50/40 dark:bg-amber-950/10">
          <CardContent className="flex items-center justify-between p-3 text-sm">
            <span className="text-muted-foreground">
              会员有效期至:{' '}
              <span className="font-medium text-foreground">
                {dateFmt.format(new Date(summary.expireAt))}
              </span>
            </span>
            <Link
              href="/member/upgrade"
              className="text-amber-600 hover:underline dark:text-amber-400"
            >
              立即续费
            </Link>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <h2 className="text-sm font-semibold">最近订单</h2>
            <Link
              href="/member/orders"
              className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground"
            >
              查看全部
              <ArrowRight className="ml-0.5 h-3 w-3" />
            </Link>
          </div>
          {ordersQ.isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              加载中...
            </div>
          ) : orders.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">暂无订单记录</p>
          ) : (
            <ul className="divide-y">
              {orders.map((o) => (
                <li key={o.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{o.targetTitle ?? o.orderNo}</p>
                    <p className="text-xs text-muted-foreground">
                      {dateFmt.format(new Date(o.createdAt))}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-medium">
                    {currencyFmt.format(Number(o.payAmount))}
                  </span>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {o.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
