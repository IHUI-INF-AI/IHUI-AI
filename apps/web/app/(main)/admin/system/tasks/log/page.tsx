'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Loader2,
  ScrollText,
  Trash2,
  Eraser,
  Download,
  Search,
  Eye,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import {
  Button,
  Input,
  Label,
  Checkbox,
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
import { HasPermi } from '@/components/auth/HasPermi'
import { exportFromApi } from '@/lib/export-utils'
import { cn } from '@/lib/utils'

interface JobLog {
  id: string
  jobName: string
  jobGroup: string
  invokeTarget: string
  jobMessage: string
  status: number
  exceptionInfo: string
  startTime: string
  stopTime: string
  costTime: number
}

interface ListResp {
  list: JobLog[]
  total: number
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const RESOURCE = '/api/admin/system/tasks/logs'
const th = 'px-4 py-2.5 text-left font-medium text-xs uppercase text-muted-foreground'
const inputCls =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
const STATUS_LABEL: Record<number, { label: string; cls: string }> = {
  0: { label: '成功', cls: 'bg-emerald-500/10 text-emerald-600' },
  1: { label: '失败', cls: 'bg-red-500/10 text-red-600' },
}

export default function JobLogPage() {
  const qc = useQueryClient()
  const [search, setSearch] = React.useState({ jobName: '', jobGroup: '', status: '' })
  const [applied, setApplied] = React.useState({ jobName: '', jobGroup: '', status: '' })
  const [page, setPage] = React.useState(1)
  const [sort, setSort] = React.useState<{ col: string; dir: 'asc' | 'desc' }>({
    col: 'startTime',
    dir: 'desc',
  })
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [detail, setDetail] = React.useState<JobLog | null>(null)
  const pageSize = 15

  const params = React.useMemo(() => {
    const qs = new URLSearchParams()
    qs.set('page', String(page))
    qs.set('pageSize', String(pageSize))
    if (applied.jobName) qs.set('jobName', applied.jobName)
    if (applied.jobGroup) qs.set('jobGroup', applied.jobGroup)
    if (applied.status) qs.set('status', applied.status)
    qs.set('orderByColumn', sort.col)
    qs.set('isAsc', sort.dir)
    return qs.toString()
  }, [page, applied, sort])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'job-logs', params],
    queryFn: () => api<ListResp>(`${RESOURCE}?${params}`),
  })
  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const delMut = useMutation({
    mutationFn: (ids: string[]) =>
      api(RESOURCE, { method: 'DELETE', body: JSON.stringify({ ids }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'job-logs'] })
      toast.success('删除成功')
      setSelected(new Set())
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const cleanMut = useMutation({
    mutationFn: () => api(`${RESOURCE}/clean`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'job-logs'] })
      toast.success('清空成功')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const handleSearch = () => {
    setPage(1)
    setApplied(search)
  }
  const handleReset = () => {
    setSearch({ jobName: '', jobGroup: '', status: '' })
    setApplied({ jobName: '', jobGroup: '', status: '' })
    setPage(1)
  }
  const toggleAll = () =>
    setSelected(selected.size === list.length ? new Set() : new Set(list.map((l) => l.id)))
  const toggleOne = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setSelected(next)
  }
  const handleSort = (col: string) =>
    setSort((s) => ({ col, dir: s.col === col && s.dir === 'desc' ? 'asc' : 'desc' }))
  const handleExport = () =>
    exportFromApi(
      `${RESOURCE}?pageSize=9999&${new URLSearchParams(applied as Record<string, string>)}`,
      'job-logs',
      [
        { key: 'id', title: 'ID' },
        { key: 'jobName', title: '任务名称' },
        { key: 'jobGroup', title: '任务组' },
        { key: 'invokeTarget', title: '调用目标' },
        { key: 'jobMessage', title: '日志信息' },
        { key: 'status', title: '状态', formatter: (v) => STATUS_LABEL[Number(v)]?.label ?? '' },
        { key: 'startTime', title: '开始时间' },
        { key: 'stopTime', title: '停止时间' },
        { key: 'costTime', title: '耗时(ms)' },
      ],
    ).then((ok) => (ok ? toast.success('导出成功') : toast.error('导出失败')))

  const sortIcon = (col: string) => (sort.col === col ? (sort.dir === 'desc' ? '↓' : '↑') : '')

  return (
    <div className="space-y-4">
      <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
        <ScrollText className="h-6 w-6 text-primary" />
        任务日志
      </h1>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
        <div className="space-y-1.5">
          <Label className="text-xs">任务名称</Label>
          <Input
            value={search.jobName}
            onChange={(e) => setSearch({ ...search, jobName: e.target.value })}
            placeholder="任务名称"
            className={inputCls}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">任务组</Label>
          <Input
            value={search.jobGroup}
            onChange={(e) => setSearch({ ...search, jobGroup: e.target.value })}
            placeholder="任务组"
            className={inputCls}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">状态</Label>
          <Select
            value={search.status || 'all'}
            onValueChange={(v) => setSearch({ ...search, status: v === 'all' ? '' : v })}
          >
            <SelectTrigger className={inputCls}>
              <SelectValue placeholder="全部" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="0">成功</SelectItem>
              <SelectItem value="1">失败</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSearch}>
            <Search className="h-4 w-4" />
            搜索
          </Button>
          <Button size="sm" variant="outline" onClick={handleReset}>
            重置
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <HasPermi code="monitor:job:remove">
          <Button
            size="sm"
            variant="outline"
            disabled={selected.size === 0 || delMut.isPending}
            onClick={() => {
              if (confirm(`确认删除选中的 ${selected.size} 条记录？`)) delMut.mutate([...selected])
            }}
          >
            <Trash2 className="h-4 w-4" />
            删除
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={cleanMut.isPending}
            onClick={() => {
              if (confirm('确认清空所有任务日志？')) cleanMut.mutate()
            }}
          >
            <Eraser className="h-4 w-4" />
            清空
          </Button>
        </HasPermi>
        <HasPermi code="monitor:job:export">
          <Button size="sm" variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4" />
            导出
          </Button>
        </HasPermi>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="w-10 px-4 py-2.5">
                <Checkbox
                  checked={list.length > 0 && selected.size === list.length}
                  onCheckedChange={toggleAll}
                />
              </th>
              <th className={th}>ID</th>
              <th className={th}>任务名称</th>
              <th className={th}>任务组</th>
              <th className={th}>调用目标</th>
              <th className={th}>日志信息</th>
              <th className={th}>状态</th>
              <th
                className={cn(th, 'cursor-pointer select-none')}
                onClick={() => handleSort('startTime')}
              >
                开始时间 {sortIcon('startTime')}
              </th>
              <th className={th}>耗时</th>
              <th className={th}>操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                </td>
              </tr>
            ) : list.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                  暂无数据
                </td>
              </tr>
            ) : (
              list.map((l) => {
                const st = STATUS_LABEL[l.status] ?? {
                  label: '-',
                  cls: 'bg-muted text-muted-foreground',
                }
                return (
                  <tr key={l.id} className="transition-colors hover:bg-muted/30">
                    <td className="px-4 py-2.5">
                      <Checkbox
                        checked={selected.has(l.id)}
                        onCheckedChange={() => toggleOne(l.id)}
                      />
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{l.id}</td>
                    <td className="px-4 py-2.5 font-medium">{l.jobName}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{l.jobGroup}</td>
                    <td
                      className="max-w-[180px] truncate px-4 py-2.5 font-mono text-xs text-muted-foreground"
                      title={l.invokeTarget}
                    >
                      {l.invokeTarget}
                    </td>
                    <td
                      className="max-w-[180px] truncate px-4 py-2.5 text-xs text-muted-foreground"
                      title={l.jobMessage}
                    >
                      {l.jobMessage || '-'}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs', st.cls)}>
                        {st.label}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">
                      {l.startTime ? new Date(l.startTime).toLocaleString() : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{l.costTime}ms</td>
                    <td className="px-4 py-2.5">
                      <HasPermi code="monitor:job:query">
                        <Button size="sm" variant="ghost" onClick={() => setDetail(l)}>
                          <Eye className="h-3.5 w-3.5" />
                          详情
                        </Button>
                      </HasPermi>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {total > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            共 {total} 条 · {page}/{totalPages}
          </span>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={!!detail} onOpenChange={(o) => (o ? null : setDetail(null))}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>任务日志详情</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <span className="text-muted-foreground">日志ID：</span>
                {detail.id}
              </div>
              <div>
                <span className="text-muted-foreground">任务名称：</span>
                {detail.jobName}
              </div>
              <div>
                <span className="text-muted-foreground">任务组：</span>
                {detail.jobGroup}
              </div>
              <div>
                <span className="text-muted-foreground">状态：</span>
                {STATUS_LABEL[detail.status]?.label ?? '-'}
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">调用目标：</span>
                <code className="font-mono text-xs">{detail.invokeTarget}</code>
              </div>
              <div>
                <span className="text-muted-foreground">开始时间：</span>
                {detail.startTime ? new Date(detail.startTime).toLocaleString() : '-'}
              </div>
              <div>
                <span className="text-muted-foreground">停止时间：</span>
                {detail.stopTime ? new Date(detail.stopTime).toLocaleString() : '-'}
              </div>
              <div>
                <span className="text-muted-foreground">耗时：</span>
                {detail.costTime}ms
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">日志信息：</span>
                <pre className="mt-1 max-h-32 overflow-auto rounded bg-muted/50 p-2 text-xs">
                  {detail.jobMessage || '-'}
                </pre>
              </div>
              {detail.status === 1 && (
                <div className="col-span-2">
                  <span className="text-destructive">异常信息：</span>
                  <pre className="mt-1 max-h-32 overflow-auto rounded bg-red-500/5 p-2 text-xs text-destructive">
                    {detail.exceptionInfo || '-'}
                  </pre>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetail(null)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
