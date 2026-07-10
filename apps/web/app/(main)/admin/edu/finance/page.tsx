'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Loader2, ChevronLeft, ChevronRight, Wallet, Search } from 'lucide-react'
import { eduApi, buildQs, selectClass, type PageData } from '@/lib/edu'
import { cn } from '@/lib/utils'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  Button, Input, Select, SelectTrigger, SelectContent, SelectItem, SelectValue, Card, CardContent,
} from '@ihui/ui'

interface Order {
  id: string; orderNo: string; userId: string; userName: string | null
  productType: string; productName: string; amount: string
  status: string; payMethod: string | null; createdAt: string
}
const PAGE_SIZE = 10
const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  paid: { label: '已支付', cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500' },
  pending: { label: '待支付', cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  cancelled: { label: '已取消', cls: 'bg-muted text-muted-foreground' },
  refunded: { label: '已退款', cls: 'bg-rose-500/10 text-rose-600 dark:text-rose-500' },
}

export default function EduFinancePage() {
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [status, setStatus] = React.useState('all')

  React.useEffect(() => { const tm = setTimeout(() => { setDebounced(search); setPage(1) }, 300); return () => clearTimeout(tm) }, [search])
  React.useEffect(() => { setPage(1) }, [status])

  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'finance', debounced, status, page],
    queryFn: () => eduApi<PageData<Order>>(`/api/admin/orders${buildQs({ page, pageSize: PAGE_SIZE, search: debounced, status: status === 'all' ? '' : status })}`),
  })

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rows = data?.list ?? []
  const totalAmount = rows.reduce((a, r) => a + (r.status === 'paid' ? Number(r.amount) : 0), 0)

  return (
    <div className="space-y-4">
      <div><h1 className="text-2xl font-bold tracking-tight">财务管理</h1><p className="mt-1 text-sm text-muted-foreground">订单、发票与财务统计</p></div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">订单总数</div><div className="mt-1 text-2xl font-semibold">{total}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">当前页已支付金额</div><div className="mt-1 text-2xl font-semibold text-emerald-600">¥{totalAmount.toFixed(2)}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">已支付</div><div className="mt-1 text-2xl font-semibold">{rows.filter((r) => r.status === 'paid').length}</div></CardContent></Card>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm"><Link href="/admin/edu"><ChevronLeft className="h-4 w-4" />返回教育后台</Link></Button>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索订单..." className="h-9 pl-8" />
        </div>
        <div className="w-full max-w-[140px]">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className={selectClass} aria-label="状态"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">全部状态</SelectItem><SelectItem value="paid">已支付</SelectItem><SelectItem value="pending">待支付</SelectItem><SelectItem value="cancelled">已取消</SelectItem><SelectItem value="refunded">已退款</SelectItem></SelectContent>
          </Select>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50"><TableRow>
            <TableHead className="px-4 py-2.5">订单号</TableHead><TableHead className="px-4 py-2.5">用户</TableHead>
            <TableHead className="px-4 py-2.5">商品</TableHead><TableHead className="px-4 py-2.5">金额</TableHead>
            <TableHead className="px-4 py-2.5">支付方式</TableHead><TableHead className="px-4 py-2.5">状态</TableHead>
            <TableHead className="px-4 py-2.5">时间</TableHead>
          </TableRow></TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (<TableRow><TableCell colSpan={7} className="px-4 py-10 text-center text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />加载中...</TableCell></TableRow>
            ) : error ? (<TableRow><TableCell colSpan={7} className="px-4 py-10 text-center text-destructive">{(error as Error).message}</TableCell></TableRow>
            ) : rows.length === 0 ? (<TableRow><TableCell colSpan={7} className="px-4 py-10 text-center text-muted-foreground"><Wallet className="mx-auto mb-2 h-8 w-8 opacity-40" />暂无订单</TableCell></TableRow>
            ) : rows.map((o) => {
              const st = STATUS_MAP[o.status] ?? { label: o.status, cls: 'bg-muted text-muted-foreground' }
              return (
                <TableRow key={o.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5 font-mono text-xs">{o.orderNo}</TableCell>
                  <TableCell className="px-4 py-2.5">{o.userName ?? o.userId.slice(0, 8)}</TableCell>
                  <TableCell className="px-4 py-2.5"><div className="font-medium">{o.productName}</div><div className="text-xs text-muted-foreground">{o.productType}</div></TableCell>
                  <TableCell className="px-4 py-2.5 font-semibold">¥{o.amount}</TableCell>
                  <TableCell className="px-4 py-2.5 text-xs">{o.payMethod ?? '-'}</TableCell>
                  <TableCell className="px-4 py-2.5"><span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', st.cls)}>{st.label}</span></TableCell>
                  <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleString()}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">共 {total} 条</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}><ChevronLeft className="h-4 w-4" />上一页</Button>
          <span className="text-sm text-muted-foreground">第 {page} / {totalPages} 页</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>下一页<ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  )
}
