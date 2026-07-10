'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, ChevronLeft, ChevronRight, Receipt, Search, Check } from 'lucide-react'
import { eduApi, buildQs, selectClass, type PageData } from '@/lib/edu'
import { cn } from '@/lib/utils'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  Button, Input, Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from '@ihui/ui'

interface Invoice {
  id: string; userId: string; userName: string | null
  title: string; taxNo: string; type: string
  amount: string; status: string; appliedAt: string
}
const PAGE_SIZE = 10
const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  pending: { label: '待处理', cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  processing: { label: '处理中', cls: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' },
  issued: { label: '已开具', cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500' },
  rejected: { label: '已拒绝', cls: 'bg-rose-500/10 text-rose-600 dark:text-rose-500' },
}

export default function EduFinanceInvoicesPage() {
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [status, setStatus] = React.useState('all')

  React.useEffect(() => { const tm = setTimeout(() => { setDebounced(search); setPage(1) }, 300); return () => clearTimeout(tm) }, [search])
  React.useEffect(() => { setPage(1) }, [status])

  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'finance', 'invoices', debounced, status, page],
    queryFn: () => eduApi<PageData<Invoice>>(`/api/admin/learn/invoices${buildQs({ page, pageSize: PAGE_SIZE, search: debounced, status: status === 'all' ? '' : status })}`),
  })

  const approveMut = useMutation({
    mutationFn: (id: string) => eduApi(`/api/admin/learn/invoices/${id}/status`, { method: 'PUT', body: JSON.stringify({ status: 'issued' }) }),
    onSuccess: () => { toast.success('已开具'); qc.invalidateQueries({ queryKey: ['edu', 'finance', 'invoices'] }) },
    onError: (e: Error) => toast.error(e.message),
  })

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rows = data?.list ?? []

  return (
    <div className="space-y-4">
      <div><h1 className="text-2xl font-bold tracking-tight">发票管理</h1><p className="mt-1 text-sm text-muted-foreground">审核与开具学员发票申请</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm"><Link href="/admin/edu/finance"><ChevronLeft className="h-4 w-4" />返回财务管理</Link></Button>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索发票..." className="h-9 pl-8" />
        </div>
        <div className="w-full max-w-[140px]">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className={selectClass} aria-label="状态"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">全部状态</SelectItem><SelectItem value="pending">待处理</SelectItem><SelectItem value="processing">处理中</SelectItem><SelectItem value="issued">已开具</SelectItem><SelectItem value="rejected">已拒绝</SelectItem></SelectContent>
          </Select>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50"><TableRow>
            <TableHead className="px-4 py-2.5">申请人</TableHead><TableHead className="px-4 py-2.5">发票抬头</TableHead>
            <TableHead className="px-4 py-2.5">税号</TableHead><TableHead className="px-4 py-2.5">类型</TableHead>
            <TableHead className="px-4 py-2.5">金额</TableHead><TableHead className="px-4 py-2.5">状态</TableHead>
            <TableHead className="px-4 py-2.5">申请时间</TableHead><TableHead className="px-4 py-2.5 text-right">操作</TableHead>
          </TableRow></TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (<TableRow><TableCell colSpan={8} className="px-4 py-10 text-center text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />加载中...</TableCell></TableRow>
            ) : error ? (<TableRow><TableCell colSpan={8} className="px-4 py-10 text-center text-destructive">{(error as Error).message}</TableCell></TableRow>
            ) : rows.length === 0 ? (<TableRow><TableCell colSpan={8} className="px-4 py-10 text-center text-muted-foreground"><Receipt className="mx-auto mb-2 h-8 w-8 opacity-40" />暂无发票申请</TableCell></TableRow>
            ) : rows.map((inv) => {
              const st = STATUS_MAP[inv.status] ?? { label: inv.status, cls: 'bg-muted text-muted-foreground' }
              return (
                <TableRow key={inv.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5 font-medium">{inv.userName ?? inv.userId.slice(0, 8)}</TableCell>
                  <TableCell className="px-4 py-2.5">{inv.title}</TableCell>
                  <TableCell className="px-4 py-2.5 font-mono text-xs">{inv.taxNo}</TableCell>
                  <TableCell className="px-4 py-2.5"><span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-sky-500/10 text-sky-600 dark:text-sky-400')}>{inv.type === 'company' ? '企业' : '个人'}</span></TableCell>
                  <TableCell className="px-4 py-2.5 font-semibold">¥{inv.amount}</TableCell>
                  <TableCell className="px-4 py-2.5"><span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', st.cls)}>{st.label}</span></TableCell>
                  <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">{inv.appliedAt}</TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    {inv.status === 'pending' && <Button variant="outline" size="sm" onClick={() => approveMut.mutate(inv.id)} disabled={approveMut.isPending}><Check className="h-4 w-4" />开具</Button>}
                  </TableCell>
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
