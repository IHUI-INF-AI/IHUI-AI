// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { toast } from 'sonner'
import { fetchApi } from '@/lib/api'
import {
  Button,
  ChevronLeft,
  ChevronRight,
  Copy,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Loader2,
  Pencil,
  Power,
  RefreshCw,
  SearchInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Plus,
  Trash2,
  Users,
} from '@ihui/ui-react'
import { Skeleton } from '@/components/ui/skeleton'
import { BackButton } from '@/components/common'
import { Tooltip } from '@/components/feedback'

const PAGE_SIZE = 20
const selectClass =
  'h-8 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
const textareaClass =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono text-xs'

const PROVIDER_OPTIONS = ['trae', 'workbuddy', 'codearts'] as const
type ProviderCode = (typeof PROVIDER_OPTIONS)[number]

interface AccountRow {
  id: number
  providerCode: string
  uid: string | null
  name: string
  deviceId: string | null
  machineId: string | null
  tokenExpiresAt: string | null
  refreshExpiresAt: string | null
  priority: number
  weight: number
  isEnabled: boolean
  tempUnschedulable: boolean
  healthStatus: string
  healthCheckedAt: string | null
  lastErrorMessage: string | null
  lastUsedAt: string | null
  lastRefreshAt: string | null
  refreshFailureCount: number
  consecutiveFailures: number
  hasProxy: boolean
  totalCalls: number
  extraMetadata: unknown
  createdAt: string
  updatedAt: string
}
interface ListData {
  list: AccountRow[]
  total: number
  page: number
  pageSize: number
}
interface ImportItem {
  index: number
  name: string | null
  uid: string | null
  status: 'imported' | 'updated' | 'skipped' | 'failed'
  reason?: string
}
interface ImportResult {
  providerCode: string
  total: number
  imported: number
  updated: number
  skipped: number
  failed: number
  items: ImportItem[]
}

const HEALTH_CLASS: Record<string, string> = {
  unknown: 'bg-muted text-muted-foreground',
  healthy: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  degraded: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  down: 'bg-red-500/10 text-red-600 dark:text-red-400',
}
const HEALTH_LABEL: Record<string, string> = {
  unknown: '未知',
  healthy: '健康',
  degraded: '降级',
  down: '异常',
}

const IMPORT_STATUS_LABEL: Record<string, string> = {
  imported: '新增',
  updated: '更新',
  skipped: '跳过',
  failed: '失败',
}

const EXAMPLE_JSON = `[
  {
    "name": "账号A",
    "token": "eyJ...",
    "refreshToken": "eyJ...",
    "deviceId": "...",
    "machineId": "...",
    "enabled": true,
    "cookies": "..."
  }
]`

export default function AdminRelayAccountPoolPage() {
  const locale = useLocale()
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [provider, setProvider] = React.useState('')
  const [enabled, setEnabled] = React.useState<'all' | 'true' | 'false'>('all')
  const [health, setHealth] = React.useState<'all' | 'unknown' | 'healthy' | 'degraded' | 'down'>(
    'all',
  )
  const [importOpen, setImportOpen] = React.useState(false)
  const [importProvider, setImportProvider] = React.useState<ProviderCode | ''>('')
  const [importText, setImportText] = React.useState('')
  const [importResult, setImportResult] = React.useState<ImportResult | null>(null)
  const [editing, setEditing] = React.useState<AccountRow | null>(null)
  const [editForm, setEditForm] = React.useState({
    name: '',
    priority: '0',
    weight: '1',
    tempUnschedulable: false,
    proxyUrl: '',
  })

  const qs = React.useMemo(() => {
    const p = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
    if (search) p.set('search', search)
    if (provider) p.set('provider', provider)
    if (enabled !== 'all') p.set('enabled', enabled)
    if (health !== 'all') p.set('health', health)
    return p.toString()
  }, [page, search, provider, enabled, health])

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin', 'relay', 'account-pool', qs],
    queryFn: async () => {
      const r = await fetchApi<ListData>(`/api/admin/relay/accounts?${qs}`)
      if (!r.success) throw new Error(r.error)
      return r.data
    },
  })

  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'relay', 'account-pool'] })

  const toggleMut = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetchApi<{ id: number; isEnabled: boolean }>(
        `/api/admin/relay/accounts/${id}/toggle`,
        { method: 'POST' },
      )
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: (d) => {
      toast.success(d.isEnabled ? '已启用' : '已禁用')
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message || '操作失败'),
  })

  const healthMut = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetchApi<{ id: number; ok: boolean; error: string | null }>(
        `/api/admin/relay/accounts/${id}/health`,
        { method: 'POST' },
      )
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: (d) => {
      if (d.ok) toast.success('健康检查通过')
      else toast.error(`健康检查异常:${d.error ?? '未知错误'}`)
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message || '健康检查失败'),
  })

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetchApi<{ id: number }>(`/api/admin/relay/accounts/${id}`, {
        method: 'DELETE',
      })
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: () => {
      toast.success('已删除')
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message || '删除失败'),
  })

  const editMut = useMutation({
    mutationFn: async (vars: { id: number; body: Record<string, unknown> }) => {
      const r = await fetchApi<{ id: number }>(`/api/admin/relay/accounts/${vars.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vars.body),
      })
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: () => {
      toast.success('已保存')
      setEditing(null)
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message || '保存失败'),
  })

  const importMut = useMutation({
    mutationFn: async (body: { providerCode: string; accounts: unknown[] }) => {
      const r = await fetchApi<ImportResult>('/api/admin/relay/accounts/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: (d) => {
      setImportResult(d)
      toast.success(
        `导入完成:新增 ${d.imported} / 更新 ${d.updated} / 跳过 ${d.skipped} / 失败 ${d.failed}`,
      )
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message || '导入失败'),
  })

  const openEdit = (k: AccountRow) => {
    setEditing(k)
    setEditForm({
      name: k.name,
      priority: String(k.priority),
      weight: String(k.weight),
      tempUnschedulable: k.tempUnschedulable,
      proxyUrl: '',
    })
  }

  const submitEdit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing) return
    if (!editForm.name.trim()) {
      toast.error('名称必填')
      return
    }
    const body: Record<string, unknown> = {
      name: editForm.name.trim(),
      priority: Number(editForm.priority) || 0,
      weight: Number(editForm.weight) || 1,
      tempUnschedulable: editForm.tempUnschedulable,
    }
    const proxy = editForm.proxyUrl.trim()
    body.proxyUrl = proxy ? proxy : null
    editMut.mutate({ id: editing.id, body })
  }

  const submitImport = (e: React.FormEvent) => {
    e.preventDefault()
    if (!importProvider) {
      toast.error('请选择平台')
      return
    }
    const raw = importText.trim()
    if (!raw) {
      toast.error('请粘贴账号导出 JSON')
      return
    }
    let accounts: unknown[]
    try {
      const parsed: unknown = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        accounts = parsed
      } else if (
        parsed &&
        typeof parsed === 'object' &&
        Array.isArray((parsed as { accounts?: unknown }).accounts)
      ) {
        accounts = (parsed as { accounts: unknown[] }).accounts
      } else {
        toast.error('JSON 需为账号数组或 { accounts: [...] } 整包')
        return
      }
    } catch {
      toast.error('JSON 解析失败,请检查格式')
      return
    }
    if (accounts.length === 0) {
      toast.error('accounts 为空')
      return
    }
    if (accounts.length > 500) {
      toast.error(`单次最多导入 500 条,当前 ${accounts.length} 条`)
      return
    }
    importMut.mutate({ providerCode: importProvider, accounts })
  }

  const copyUid = (uid: string) => {
    navigator.clipboard?.writeText(uid).then(
      () => toast.success('已复制 uid'),
      () => toast.error('复制失败'),
    )
  }

  const closeImport = () => {
    setImportOpen(false)
    setImportResult(null)
    setImportText('')
    setImportProvider('')
  }

  return (
    <div className="space-y-4 px-4 py-4">
      <BackButton />
      <div className="flex items-end justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Users className="h-6 w-6 text-primary" />
            账号池管理
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            第三方 AI IDE 账号导入、调度与健康检查
          </p>
        </div>
        <Button onClick={() => setImportOpen(true)}>
          <Plus className="h-4 w-4" />
          导入账号
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={search}
          onChange={(e) => {
            setPage(1)
            setSearch(e.target.value)
          }}
          placeholder="搜索 name / uid / deviceId"
          wrapperClassName="max-w-xs flex-1"
        />
        <Select
          value={provider || 'all'}
          onValueChange={(v) => {
            setPage(1)
            setProvider(v === 'all' ? '' : v)
          }}
        >
          <SelectTrigger className={selectClass} aria-label="平台">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部平台</SelectItem>
            {PROVIDER_OPTIONS.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
        <Select
          value={health}
          onValueChange={(v) => {
            setPage(1)
            setHealth(v as typeof health)
          }}
        >
          <SelectTrigger className={selectClass} aria-label="健康状态">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部健康</SelectItem>
            <SelectItem value="unknown">未知</SelectItem>
            <SelectItem value="healthy">健康</SelectItem>
            <SelectItem value="degraded">降级</SelectItem>
            <SelectItem value="down">异常</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground [&>tr>th]:whitespace-nowrap">
              <tr>
                <th className="px-3 py-2 text-left">名称</th>
                <th className="px-3 py-2 text-left">平台</th>
                <th className="px-3 py-2 text-left">uid</th>
                <th className="px-3 py-2 text-left">健康</th>
                <th className="px-3 py-2 text-left">token 到期</th>
                <th className="px-3 py-2 text-right">优先级</th>
                <th className="px-3 py-2 text-right">权重</th>
                <th className="px-3 py-2 text-right">累计调用</th>
                <th className="px-3 py-2 text-right">连续失败</th>
                <th className="px-3 py-2 text-right">刷新失败</th>
                <th className="px-3 py-2 text-left">代理</th>
                <th className="px-3 py-2 text-left">最近使用</th>
                <th className="px-3 py-2 text-left">启用</th>
                <th className="px-3 py-2 text-left">摘除</th>
                <th className="px-3 py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={`sk-${i}`}>
                    <td colSpan={15} className="px-3 py-2">
                      <Skeleton className="h-6 w-full" />
                    </td>
                  </tr>
                ))
              ) : isError ? (
                <tr>
                  <td colSpan={15} className="px-3 py-8 text-center text-red-500">
                    加载失败:{error instanceof Error ? error.message : '未知错误'}
                  </td>
                </tr>
              ) : list.length === 0 ? (
                <tr>
                  <td colSpan={15} className="px-3 py-8 text-center text-muted-foreground">
                    暂无数据
                  </td>
                </tr>
              ) : (
                list.map((k) => {
                  const expMs = k.tokenExpiresAt ? new Date(k.tokenExpiresAt).getTime() : null
                  const now = Date.now()
                  const expiringSoon = expMs !== null && expMs - now < 24 * 3600 * 1000
                  const expired = expMs !== null && expMs <= now
                  return (
                    <tr key={k.id}>
                      <td className="px-3 py-2">
                        <div className="font-medium">{k.name}</div>
                        {k.lastErrorMessage && (
                          <div
                            className="max-w-[16rem] truncate text-xs text-red-500"
                            title={k.lastErrorMessage}
                          >
                            {k.lastErrorMessage}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs">{k.providerCode}</td>
                      <td className="px-3 py-2">
                        {k.uid ? (
                          <div className="flex items-center gap-1">
                            <span className="font-mono text-xs" title={k.uid}>
                              {k.uid.length > 12 ? `${k.uid.slice(0, 8)}…` : k.uid}
                            </span>
                            <Tooltip content="复制 uid">
                              <span className="inline-flex">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0"
                                  onClick={() => copyUid(k.uid!)}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </span>
                            </Tooltip>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded-md px-2 py-0.5 text-xs ${
                            HEALTH_CLASS[k.healthStatus] ?? HEALTH_CLASS.unknown
                          }`}
                        >
                          {HEALTH_LABEL[k.healthStatus] ?? k.healthStatus}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {expMs !== null ? (
                          <span
                            className={
                              expired
                                ? 'font-medium text-red-600 dark:text-red-400'
                                : expiringSoon
                                  ? 'font-medium text-amber-600 dark:text-amber-400'
                                  : 'text-muted-foreground'
                            }
                          >
                            {fmt.format(new Date(k.tokenExpiresAt!))}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{k.priority}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{k.weight}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{k.totalCalls}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{k.consecutiveFailures}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{k.refreshFailureCount}</td>
                      <td className="px-3 py-2 text-xs">{k.hasProxy ? '是' : '否'}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {k.lastUsedAt ? fmt.format(new Date(k.lastUsedAt)) : '-'}
                      </td>
                      <td className="px-3 py-2">
                        <Switch
                          checked={k.isEnabled}
                          disabled={toggleMut.isPending}
                          onCheckedChange={() => toggleMut.mutate(k.id)}
                          aria-label={`${k.name} 启用开关`}
                        />
                      </td>
                      <td className="px-3 py-2">
                        {k.tempUnschedulable ? (
                          <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-xs text-amber-600 dark:text-amber-400">
                            已摘除
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip content="健康检查">
                            <span className="inline-flex">
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={healthMut.isPending}
                                onClick={() => healthMut.mutate(k.id)}
                              >
                                {healthMut.isPending && healthMut.variables === k.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-4 w-4" />
                                )}
                              </Button>
                            </span>
                          </Tooltip>
                          <Tooltip content="切换启用">
                            <span className="inline-flex">
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={toggleMut.isPending}
                                onClick={() => toggleMut.mutate(k.id)}
                              >
                                <Power className="h-4 w-4" />
                              </Button>
                            </span>
                          </Tooltip>
                          <Tooltip content="编辑">
                            <span className="inline-flex">
                              <Button size="sm" variant="ghost" onClick={() => openEdit(k)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </span>
                          </Tooltip>
                          <Tooltip content="删除">
                            <span className="inline-flex">
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={deleteMut.isPending}
                                onClick={() => {
                                  if (confirm(`删除账号 "${k.name}"?`)) {
                                    deleteMut.mutate(k.id)
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </span>
                          </Tooltip>
                        </div>
                      </td>
                    </tr>
                  )
                })
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

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <form onSubmit={submitEdit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>编辑账号{editing ? `:${editing.name}` : ''}</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="a-name">名称</Label>
              <Input
                id="a-name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="a-priority">优先级</Label>
                <Input
                  id="a-priority"
                  type="number"
                  value={editForm.priority}
                  onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="a-weight">权重</Label>
                <Input
                  id="a-weight"
                  type="number"
                  min="1"
                  value={editForm.weight}
                  onChange={(e) => setEditForm({ ...editForm, weight: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="a-temp"
                checked={editForm.tempUnschedulable}
                onCheckedChange={(v) => setEditForm({ ...editForm, tempUnschedulable: v })}
              />
              <Label htmlFor="a-temp" className="text-sm text-muted-foreground">
                临时摘除(暂不参与调度)
              </Label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="a-proxy">代理地址</Label>
              <Input
                id="a-proxy"
                value={editForm.proxyUrl}
                onChange={(e) => setEditForm({ ...editForm, proxyUrl: e.target.value })}
                placeholder="http://127.0.0.1:7890(留空则清除)"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                取消
              </Button>
              <Button type="submit" disabled={editMut.isPending}>
                {editMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                保存
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={(o) => !o && closeImport()}>
        <DialogContent className="max-w-2xl">
          <form onSubmit={submitImport} className="space-y-4">
            <DialogHeader>
              <DialogTitle>导入账号</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>平台</Label>
                <Select
                  value={importProvider || 'none'}
                  onValueChange={(v) => v !== 'none' && setImportProvider(v as ProviderCode)}
                >
                  <SelectTrigger aria-label="导入平台">
                    <SelectValue placeholder="选择平台" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" disabled>
                      选择平台
                    </SelectItem>
                    {PROVIDER_OPTIONS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="a-import-json">账号导出 JSON</Label>
              <textarea
                id="a-import-json"
                rows={10}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder='支持整包 { "accounts": [...] } 或裸数组 [ ... ]'
                className={textareaClass}
              />
              <p className="text-xs text-muted-foreground">
                字段:name / token / refreshToken / deviceId / machineId / enabled / cookies(proxyUrl
                可选)。示例:
              </p>
              <pre className="max-h-40 overflow-auto rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
                {EXAMPLE_JSON}
              </pre>
            </div>
            {importResult && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-muted-foreground">
                    导入结果(共 {importResult.total} 条):
                  </span>
                  <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-emerald-600 dark:text-emerald-400">
                    新增 {importResult.imported}
                  </span>
                  <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-blue-600 dark:text-blue-400">
                    更新 {importResult.updated}
                  </span>
                  <span className="rounded-md bg-muted px-2 py-0.5 text-muted-foreground">
                    跳过 {importResult.skipped}
                  </span>
                  <span className="rounded-md bg-red-500/10 px-2 py-0.5 text-red-600 dark:text-red-400">
                    失败 {importResult.failed}
                  </span>
                </div>
                <div className="max-h-60 overflow-auto rounded-md border border-border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 text-muted-foreground">
                      <tr>
                        <th className="px-2 py-1 text-left">#</th>
                        <th className="px-2 py-1 text-left">名称</th>
                        <th className="px-2 py-1 text-left">uid</th>
                        <th className="px-2 py-1 text-left">状态</th>
                        <th className="px-2 py-1 text-left">原因</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importResult.items.map((it) => (
                        <tr
                          key={it.index}
                          className={
                            it.status === 'failed'
                              ? 'bg-red-500/5 text-red-600 dark:text-red-400'
                              : ''
                          }
                        >
                          <td className="px-2 py-1 tabular-nums">{it.index}</td>
                          <td className="px-2 py-1">{it.name ?? '-'}</td>
                          <td className="px-2 py-1 font-mono">{it.uid ?? '-'}</td>
                          <td className="px-2 py-1">
                            {IMPORT_STATUS_LABEL[it.status] ?? it.status}
                          </td>
                          <td
                            className="max-w-[16rem] truncate px-2 py-1"
                            title={it.reason ?? undefined}
                          >
                            {it.reason ?? '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeImport}>
                关闭
              </Button>
              <Button type="submit" disabled={importMut.isPending}>
                {importMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                提交导入
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
