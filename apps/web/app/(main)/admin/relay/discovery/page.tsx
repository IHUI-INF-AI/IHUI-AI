'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { toast } from 'sonner'
import {
  Activity,
  Search,
  ChevronLeft,
  ChevronRight,
  ScanLine,
  CheckCircle2,
  XCircle,
  Loader2,
  Zap,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import {
  Button,
  Input,
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
} from '@ihui/ui-react'
import { Skeleton } from '@/components/ui/skeleton'

const PAGE_SIZE = 20
const selectClass =
  'h-8 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

type DiscStatus = 'discovered' | 'pending' | 'approved' | 'rejected'

interface DiscoveryRow {
  id: number
  providerCode: string
  modelId: string
  modelName: string | null
  contextLength: number | null
  upstreamPrice: { input?: number; output?: number; currency?: string } | null
  capabilities: string[] | null
  description: string | null
  status: DiscStatus
  reviewedBy: string | null
  reviewedAt: string | null
  reviewNote: string | null
  discoveredAt: string
}
interface ListData {
  list: DiscoveryRow[]
  total: number
  page: number
  pageSize: number
}

const STATUS_CLASS: Record<DiscStatus, string> = {
  discovered: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  approved: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  rejected: 'bg-red-500/10 text-red-600 dark:text-red-400',
}
const STATUS_LABEL: Record<DiscStatus, string> = {
  discovered: '已发现',
  pending: '待审批',
  approved: '已通过',
  rejected: '已驳回',
}

const EMPTY_SCAN = { providerCode: '', configId: '' }

export default function AdminRelayDiscoveryPage() {
  const locale = useLocale()
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [provider, setProvider] = React.useState('')
  const [status, setStatus] = React.useState<'all' | DiscStatus>('all')
  const [scanOpen, setScanOpen] = React.useState(false)
  const [scanForm, setScanForm] = React.useState(EMPTY_SCAN)
  const [rejectTarget, setRejectTarget] = React.useState<DiscoveryRow | null>(null)
  const [rejectNote, setRejectNote] = React.useState('')

  const qs = React.useMemo(() => {
    const p = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
    if (search) p.set('search', search)
    if (provider) p.set('provider', provider)
    if (status !== 'all') p.set('status', status)
    return p.toString()
  }, [page, search, provider, status])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'relay', 'discovery', qs],
    queryFn: async () => {
      const r = await fetchApi<ListData>(`/api/admin/relay/discovery/pending?${qs}`)
      if (!r.success) throw new Error(r.error)
      return r.data
    },
  })

  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' })

  const scanMutation = useMutation({
    mutationFn: async (body: { providerCode: string; configId: number }) => {
      const r = await fetchApi('/api/admin/relay/discovery/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.success) throw new Error(r.error)
      return r.data as { scanned: number; newDiscovered: number }
    },
    onSuccess: (d) => {
      toast.success(`扫描完成:共 ${d.scanned} 个,新增 ${d.newDiscovered} 个`)
      setScanOpen(false)
      setScanForm(EMPTY_SCAN)
      qc.invalidateQueries({ queryKey: ['admin', 'relay', 'discovery'] })
    },
    onError: (e: Error) => toast.error(e.message || '扫描失败'),
  })

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetchApi(`/api/admin/relay/discovery/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: () => {
      toast.success('已通过审批')
      qc.invalidateQueries({ queryKey: ['admin', 'relay', 'discovery'] })
      qc.invalidateQueries({ queryKey: ['admin', 'relay', 'models'] })
      qc.invalidateQueries({ queryKey: ['admin', 'relay', 'stats'] })
    },
    onError: (e: Error) => toast.error(e.message || '审批失败'),
  })

  const rejectMutation = useMutation({
    mutationFn: async (vars: { id: number; reviewNote: string }) => {
      const r = await fetchApi(`/api/admin/relay/discovery/${vars.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewNote: vars.reviewNote }),
      })
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: () => {
      toast.success('已驳回')
      setRejectTarget(null)
      setRejectNote('')
      qc.invalidateQueries({ queryKey: ['admin', 'relay', 'discovery'] })
    },
    onError: (e: Error) => toast.error(e.message || '驳回失败'),
  })

  const submitScan = (e: React.FormEvent) => {
    e.preventDefault()
    if (!scanForm.providerCode || !scanForm.configId) {
      toast.error('providerCode / configId 必填')
      return
    }
    scanMutation.mutate({
      providerCode: scanForm.providerCode,
      configId: Number(scanForm.configId),
    })
  }

  const submitReject = (e: React.FormEvent) => {
    e.preventDefault()
    if (!rejectTarget || !rejectNote.trim()) {
      toast.error('驳回原因不能为空')
      return
    }
    rejectMutation.mutate({ id: rejectTarget.id, reviewNote: rejectNote })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Activity className="h-6 w-6 text-primary" />
            动态发现审批
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">扫描上游模型清单并审批上架</p>
        </div>
        <Button onClick={() => setScanOpen(true)}>
          <ScanLine className="h-4 w-4" />
          触发扫描
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setPage(1)
              setSearch(e.target.value)
            }}
            placeholder="搜索 modelId / 名称"
            className="pl-8"
          />
        </div>
        <Input
          value={provider}
          onChange={(e) => {
            setPage(1)
            setProvider(e.target.value)
          }}
          placeholder="provider 编码"
          className="h-8 w-36 text-xs"
        />
        <Select
          value={status}
          onValueChange={(v) => {
            setPage(1)
            setStatus(v as 'all' | DiscStatus)
          }}
        >
          <SelectTrigger className={selectClass} aria-label="状态">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="discovered">已发现</SelectItem>
            <SelectItem value="pending">待审批</SelectItem>
            <SelectItem value="approved">已通过</SelectItem>
            <SelectItem value="rejected">已驳回</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50 text-xs uppercase text-muted-foreground [&>tr>th]:whitespace-nowrap">
            <tr>
              <th className="px-3 py-2 text-left">模型</th>
              <th className="px-3 py-2 text-left">厂商</th>
              <th className="px-3 py-2 text-right">上下文</th>
              <th className="px-3 py-2 text-left">能力</th>
              <th className="px-3 py-2 text-left">状态</th>
              <th className="px-3 py-2 text-left">发现时间</th>
              <th className="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={`sk-${i}`} className="border-t border-border">
                  <td colSpan={7} className="px-3 py-2">
                    <Skeleton className="h-6 w-full" />
                  </td>
                </tr>
              ))
            ) : list.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  暂无数据
                </td>
              </tr>
            ) : (
              list.map((d) => (
                <tr key={d.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <div className="font-medium">{d.modelName ?? d.modelId}</div>
                    <div className="text-xs text-muted-foreground">{d.modelId}</div>
                  </td>
                  <td className="px-3 py-2 text-xs">{d.providerCode}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {d.contextLength ? (d.contextLength / 1000).toFixed(0) + 'K' : '-'}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {(d.capabilities ?? []).slice(0, 3).map((c) => (
                        <span
                          key={c}
                          className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                        >
                          {c}
                        </span>
                      ))}
                      {(d.capabilities?.length ?? 0) > 3 && (
                        <span className="text-[10px] text-muted-foreground">
                          +{d.capabilities!.length - 3}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded-md px-2 py-0.5 text-xs ${STATUS_CLASS[d.status]}`}>
                      {STATUS_LABEL[d.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {fmt.format(new Date(d.discoveredAt))}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={
                          approveMutation.isPending || d.status === 'approved' || d.status === 'rejected'
                        }
                        onClick={() => approveMutation.mutate(d.id)}
                        title="审批通过"
                      >
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={rejectMutation.isPending || d.status === 'approved' || d.status === 'rejected'}
                        onClick={() => {
                          setRejectTarget(d)
                          setRejectNote('')
                        }}
                        title="驳回"
                      >
                        <XCircle className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">共 {total} 条</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            <ChevronLeft className="h-4 w-4" />
            上一页
          </Button>
          <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            下一页
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog open={scanOpen} onOpenChange={setScanOpen}>
        <DialogContent>
          <form onSubmit={submitScan} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                触发上游扫描
              </DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="d-provider">Provider 编码</Label>
                <Input
                  id="d-provider"
                  value={scanForm.providerCode}
                  onChange={(e) => setScanForm({ ...scanForm, providerCode: e.target.value })}
                  placeholder="stepfun"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="d-config">Config ID</Label>
                <Input
                  id="d-config"
                  type="number"
                  value={scanForm.configId}
                  onChange={(e) => setScanForm({ ...scanForm, configId: e.target.value })}
                  placeholder="1"
                  required
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              将从 ai-service 拉取上游模型清单,写入 ai_relay_discovery 表(已存在的不会重复)。
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setScanOpen(false)}>
                取消
              </Button>
              <Button type="submit" disabled={scanMutation.isPending}>
                {scanMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                开始扫描
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent>
          <form onSubmit={submitReject} className="space-y-4">
            <DialogHeader>
              <DialogTitle>驳回发现模型</DialogTitle>
            </DialogHeader>
            {rejectTarget && (
              <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                {rejectTarget.modelId} · {rejectTarget.providerCode}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="reject-note">驳回原因</Label>
              <textarea
                id="reject-note"
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder="请填写驳回原因"
                rows={3}
                required
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRejectTarget(null)}>
                取消
              </Button>
              <Button type="submit" disabled={rejectMutation.isPending}>
                {rejectMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                确认驳回
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
