'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { toast } from 'sonner'
import {
  KeyRound,
  Search,
  ChevronLeft,
  ChevronRight,
  Power,
  RefreshCw,
  Trash2,
  Plus,
  Loader2,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import {
  Button,
  Input,
  Label,
  Switch,
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

interface KeyRow {
  id: number
  providerCode: string
  name: string
  keyPrefix: string
  priority: number
  weight: number
  isEnabled: boolean
  healthStatus: string | null
  healthCheckedAt: string | null
  balanceCents: number | null
  remark: string | null
  updatedAt: string
}
interface ListData {
  list: KeyRow[]
  total: number
  page: number
  pageSize: number
}

const HEALTH_CLASS: Record<string, string> = {
  healthy: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  degraded: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  down: 'bg-red-500/10 text-red-600 dark:text-red-400',
}

const EMPTY_FORM = {
  providerCode: '',
  name: '',
  apiKey: '',
  priority: '0',
  weight: '1',
  isEnabled: true,
  remark: '',
}

export default function AdminRelayKeyPoolPage() {
  const locale = useLocale()
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [provider, setProvider] = React.useState('')
  const [enabled, setEnabled] = React.useState<'all' | 'true' | 'false'>('all')
  const [addOpen, setAddOpen] = React.useState(false)
  const [form, setForm] = React.useState(EMPTY_FORM)

  const qs = React.useMemo(() => {
    const p = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
    if (search) p.set('search', search)
    if (provider) p.set('provider', provider)
    if (enabled !== 'all') p.set('enabled', enabled)
    return p.toString()
  }, [page, search, provider, enabled])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'relay', 'key-pool', qs],
    queryFn: async () => {
      const r = await fetchApi<ListData>(`/api/admin/relay/key-pool?${qs}`)
      if (!r.success) throw new Error(r.error)
      return r.data
    },
  })

  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' })

  const act = useMutation({
    mutationFn: async (vars: { url: string; method: string }) => {
      const r = await fetchApi(vars.url, { method: vars.method })
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onMutate: (vars) => {
      const action = vars.url.includes('/toggle')
        ? '已切换'
        : vars.url.includes('/health')
          ? '健康检查完成'
          : '已删除'
      return { action }
    },
    onSuccess: (_d, _v, ctx) => {
      toast.success(ctx?.action ?? '操作成功')
      qc.invalidateQueries({ queryKey: ['admin', 'relay', 'key-pool'] })
    },
    onError: (e: Error) => toast.error(e.message || '操作失败'),
  })

  const addMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const r = await fetchApi('/api/admin/relay/key-pool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: () => {
      toast.success('已添加')
      setAddOpen(false)
      setForm(EMPTY_FORM)
      qc.invalidateQueries({ queryKey: ['admin', 'relay', 'key-pool'] })
    },
    onError: (e: Error) => toast.error(e.message || '添加失败'),
  })

  const submitAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.providerCode || !form.name || !form.apiKey) {
      toast.error('providerCode / name / apiKey 必填')
      return
    }
    addMutation.mutate({
      providerCode: form.providerCode,
      name: form.name,
      apiKey: form.apiKey,
      priority: Number(form.priority) || 0,
      weight: Number(form.weight) || 1,
      isEnabled: form.isEnabled,
      remark: form.remark || undefined,
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <KeyRound className="h-6 w-6 text-primary" />
            Key 池管理
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">上游 API Key 调度、健康检查与余额监控</p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" />
          添加 Key
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
            placeholder="搜索 name / provider / keyPrefix"
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
          value={enabled}
          onValueChange={(v) => {
            setPage(1)
            setEnabled(v as 'all' | 'true' | 'false')
          }}
        >
          <SelectTrigger className={selectClass} aria-label="启用状态">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            <SelectItem value="true">已启用</SelectItem>
            <SelectItem value="false">已禁用</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50 text-xs uppercase text-muted-foreground [&>tr>th]:whitespace-nowrap">
            <tr>
              <th className="px-3 py-2 text-left">名称</th>
              <th className="px-3 py-2 text-left">Provider</th>
              <th className="px-3 py-2 text-left">Key 前缀</th>
              <th className="px-3 py-2 text-right">优先级</th>
              <th className="px-3 py-2 text-right">权重</th>
              <th className="px-3 py-2 text-left">启用</th>
              <th className="px-3 py-2 text-left">健康</th>
              <th className="px-3 py-2 text-right">余额(¥)</th>
              <th className="px-3 py-2 text-left">更新</th>
              <th className="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={`sk-${i}`} className="border-t border-border">
                  <td colSpan={10} className="px-3 py-2">
                    <Skeleton className="h-6 w-full" />
                  </td>
                </tr>
              ))
            ) : list.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">
                  暂无数据
                </td>
              </tr>
            ) : (
              list.map((k) => (
                <tr key={k.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <div className="font-medium">{k.name}</div>
                    {k.remark && <div className="text-xs text-muted-foreground">{k.remark}</div>}
                  </td>
                  <td className="px-3 py-2 text-xs">{k.providerCode}</td>
                  <td className="px-3 py-2 font-mono text-xs">{k.keyPrefix}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{k.priority}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{k.weight}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs ${
                        k.isEnabled
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {k.isEnabled ? '启用' : '禁用'}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs ${
                        HEALTH_CLASS[k.healthStatus ?? 'unknown'] ?? 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {k.healthStatus ?? 'unknown'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {k.balanceCents !== null && k.balanceCents !== undefined ? (k.balanceCents / 100).toFixed(2) : '-'}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {k.updatedAt ? fmt.format(new Date(k.updatedAt)) : '-'}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={act.isPending}
                        onClick={() =>
                          act.mutate({ url: `/api/admin/relay/key-pool/${k.id}/health`, method: 'POST' })
                        }
                        title="健康检查"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={act.isPending}
                        onClick={() =>
                          act.mutate({ url: `/api/admin/relay/key-pool/${k.id}/toggle`, method: 'POST' })
                        }
                        title="切换启用"
                      >
                        <Power className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={act.isPending}
                        onClick={() => {
                          if (confirm(`删除 Key "${k.name}"?`)) {
                            act.mutate({ url: `/api/admin/relay/key-pool/${k.id}`, method: 'DELETE' })
                          }
                        }}
                        title="删除"
                      >
                        <Trash2 className="h-4 w-4" />
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

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <form onSubmit={submitAdd} className="space-y-4">
            <DialogHeader>
              <DialogTitle>添加 Key</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="k-provider">Provider 编码</Label>
                <Input
                  id="k-provider"
                  value={form.providerCode}
                  onChange={(e) => setForm({ ...form, providerCode: e.target.value })}
                  placeholder="stepfun"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="k-name">名称</Label>
                <Input
                  id="k-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="主账号"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="k-key">API Key</Label>
              <Input
                id="k-key"
                type="password"
                value={form.apiKey}
                onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                placeholder="sk-..."
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="k-priority">优先级</Label>
                <Input
                  id="k-priority"
                  type="number"
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="k-weight">权重</Label>
                <Input
                  id="k-weight"
                  type="number"
                  min="1"
                  value={form.weight}
                  onChange={(e) => setForm({ ...form, weight: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="k-enabled"
                checked={form.isEnabled}
                onCheckedChange={(v) => setForm({ ...form, isEnabled: v })}
              />
              <Label htmlFor="k-enabled" className="text-sm text-muted-foreground">
                {form.isEnabled ? '启用' : '禁用'}
              </Label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="k-remark">备注</Label>
              <Input
                id="k-remark"
                value={form.remark}
                onChange={(e) => setForm({ ...form, remark: e.target.value })}
                placeholder="可选"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                取消
              </Button>
              <Button type="submit" disabled={addMutation.isPending}>
                {addMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                添加
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
