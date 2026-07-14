'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import {
  Loader2,
  ShoppingBag,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle,
  XCircle,
  Wallet,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button } from '@ihui/ui'
import { Alert } from '@/components/feedback'
import { cn } from '@/lib/utils'

type OrderStatus = 'pending' | 'paid' | 'cancelled' | 'refunded'

interface Order {
  id: string
  orderNo: string
  orderType: string
  targetTitle?: string | null
  payAmount: string
  status: OrderStatus
  createdAt: string
}

interface OrdersData {
  list: Order[]
  total: number
}

const PAGE_SIZE = 10

const STATUS_CONFIG: Record<OrderStatus, { icon: typeof Clock; cls: string }> = {
  pending: { icon: Clock, cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-500' },
  paid: { icon: CheckCircle, cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500' },
  cancelled: { icon: XCircle, cls: 'bg-red-500/10 text-red-600 dark:text-red-500' },
  refunded: { icon: Wallet, cls: 'bg-primary/10 text-primary' },
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: '待支付',
  paid: '已支付',
  cancelled: '已取消',
  refunded: '已退款',
}

const TABS: { value: 'all' | OrderStatus; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '待支付' },
  { value: 'paid', label: '已支付' },
  { value: 'cancelled', label: '已取消' },
  { value: 'refunded', label: '已退款' },
]

async function fetchOrders(status: string, page: number): Promise<OrdersData> {
  const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
  if (status !== 'all') qs.set('status', status)
  const r = await fetchApi<OrdersData>(`/api/orders/me?${qs.toString()}`)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function MemberOrdersPage() {
  const locale = useLocale()
  const router = useRouter()
  const [status, setStatus] = React.useState<'all' | OrderStatus>('all')
  const [page, setPage] = React.useState(1)

  const { data, isLoading, error } = useQuery({
    queryKey: ['member', 'orders', status, page],
    queryFn: () => fetchOrders(status, page),
  })

  const orders = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const currencyFmt = new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
  })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <ShoppingBag className="h-5 w-5 text-primary" />
          我的订单
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">查看并管理你的全部订单</p>
      </div>

      <div className="flex flex-wrap gap-1 rounded-lg border bg-muted/30 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => {
              setStatus(tab.value)
              setPage(1)
            }}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              status === tab.value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && <Alert variant="danger" description={(error as Error).message} />}

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          加载中...
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12 text-center">
          <ShoppingBag className="h-8 w-8 text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground">暂无订单记录</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">订单号</th>
                <th className="px-3 py-2 font-medium">商品</th>
                <th className="px-3 py-2 text-right font-medium">金额</th>
                <th className="px-3 py-2 font-medium">状态</th>
                <th className="px-3 py-2 font-medium">时间</th>
                <th className="px-3 py-2 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.map((o) => {
                const sc = STATUS_CONFIG[o.status] ?? STATUS_CONFIG.pending
                const StatusIcon = sc.icon
                return (
                  <tr key={o.id} className="transition-colors hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-xs">{o.orderNo}</td>
                    <td className="px-3 py-2 font-medium">{o.targetTitle ?? o.orderType}</td>
                    <td className="px-3 py-2 text-right font-medium">
                      {currencyFmt.format(Number(o.payAmount))}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                          sc.cls,
                        )}
                      >
                        <StatusIcon className="h-3 w-3" />
                        {STATUS_LABEL[o.status] ?? o.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {dateFmt.format(new Date(o.createdAt))}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/member/orders/${o.id}`)}
                      >
                        查看
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">共 {total} 条</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
