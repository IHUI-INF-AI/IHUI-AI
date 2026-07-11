'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ClipboardCheck, Check, X, Clock, Loader2, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'

import { fetchApi } from '@/lib/api'
import {
  Button,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@ihui/ui'
import { DataTable, type Column, Badge } from '@/components/data'
import { cn } from '@/lib/utils'

type AuditStatus = 'pending' | 'approved' | 'rejected'

interface DemandItem {
  id: string
  title: string
  submitter: string
  submittedAt: string
  status: AuditStatus
  auditOpinion?: string | null
  [key: string]: unknown
}

interface DemandData {
  list: DemandItem[]
  total: number
}

const STATUS_BADGE: Record<
  AuditStatus,
  {
    variant: 'warning' | 'success' | 'danger'
    icon: React.ComponentType<{ className?: string }>
    label: string
  }
> = {
  pending: { variant: 'warning', icon: Clock, label: '待审核' },
  approved: { variant: 'success', icon: Check, label: '已通过' },
  rejected: { variant: 'danger', icon: X, label: '已驳回' },
}

const FILTER_TABS = [
  { v: 'all', l: '全部' },
  { v: 'pending', l: '待审核' },
  { v: 'approved', l: '已通过' },
  { v: 'rejected', l: '已驳回' },
] as const

const PAGE_SIZE = 20

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const textareaClass =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export default function DemandAuditPage() {
  const qc = useQueryClient()
  const [search, setSearch] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState('all')
  const [page, setPage] = React.useState(1)
  const [auditItem, setAuditItem] = React.useState<DemandItem | null>(null)
  const [auditAction, setAuditAction] = React.useState<AuditStatus>('approved')
  const [opinion, setOpinion] = React.useState('')
  const [open, setOpen] = React.useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'demand-audit', search, statusFilter, page],
    queryFn: async () => {
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        keyword: search,
      })
      if (statusFilter !== 'all') qs.set('status', statusFilter)
      const res = await api<DemandData | DemandItem[]>(`/api/admin/demand-audit?${qs}`)
      const list = Array.isArray(res) ? res : (res.list ?? [])
      const total = Array.isArray(res) ? res.length : (res.total ?? 0)
      return { list, total }
    },
  })

  const auditMut = useMutation({
    mutationFn: () => {
      const body = { status: auditAction, auditOpinion: opinion }
      return api(`/api/admin/demand-audit/${auditItem!.id}/audit`, {
        method: 'PUT',
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'demand-audit'] })
      close()
      toast.success('审核完成')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openAudit(item: DemandItem, action: AuditStatus) {
    setAuditItem(item)
    setAuditAction(action)
    setOpinion(item.auditOpinion ?? '')
    setOpen(true)
  }
  function close() {
    if (auditMut.isPending) return
    setOpen(false)
    setAuditItem(null)
    setOpinion('')
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    auditMut.mutate()
  }

  const list = data?.list ?? []
  const total = data?.total ?? 0
  const dateFmt = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  const columns: Column<DemandItem>[] = [
    {
      key: 'title',
      title: '需求标题',
      render: (d) => <span className="font-medium">{d.title}</span>,
    },
    {
      key: 'submitter',
      title: '提交者',
      render: (d) => <span className="text-muted-foreground">{d.submitter}</span>,
    },
    {
      key: 'submittedAt',
      title: '提交时间',
      render: (d) => (
        <span className="text-muted-foreground">{dateFmt.format(new Date(d.submittedAt))}</span>
      ),
    },
    {
      key: 'status',
      title: '状态',
      render: (d) => {
        const cfg = STATUS_BADGE[d.status]
        const Icon = cfg.icon
        return (
          <Badge variant={cfg.variant}>
            <Icon className="h-3 w-3" />
            {cfg.label}
          </Badge>
        )
      },
    },
    {
      key: 'auditOpinion',
      title: '审核意见',
      render: (d) =>
        d.auditOpinion ? (
          <span className="text-xs text-muted-foreground">{d.auditOpinion}</span>
        ) : (
          <span className="text-muted-foreground/50">-</span>
        ),
    },
    {
      key: 'actions',
      title: '操作',
      align: 'right',
      render: (d) =>
        d.status === 'pending' ? (
          <div className="flex justify-end gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="text-emerald-600 hover:text-emerald-700"
              onClick={() => openAudit(d, 'approved')}
            >
              <Check className="h-4 w-4" />
              通过
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => openAudit(d, 'rejected')}
            >
              <X className="h-4 w-4" />
              驳回
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => openAudit(d, d.status)}>
            <MessageSquare className="h-4 w-4" />
            查看
          </Button>
        ),
    },
  ]

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <ClipboardCheck className="h-6 w-6 text-primary" />
          需求审核
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">审核用户提交的需求,支持通过/驳回操作</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="搜索需求标题或提交者..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          className="max-w-sm"
        />
        <div className="flex items-center gap-1 rounded-lg border bg-muted/30 p-1">
          {FILTER_TABS.map((t) => (
            <button
              key={t.v}
              onClick={() => {
                setStatusFilter(t.v)
                setPage(1)
              }}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                statusFilter === t.v
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t.l}
            </button>
          ))}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={list}
        rowKey={(d) => d.id}
        loading={isLoading}
        pagination={{ page, pageSize: PAGE_SIZE, total }}
        onPageChange={setPage}
      />

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <DialogContent>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>
                {auditAction === 'approved'
                  ? '通过需求'
                  : auditAction === 'rejected'
                    ? '驳回需求'
                    : '审核详情'}
              </DialogTitle>
            </DialogHeader>
            {auditItem && (
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                <div className="font-medium">{auditItem.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  提交者: {auditItem.submitter} | 提交时间:{' '}
                  {dateFmt.format(new Date(auditItem.submittedAt))}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="d-opinion">审核意见</Label>
              <textarea
                id="d-opinion"
                value={opinion}
                onChange={(e) => setOpinion(e.target.value)}
                rows={3}
                className={textareaClass}
                placeholder="请输入审核意见..."
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close} disabled={auditMut.isPending}>
                取消
              </Button>
              <Button
                type="submit"
                disabled={auditMut.isPending || auditItem?.status !== 'pending'}
                className={cn(
                  auditAction === 'rejected' && 'bg-destructive hover:bg-destructive/90',
                )}
              >
                {auditMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {auditAction === 'approved'
                  ? '确认通过'
                  : auditAction === 'rejected'
                    ? '确认驳回'
                    : '关闭'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
