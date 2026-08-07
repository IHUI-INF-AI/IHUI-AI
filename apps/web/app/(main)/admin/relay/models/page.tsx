'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { toast } from 'sonner'
import { Package, Search, ChevronLeft, ChevronRight, Power, Pencil, Loader2 } from 'lucide-react'

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
import { BackButton } from '@/components/common'
import { Tooltip } from '@/components/feedback'

const PAGE_SIZE = 20
const selectClass =
  'h-8 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

interface RelayModel {
  id: number
  configId: number
  modelId: string
  displayName: string | null
  enabled: boolean
  inputPricePer1k: string
  outputPricePer1k: string
  contextLength: number | null
  isRelayPublic: boolean
  relayPriceMultiplier: string | null
  relaySortOrder: number | null
  relayDisplayName: string | null
  updatedAt: string
  providerCode: string
  configName: string
  configEnabled: boolean
}
interface ListData {
  list: RelayModel[]
  total: number
  page: number
  pageSize: number
}
interface EditForm {
  relayPriceMultiplier: string
  relaySortOrder: string
  relayDisplayName: string
}

export default function AdminRelayModelsPage() {
  const locale = useLocale()
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [status, setStatus] = React.useState<'all' | 'public' | 'private'>('all')
  const [provider, setProvider] = React.useState('')
  const [editTarget, setEditTarget] = React.useState<RelayModel | null>(null)
  const [form, setForm] = React.useState<EditForm>({
    relayPriceMultiplier: '1.0000',
    relaySortOrder: '0',
    relayDisplayName: '',
  })

  const qs = React.useMemo(() => {
    const p = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
      status,
    })
    if (search) p.set('search', search)
    if (provider) p.set('provider', provider)
    return p.toString()
  }, [page, search, status, provider])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'relay', 'models', qs],
    queryFn: async () => {
      const r = await fetchApi<ListData>(`/api/admin/relay/models?${qs}`)
      if (!r.success) throw new Error(r.error)
      return r.data
    },
  })

  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' })

  const toggleMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetchApi<{ id: number; isRelayPublic: boolean }>(
        `/api/admin/relay/models/${id}/toggle`,
        { method: 'POST' },
      )
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: (d) => {
      toast.success(d.isRelayPublic ? '已上架' : '已下架')
      qc.invalidateQueries({ queryKey: ['admin', 'relay', 'models'] })
      qc.invalidateQueries({ queryKey: ['admin', 'relay', 'stats'] })
    },
    onError: (e: Error) => toast.error(e.message || '切换失败'),
  })

  const updateMutation = useMutation({
    mutationFn: async (vars: { id: number; body: Record<string, unknown> }) => {
      const r = await fetchApi(`/api/admin/relay/models/${vars.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vars.body),
      })
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: () => {
      toast.success('已更新')
      setEditTarget(null)
      qc.invalidateQueries({ queryKey: ['admin', 'relay', 'models'] })
    },
    onError: (e: Error) => toast.error(e.message || '更新失败'),
  })

  const openEdit = (m: RelayModel) => {
    setEditTarget(m)
    setForm({
      relayPriceMultiplier: m.relayPriceMultiplier ?? '1.0000',
      relaySortOrder: String(m.relaySortOrder ?? 0),
      relayDisplayName: m.relayDisplayName ?? '',
    })
  }

  const submitEdit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editTarget) return
    updateMutation.mutate({
      id: editTarget.id,
      body: {
        relayPriceMultiplier: form.relayPriceMultiplier,
        relaySortOrder: Number(form.relaySortOrder) || 0,
        relayDisplayName: form.relayDisplayName || null,
      },
    })
  }

  return (
    <div className="space-y-4">
      <BackButton />
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Package className="h-6 w-6 text-primary" />
          模型管理
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">中转站模型上下架、定价倍率与展示排序</p>
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
            placeholder="搜索 modelId / 展示名"
            className="pl-8"
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => {
            setPage(1)
            setStatus(v as 'all' | 'public' | 'private')
          }}
        >
          <SelectTrigger className={selectClass} aria-label="状态">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            <SelectItem value="public">已上架</SelectItem>
            <SelectItem value="private">未上架</SelectItem>
          </SelectContent>
        </Select>
        <Input
          value={provider}
          onChange={(e) => {
            setPage(1)
            setProvider(e.target.value)
          }}
          placeholder="provider 编码"
          className="h-8 w-36 text-xs"
        />
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground [&>tr>th]:whitespace-nowrap">
              <tr>
                <th className="px-3 py-2 text-left">模型</th>
                <th className="px-3 py-2 text-left">厂商</th>
                <th className="px-3 py-2 text-right">上下文</th>
                <th className="px-3 py-2 text-right">倍率</th>
                <th className="px-3 py-2 text-right">排序</th>
                <th className="px-3 py-2 text-left">状态</th>
                <th className="px-3 py-2 text-left">更新时间</th>
                <th className="px-3 py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={`sk-${i}`}>
                    <td colSpan={8} className="px-3 py-2">
                      <Skeleton className="h-6 w-full" />
                    </td>
                  </tr>
                ))
              ) : list.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                    暂无数据
                  </td>
                </tr>
              ) : (
                list.map((m) => (
                  <tr key={m.id}>
                    <td className="px-3 py-2">
                      <div className="font-medium">
                        {m.relayDisplayName || m.displayName || m.modelId}
                      </div>
                      <div className="text-xs text-muted-foreground">{m.modelId}</div>
                    </td>
                    <td className="px-3 py-2 text-xs">{m.providerCode}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {m.contextLength ? (m.contextLength / 1000).toFixed(0) + 'K' : '-'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {m.relayPriceMultiplier ?? '1.0000'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{m.relaySortOrder ?? 0}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs ${
                          m.isRelayPublic
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {m.isRelayPublic ? '已上架' : '未上架'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {fmt.format(new Date(m.updatedAt))}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <Tooltip content="编辑">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(m)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </Tooltip>
                        <Tooltip content={m.isRelayPublic ? '下架' : '上架'}>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={toggleMutation.isPending}
                            onClick={() => toggleMutation.mutate(m.id)}
                          >
                            <Power className="h-4 w-4" />
                          </Button>
                        </Tooltip>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent>
          <form onSubmit={submitEdit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>编辑中转站模型</DialogTitle>
            </DialogHeader>
            {editTarget && (
              <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                {editTarget.modelId} · {editTarget.providerCode}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="m-multi">定价倍率</Label>
                <Input
                  id="m-multi"
                  value={form.relayPriceMultiplier}
                  onChange={(e) => setForm({ ...form, relayPriceMultiplier: e.target.value })}
                  placeholder="1.0000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="m-sort">排序</Label>
                <Input
                  id="m-sort"
                  type="number"
                  value={form.relaySortOrder}
                  onChange={(e) => setForm({ ...form, relaySortOrder: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="m-name">展示名(留空用默认)</Label>
              <Input
                id="m-name"
                value={form.relayDisplayName}
                onChange={(e) => setForm({ ...form, relayDisplayName: e.target.value })}
                placeholder="可选"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>
                取消
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                保存
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
