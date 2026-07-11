'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Loader2,
  Activity,
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

interface OperLog {
  id: string
  title: string
  businessType: number
  operName: string
  operUrl: string
  requestMethod: string
  operParam: string
  jsonResult: string
  status: number
  errorMsg: string
  costTime: number
  operTime: string
  operIp: string
  operLocation: string
}

interface ListResp {
  list: OperLog[]
  total: number
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const RESOURCE = '/api/admin/system/operation-logs'
const th = 'px-4 py-2.5 text-left font-medium text-xs uppercase text-muted-foreground'
const inputCls =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
const BIZ_TYPE: Record<number, string> = {
  0: '其他',
  1: '新增',
  2: '修改',
  3: '删除',
  4: '授权',
  5: '导出',
  6: '导入',
  7: '强退',
  8: '生成代码',
  9: '清空数据',
}
const STATUS_LABEL: Record<number, { label: string; cls: string }> = {
  0: { label: '成功', cls: 'bg-emerald-500/10 text-emerald-600' },
  1: { label: '失败', cls: 'bg-red-500/10 text-red-600' },
}

export default function OperationLogsPage() {
  const qc = useQueryClient()
  const [search, setSearch] = React.useState({ title: '', operName: '', businessType: '' })
  const [applied, setApplied] = React.useState({ title: '', operName: '', businessType: '' })
  const [page, setPage] = React.useState(1)
  const [sort, setSort] = React.useState<{ col: string; dir: 'asc' | 'desc' }>({
    col: 'operTime',
    dir: 'desc',
  })
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [detail, setDetail] = React.useState<OperLog | null>(null)
  const pageSize = 15

  const params = React.useMemo(() => {
    const qs = new URLSearchParams()
    qs.set('page', String(page))
    qs.set('pageSize', String(pageSize))
    if (applied.title) qs.set('title', applied.title)
    if (applied.operName) qs.set('operName', applied.operName)
    if (applied.businessType) qs.set('businessType', applied.businessType)
    qs.set('orderByColumn', sort.col)
    qs.set('isAsc', sort.dir)
    return qs.toString()
  }, [page, applied, sort])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'operation-logs', params],
    queryFn: () => api<ListResp>(`${RESOURCE}?${params}`),
  })
  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const delMut = useMutation({
    mutationFn: (ids: string[]) =>
      api(RESOURCE, { method: 'DELETE', body: JSON.stringify({ ids }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'operation-logs'] })
      toast.success('删除成功')
      setSelected(new Set())
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const cleanMut = useMutation({
    mutationFn: () => api(`${RESOURCE}/clean`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'operation-logs'] })
      toast.success('清空成功')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const handleSearch = () => {
    setPage(1)
    setApplied(search)
  }
  const handleReset = () => {
    setSearch({ title: '', operName: '', businessType: '' })
    setApplied({ title: '', operName: '', businessType: '' })
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
      'operation-logs',
      [
        { key: 'id', title: 'ID' },
        { key: 'title', title: '模块' },
        { key: 'businessType', title: '类型', formatter: (v) => BIZ_TYPE[Number(v)] ?? '' },
        { key: 'operName', title: '操作人' },
        { key: 'operIp', title: 'IP' },
        { key: 'operUrl', title: 'URL' },
        { key: 'requestMethod', title: '方法' },
        { key: 'status', title: '状态', formatter: (v) => STATUS_LABEL[Number(v)]?.label ?? '' },
        { key: 'costTime', title: '耗时(ms)' },
        { key: 'operTime', title: '操作时间' },
      ],
    ).then((ok) => (ok ? toast.success('导出成功') : toast.error('导出失败')))

  const sortIcon = (col: string) => (sort.col === col ? (sort.dir === 'desc' ? '↓' : '↑') : '')

  return (
    <div className="space-y-4">
      <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
        <Activity className="h-6 w-6 text-primary" />
        操作日志
      </h1>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
        <div className="space-y-1.5">
          <Label className="text-xs">模块</Label>
          <Input
            value={search.title}
            onChange={(e) => setSearch({ ...search, title: e.target.value })}
            placeholder="操作模块"
            className={inputCls}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">操作人</Label>
          <Input
            value={search.operName}
            onChange={(e) => setSearch({ ...search, operName: e.target.value })}
            placeholder="操作人"
            className={inputCls}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">类型</Label>
          <Select
            value={search.businessType}
            onValueChange={(v) => setSearch({ ...search, businessType: v === 'all' ? '' : v })}
          >
            <SelectTrigger className={inputCls}>
              <SelectValue placeholder="全部" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              {Object.entries(BIZ_TYPE).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
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
        <HasPermi code="system:operlog:remove">
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
              if (confirm('确认清空所有操作日志？')) cleanMut.mutate()
            }}
          >
            <Eraser className="h-4 w-4" />
            清空
          </Button>
        </HasPermi>
        <HasPermi code="system:operlog:export">
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
              <th className={th}>模块</th>
              <th className={th}>类型</th>
              <th
                className={cn(th, 'cursor-pointer select-none')}
                onClick={() => handleSort('operName')}
              >
                操作人 {sortIcon('operName')}
              </th>
              <th className={th}>请求方式</th>
              <th className={th}>IP</th>
              <th className={th}>位置</th>
              <th className={th}>状态</th>
              <th
                className={cn(th, 'cursor-pointer select-none')}
                onClick={() => handleSort('operTime')}
              >
                操作时间 {sortIcon('operTime')}
              </th>
              <th
                className={cn(th, 'cursor-pointer select-none')}
                onClick={() => handleSort('costTime')}
              >
                耗时 {sortIcon('costTime')}
              </th>
              <th className={th}>操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={12} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                </td>
              </tr>
            ) : list.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-4 py-10 text-center text-muted-foreground">
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
                    <td className="px-4 py-2.5 font-medium">{l.title}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {BIZ_TYPE[l.businessType] ?? '-'}
                    </td>
                    <td className="px-4 py-2.5">{l.operName}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{l.requestMethod}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{l.operIp}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{l.operLocation}</td>
                    <td className="px-4 py-2.5">
                      <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs', st.cls)}>
                        {st.label}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">
                      {l.operTime ? new Date(l.operTime).toLocaleString() : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{l.costTime}ms</td>
                    <td className="px-4 py-2.5">
                      <HasPermi code="system:operlog:query">
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
            <DialogTitle>操作日志详情</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <span className="text-muted-foreground">模块：</span>
                {detail.title}
              </div>
              <div>
                <span className="text-muted-foreground">类型：</span>
                {BIZ_TYPE[detail.businessType] ?? '-'}
              </div>
              <div>
                <span className="text-muted-foreground">操作人：</span>
                {detail.operName}
              </div>
              <div>
                <span className="text-muted-foreground">IP：</span>
                {detail.operIp}
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">请求URL：</span>
                {detail.operUrl}
              </div>
              <div>
                <span className="text-muted-foreground">请求方式：</span>
                {detail.requestMethod}
              </div>
              <div>
                <span className="text-muted-foreground">耗时：</span>
                {detail.costTime}ms
              </div>
              <div>
                <span className="text-muted-foreground">状态：</span>
                {STATUS_LABEL[detail.status]?.label ?? '-'}
              </div>
              <div>
                <span className="text-muted-foreground">操作时间：</span>
                {detail.operTime ? new Date(detail.operTime).toLocaleString() : '-'}
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">请求参数：</span>
                <pre className="mt-1 max-h-32 overflow-auto rounded bg-muted/50 p-2 text-xs">
                  {detail.operParam || '-'}
                </pre>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">返回结果：</span>
                <pre className="mt-1 max-h-32 overflow-auto rounded bg-muted/50 p-2 text-xs">
                  {detail.jsonResult || '-'}
                </pre>
              </div>
              {detail.status === 1 && (
                <div className="col-span-2">
                  <span className="text-destructive">错误信息：</span>
                  <pre className="mt-1 max-h-32 overflow-auto rounded bg-red-500/5 p-2 text-xs text-destructive">
                    {detail.errorMsg || '-'}
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
