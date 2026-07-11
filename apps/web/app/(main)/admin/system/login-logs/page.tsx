'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Loader2,
  LogIn,
  Trash2,
  Eraser,
  Download,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Input, Label, Checkbox } from '@ihui/ui'
import { HasPermi } from '@/components/auth/HasPermi'
import { exportFromApi } from '@/lib/export-utils'
import { cn } from '@/lib/utils'

interface LoginLog {
  id: string
  userUuid: string
  loginType: string
  platform: string
  ip: string
  location: string
  userAgent: string
  loginTime: string
  message: string
}

interface ListResp {
  list: LoginLog[]
  total: number
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const RESOURCE = '/api/admin/system/login-logs'
const th = 'px-4 py-2.5 text-left font-medium text-xs uppercase text-muted-foreground'
const inputCls =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export default function LoginLogsPage() {
  const qc = useQueryClient()
  const [search, setSearch] = React.useState({
    userUuid: '',
    platform: '',
    location: '',
    startTime: '',
    endTime: '',
  })
  const [applied, setApplied] = React.useState({
    userUuid: '',
    platform: '',
    location: '',
    startTime: '',
    endTime: '',
  })
  const [page, setPage] = React.useState(1)
  const [sort, setSort] = React.useState<{ col: string; dir: 'asc' | 'desc' }>({
    col: 'loginTime',
    dir: 'desc',
  })
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const pageSize = 15

  const params = React.useMemo(() => {
    const qs = new URLSearchParams()
    qs.set('page', String(page))
    qs.set('pageSize', String(pageSize))
    if (applied.userUuid) qs.set('userUuid', applied.userUuid)
    if (applied.platform) qs.set('platform', applied.platform)
    if (applied.location) qs.set('location', applied.location)
    if (applied.startTime) qs.set('startTime', applied.startTime)
    if (applied.endTime) qs.set('endTime', applied.endTime)
    qs.set('orderByColumn', sort.col)
    qs.set('isAsc', sort.dir)
    return qs.toString()
  }, [page, applied, sort])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'login-logs', params],
    queryFn: () => api<ListResp>(`${RESOURCE}?${params}`),
  })

  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const delMut = useMutation({
    mutationFn: (ids: string[]) =>
      api(RESOURCE, { method: 'DELETE', body: JSON.stringify({ ids }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'login-logs'] })
      toast.success('删除成功')
      setSelected(new Set())
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const cleanMut = useMutation({
    mutationFn: () => api(`${RESOURCE}/clean`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'login-logs'] })
      toast.success('清空成功')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const handleSearch = () => {
    setPage(1)
    setApplied(search)
  }
  const handleReset = () => {
    setSearch({ userUuid: '', platform: '', location: '', startTime: '', endTime: '' })
    setApplied({ userUuid: '', platform: '', location: '', startTime: '', endTime: '' })
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
      'login-logs',
      [
        { key: 'id', title: 'ID' },
        { key: 'userUuid', title: '用户' },
        { key: 'loginType', title: '登录类型' },
        { key: 'platform', title: '平台' },
        { key: 'ip', title: 'IP' },
        { key: 'location', title: '位置' },
        { key: 'loginTime', title: '登录时间' },
        { key: 'message', title: '消息' },
      ],
    ).then((ok) => (ok ? toast.success('导出成功') : toast.error('导出失败')))

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <LogIn className="h-6 w-6 text-primary" />
          登录日志
        </h1>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
        <div className="space-y-1.5">
          <Label className="text-xs">用户</Label>
          <Input
            value={search.userUuid}
            onChange={(e) => setSearch({ ...search, userUuid: e.target.value })}
            placeholder="用户标识"
            className={inputCls}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">平台</Label>
          <Input
            value={search.platform}
            onChange={(e) => setSearch({ ...search, platform: e.target.value })}
            placeholder="平台"
            className={inputCls}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">位置</Label>
          <Input
            value={search.location}
            onChange={(e) => setSearch({ ...search, location: e.target.value })}
            placeholder="登录位置"
            className={inputCls}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">开始日期</Label>
          <Input
            type="date"
            value={search.startTime}
            onChange={(e) => setSearch({ ...search, startTime: e.target.value })}
            className={inputCls}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">结束日期</Label>
          <Input
            type="date"
            value={search.endTime}
            onChange={(e) => setSearch({ ...search, endTime: e.target.value })}
            className={inputCls}
          />
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
        <HasPermi code="system:logininfor:remove">
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
              if (confirm('确认清空所有登录日志？')) cleanMut.mutate()
            }}
          >
            <Eraser className="h-4 w-4" />
            清空
          </Button>
        </HasPermi>
        <HasPermi code="system:logininfor:export">
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
              <th className={th}>用户</th>
              <th className={th}>类型</th>
              <th className={th}>平台</th>
              <th className={th}>IP</th>
              <th className={th}>位置</th>
              <th className={th}>UA</th>
              <th
                className={cn(th, 'cursor-pointer select-none')}
                onClick={() => handleSort('loginTime')}
              >
                登录时间 {sort.col === 'loginTime' && (sort.dir === 'desc' ? '↓' : '↑')}
              </th>
              <th className={th}>消息</th>
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
              list.map((l) => (
                <tr key={l.id} className="transition-colors hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <Checkbox
                      checked={selected.has(l.id)}
                      onCheckedChange={() => toggleOne(l.id)}
                    />
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{l.id}</td>
                  <td className="px-4 py-2.5 font-medium">{l.userUuid}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{l.loginType}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{l.platform}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{l.ip}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{l.location}</td>
                  <td
                    className="max-w-[200px] truncate px-4 py-2.5 text-xs text-muted-foreground"
                    title={l.userAgent}
                  >
                    {l.userAgent}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">
                    {l.loginTime ? new Date(l.loginTime).toLocaleString() : '-'}
                  </td>
                  <td
                    className="max-w-[200px] truncate px-4 py-2.5 text-xs text-muted-foreground"
                    title={l.message}
                  >
                    {l.message}
                  </td>
                </tr>
              ))
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
    </div>
  )
}
