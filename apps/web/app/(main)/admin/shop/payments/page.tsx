'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, ShoppingCart, Search } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import {
  Button,
  Input,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/date-utils'

interface Order {
  id: string
  orderNo: string
  user: string
  product: string
  amount: number
  status: 'pending' | 'paid' | 'shipped' | 'completed' | 'cancelled' | 'refunded'
  createdAt: string
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const selectClass =
  'h-8 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
const STATUS_LABEL: Record<Order['status'], string> = {
  pending: '待支付',
  paid: '已支付',
  shipped: '已发货',
  completed: '已完成',
  cancelled: '已取消',
  refunded: '已退款',
}
const STATUS_STYLE: Record<Order['status'], string> = {
  pending: 'bg-amber-500/10 text-amber-600',
  paid: 'bg-emerald-500/10 text-emerald-600',
  shipped: 'bg-purple-500/10 text-purple-600',
  completed: 'bg-emerald-500/10 text-emerald-600',
  cancelled: 'bg-muted text-muted-foreground',
  refunded: 'bg-red-500/10 text-red-600',
}

export default function AdminShopPaymentsPage() {
  const qc = useQueryClient()
  const [search, setSearch] = React.useState('')
  const [status, setStatus] = React.useState('all')
  const [page, setPage] = React.useState(1)
  const PAGE_SIZE = 10

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'shop', 'payments', search, status, page],
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (search) qs.set('search', search)
      if (status !== 'all') qs.set('status', status)
      return api<{ list: Order[]; total: number }>(`/api/admin/shop/payments?${qs.toString()}`)
    },
  })

  const shipMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/shop/payments/${id}/ship`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'shop', 'payments'] }),
  })

  const orders = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <ShoppingCart className="h-6 w-6 text-primary" />
          支付订单管理
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">查看与处理支付订单</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="搜索订单号/用户"
            className="h-9 pl-8"
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v)
            setPage(1)
          }}
        >
          <SelectTrigger className={selectClass} aria-label="状态">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-xs uppercase">订单号</TableHead>
              <TableHead className="text-xs uppercase">用户</TableHead>
              <TableHead className="text-xs uppercase">商品</TableHead>
              <TableHead className="text-xs uppercase">金额</TableHead>
              <TableHead className="text-xs uppercase">状态</TableHead>
              <TableHead className="text-xs uppercase">时间</TableHead>
              <TableHead className="text-right text-xs uppercase">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                </TableCell>
              </TableRow>
            ) : orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  暂无订单
                </TableCell>
              </TableRow>
            ) : (
              orders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-xs">{o.orderNo}</TableCell>
                  <TableCell>{o.user}</TableCell>
                  <TableCell>{o.product}</TableCell>
                  <TableCell className="font-medium">¥{(o.amount / 100).toFixed(2)}</TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs',
                        STATUS_STYLE[o.status],
                      )}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {STATUS_LABEL[o.status]}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(o.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    {o.status === 'paid' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={shipMut.isPending}
                        onClick={() => shipMut.mutate(o.id)}
                      >
                        发货
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">共 {total} 条</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            上一页
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            下一页
          </Button>
        </div>
      </div>
    </div>
  )
}
