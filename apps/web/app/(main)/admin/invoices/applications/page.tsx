'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { toast } from 'sonner'
import { Loader2, ChevronLeft, ChevronRight, FileText } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Button,
  Label,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@ihui/ui'

type InvoiceAppStatus = 'pending' | 'approved' | 'rejected' | 'invoicing' | 'invoiced' | 'canceled'

interface InvoiceApplication {
  id: string
  orderId?: string | null
  userId: string
  invoiceType: string
  amount: string
  email?: string | null
  status: InvoiceAppStatus
  remark?: string | null
  createdAt: string
}

interface AppsData {
  list: InvoiceApplication[]
  total: number
}

const PAGE_SIZE = 10
const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

const STATUS_CFG: Record<InvoiceAppStatus, { label: string; cls: string }> = {
  pending: { label: '待审核', cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-500' },
  approved: { label: '已通过', cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500' },
  rejected: { label: '已拒绝', cls: 'bg-red-500/10 text-red-600 dark:text-red-500' },
  invoicing: { label: '开票中', cls: 'bg-sky-500/10 text-sky-600 dark:text-sky-500' },
  invoiced: { label: '已开票', cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500' },
  canceled: { label: '已取消', cls: 'bg-muted text-muted-foreground' },
}

const STATUS_TABS: { value: 'all' | InvoiceAppStatus; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '待审核' },
  { value: 'approved', label: '已通过' },
  { value: 'rejected', label: '已拒绝' },
  { value: 'invoiced', label: '已开票' },
]

const STATUS_ORDER: InvoiceAppStatus[] = [
  'pending',
  'approved',
  'rejected',
  'invoicing',
  'invoiced',
  'canceled',
]

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function AdminInvoiceApplicationsPage() {
  const locale = useLocale()
  const qc = useQueryClient()
  const [status, setStatus] = React.useState<'all' | InvoiceAppStatus>('all')
  const [page, setPage] = React.useState(1)
  const [target, setTarget] = React.useState<InvoiceApplication | null>(null)
  const [newStatus, setNewStatus] = React.useState<InvoiceAppStatus>('pending')
  const [err, setErr] = React.useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'invoice-apps', status, page],
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (status !== 'all') qs.set('status', status)
      return api<AppsData>(`/api/admin/invoices/applications?${qs.toString()}`)
    },
    retry: false,
  })

  const mut = useMutation({
    mutationFn: () =>
      api(`/api/admin/invoices/applications/${target!.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      }),
    onSuccess: () => {
      toast.success('状态已更新')
      qc.invalidateQueries({ queryKey: ['admin', 'invoice-apps'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  function openStatus(app: InvoiceApplication) {
    setTarget(app)
    setNewStatus(app.status)
    setErr(null)
  }
  function closeDialog() {
    if (mut.isPending) return
    setTarget(null)
    setErr(null)
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    mut.mutate()
  }

  const rows = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const currencyFmt = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' })

  const emptyCell = (msg: string, icon = true) => (
    <TableRow>
      <TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
        {icon && <FileText className="mx-auto mb-2 h-8 w-8 opacity-40" />}
        {msg}
      </TableCell>
    </TableRow>
  )

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">发票申请管理</h1>
        <p className="mt-1 text-sm text-muted-foreground">审核用户发票申请并管理开票流程</p>
      </div>

      <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-muted/30 p-1">
        {STATUS_TABS.map((tb) => (
          <button
            key={tb.value}
            onClick={() => {
              setStatus(tb.value)
              setPage(1)
            }}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              status === tb.value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tb.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-4 py-2.5">发票类型</TableHead>
              <TableHead className="px-4 py-2.5">金额</TableHead>
              <TableHead className="px-4 py-2.5">邮箱</TableHead>
              <TableHead className="px-4 py-2.5">状态</TableHead>
              <TableHead className="px-4 py-2.5">申请时间</TableHead>
              <TableHead className="px-4 py-2.5 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  加载中...
                </TableCell>
              </TableRow>
            ) : error ? (
              emptyCell('接口未配置或加载失败')
            ) : rows.length === 0 ? (
              emptyCell('暂无发票申请')
            ) : (
              rows.map((a) => {
                const sc = STATUS_CFG[a.status] ?? STATUS_CFG.pending
                const typeLabel =
                  a.invoiceType === 'company'
                    ? '企业'
                    : a.invoiceType === 'personal'
                      ? '个人'
                      : a.invoiceType
                return (
                  <TableRow key={a.id} className="hover:bg-muted/30">
                    <TableCell className="px-4 py-2.5">
                      <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
                        {typeLabel}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-2.5 font-medium">
                      {currencyFmt.format(Number(a.amount))}
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-muted-foreground">
                      {a.email ?? '—'}
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
                          sc.cls,
                        )}
                      >
                        {sc.label}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">
                      {dateFmt.format(new Date(a.createdAt))}
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-right">
                      <Button size="sm" variant="outline" onClick={() => openStatus(a)}>
                        审核
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
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
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
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
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog open={!!target} onOpenChange={(o) => (!o && !mut.isPending ? closeDialog() : null)}>
        <DialogContent>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>审核发票申请</DialogTitle>
            </DialogHeader>
            {err && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}
            {target && (
              <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
                <div className="font-medium">{currencyFmt.format(Number(target.amount))}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {target.invoiceType} · {STATUS_CFG[target.status]?.label}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="inv-status">状态</Label>
              <Select value={newStatus} onValueChange={(v) => setNewStatus(v as InvoiceAppStatus)}>
                <SelectTrigger className={selectClass} id="inv-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_ORDER.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_CFG[s].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeDialog}
                disabled={mut.isPending}
              >
                取消
              </Button>
              <Button type="submit" disabled={mut.isPending}>
                {mut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}保存
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
