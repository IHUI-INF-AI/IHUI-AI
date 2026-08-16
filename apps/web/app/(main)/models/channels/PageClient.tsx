'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  Cable,
  Plus,
  Pencil,
  Trash2,
  Activity,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Switch,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@ihui/ui-react'
import { Tooltip } from '@/components/feedback'
import { Skeleton } from '@/components/ui/skeleton'
import { BackButton } from '@/components/common'
import {
  fetchKeyPool,
  toggleKeyPool,
  deleteKeyPool,
  checkKeyPoolHealth,
  type RelayKeyPoolItem,
  type RelayKeyPoolHealthStatus,
} from './channels-api'
import ChannelFormDialog from './ChannelFormDialog'

const PAGE_SIZE = 10

const HEALTH_BADGE: Record<RelayKeyPoolHealthStatus, { label: string; cls: string }> = {
  healthy: { label: '健康', cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  degraded: { label: '降级', cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  down: { label: '异常', cls: 'bg-red-500/10 text-red-600 dark:text-red-400' },
  unknown: { label: '未知', cls: 'bg-muted text-muted-foreground' },
}

type EnabledFilter = 'all' | 'true' | 'false'

function timeFmt(value: string | null): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export default function PageClient() {
  const t = useTranslations('models')
  const qc = useQueryClient()

  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [provider, setProvider] = React.useState('')
  const [enabled, setEnabled] = React.useState<EnabledFilter>('all')

  const [formOpen, setFormOpen] = React.useState(false)
  const [formMode, setFormMode] = React.useState<'create' | 'edit'>('create')
  const [editItem, setEditItem] = React.useState<RelayKeyPoolItem | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<RelayKeyPoolItem | null>(null)

  const queryParams = {
    page,
    pageSize: PAGE_SIZE,
    search: search || undefined,
    provider: provider || undefined,
    enabled: enabled === 'all' ? undefined : enabled === 'true',
  }

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'relay', 'key-pool', queryParams],
    queryFn: () => fetchKeyPool(queryParams),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'relay', 'key-pool'] })

  const toggleMut = useMutation({
    mutationFn: (id: string) => toggleKeyPool(id),
    onSuccess: () => {
      toast.success('已切换启用状态')
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteKeyPool(id),
    onSuccess: () => {
      toast.success('渠道已删除')
      setDeleteTarget(null)
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const healthMut = useMutation({
    mutationFn: (id: string) => checkKeyPoolHealth(id),
    onSuccess: () => {
      toast.success('健康检查完成')
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const openCreate = () => {
    setFormMode('create')
    setEditItem(null)
    setFormOpen(true)
  }
  const openEdit = (item: RelayKeyPoolItem) => {
    setFormMode('edit')
    setEditItem(item)
    setFormOpen(true)
  }

  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    refetch()
  }

  return (
    <div className="space-y-4 px-4 py-6">
      <BackButton />
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">{t('channels.title')}</h1>
          <p className="text-xs text-muted-foreground">{t('channels.subtitle')}</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" />
          {t('channels.create')}
        </Button>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Cable className="h-4 w-4 text-primary" />
            {t('channels.listTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 px-0">
          {/* 筛选条 */}
          <div className="flex flex-wrap items-center gap-2 px-4">
            <form onSubmit={submitSearch} className="flex items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="搜索名称/供应商/Key 前缀..."
                  className="h-8 w-60 pl-8 text-xs"
                />
              </div>
              <Button type="submit" variant="outline" size="sm" className="h-8">
                搜索
              </Button>
            </form>
            <Input
              value={provider}
              onChange={(e) => {
                setProvider(e.target.value)
                setPage(1)
              }}
              placeholder="供应商代码"
              className="h-8 w-32 text-xs"
            />
            <Select
              value={enabled}
              onValueChange={(v) => {
                setEnabled(v as EnabledFilter)
                setPage(1)
              }}
            >
              <SelectTrigger className="h-8 w-28 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="true">已启用</SelectItem>
                <SelectItem value="false">已禁用</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 表格 */}
          {isLoading ? (
            <div className="px-4">
              <Skeleton variant="table-row" rows={5} />
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <p className="text-sm text-destructive">
                {error instanceof Error ? error.message : '加载失败'}
              </p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                重试
              </Button>
            </div>
          ) : list.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <Cable className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">暂无渠道,点击右上角新建</p>
              <Button variant="outline" size="sm" onClick={openCreate}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                {t('channels.create')}
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2 font-medium">{t('channels.table.provider')}</th>
                    <th className="px-4 py-2 font-medium">{t('channels.table.name')}</th>
                    <th className="px-4 py-2 font-medium">Key 前缀</th>
                    <th className="px-4 py-2 font-medium">{t('channels.table.priority')}</th>
                    <th className="px-4 py-2 font-medium">{t('channels.table.weight')}</th>
                    <th className="px-4 py-2 font-medium">健康</th>
                    <th className="px-4 py-2 font-medium">{t('channels.table.status')}</th>
                    <th className="px-4 py-2 text-right font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((item) => {
                    const h = HEALTH_BADGE[item.healthStatus]
                    return (
                      <tr key={item.id} className="text-xs hover:bg-muted/30">
                        <td className="px-4 py-2.5 font-mono text-muted-foreground">
                          {item.providerCode}
                        </td>
                        <td className="px-4 py-2.5 font-medium">{item.name}</td>
                        <td className="px-4 py-2.5 font-mono text-muted-foreground">
                          {item.keyPrefix ?? '***'}
                        </td>
                        <td className="px-4 py-2.5 tabular-nums">{item.priority}</td>
                        <td className="px-4 py-2.5 tabular-nums">{item.weight}</td>
                        <td className="px-4 py-2.5">
                          <Tooltip content={item.lastErrorMessage ?? undefined}>
                            <span
                              className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium ${h.cls}`}
                            >
                              {h.label}
                            </span>
                          </Tooltip>
                          <span className="ml-1 text-[10px] text-muted-foreground">
                            {timeFmt(item.healthCheckedAt)}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <Switch
                            checked={item.isEnabled}
                            onCheckedChange={() => toggleMut.mutate(item.id)}
                            disabled={toggleMut.isPending}
                            size="sm"
                            aria-label="切换启用状态"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => openEdit(item)}
                              aria-label="编辑"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => healthMut.mutate(item.id)}
                              disabled={healthMut.isPending}
                              aria-label="健康检查"
                            >
                              <Activity className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              onClick={() => setDeleteTarget(item)}
                              aria-label="删除"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* 分页 */}
          {!isLoading && !isError && total > 0 && (
            <div className="flex items-center justify-between px-4 pt-1 text-xs text-muted-foreground">
              <span>共 {total} 条</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  aria-label="上一页"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="tabular-nums">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  aria-label="下一页"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ChannelFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        item={editItem}
        onSuccess={invalidate}
      />

      <Dialog open={deleteTarget !== null} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>删除渠道</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `确认删除「${deleteTarget.name}」?此操作不可撤销。`
                : '确认删除此渠道?'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeleteTarget(null)}
              disabled={deleteMut.isPending}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={deleteMut.isPending}
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
            >
              {deleteMut.isPending ? '删除中…' : '删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
