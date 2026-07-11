'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Plus,
  Edit,
  Trash2,
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Download,
  CalendarClock,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { exportToExcel } from '@/lib/export-utils'
import { HasPermi } from '@/components/auth/HasPermi'
import { DatePicker } from '@/components/form/DatePicker'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
  Switch,
} from '@ihui/ui'

interface ZhsActivity {
  id: string
  activityName: string | null
  activityRule: string | null
  activityRecharge: string | null
  beginAmount: string | null
  multiple: string | null
  computing: string | null
  beginTime: string | null
  endTime: string | null
  status: number
}

interface ListData {
  list: ZhsActivity[]
  total: number
}

const PAGE_SIZE = 10

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const EMPTY = {
  activityName: '',
  activityRule: '',
  activityRecharge: '',
  beginAmount: '',
  multiple: '',
  computing: '',
  beginTime: '',
  endTime: '',
  status: true,
}

export default function ZhsActivityPage() {
  const qc = useQueryClient()
  const [searchName, setSearchName] = React.useState('')
  const [searchBegin, setSearchBegin] = React.useState('')
  const [debouncedName, setDebouncedName] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<ZhsActivity | null>(null)
  const [form, setForm] = React.useState(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebouncedName(searchName)
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [searchName])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'zhs-activity', debouncedName, searchBegin, page],
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (debouncedName) qs.set('activityName', debouncedName)
      if (searchBegin) qs.set('beginTime', searchBegin)
      return api<ListData>(`/api/admin/zhs-activity?${qs.toString()}`)
    },
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        activityName: form.activityName.trim(),
        activityRule: form.activityRule || undefined,
        activityRecharge: form.activityRecharge || undefined,
        beginAmount: form.beginAmount || undefined,
        multiple: form.multiple || undefined,
        computing: form.computing || undefined,
        beginTime: form.beginTime || undefined,
        endTime: form.endTime || undefined,
        status: form.status ? 1 : 0,
      }
      return editing
        ? api(`/api/admin/zhs-activity/${editing.id}`, {
            method: 'PUT',
            body: JSON.stringify(body),
          })
        : api('/api/admin/zhs-activity', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(editing ? '更新成功' : '新增成功')
      qc.invalidateQueries({ queryKey: ['admin', 'zhs-activity'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/zhs-activity/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('删除成功')
      qc.invalidateQueries({ queryKey: ['admin', 'zhs-activity'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setErr(null)
    setOpen(true)
  }
  function openEdit(item: ZhsActivity) {
    setEditing(item)
    setForm({
      activityName: item.activityName ?? '',
      activityRule: item.activityRule ?? '',
      activityRecharge: item.activityRecharge ?? '',
      beginAmount: item.beginAmount ?? '',
      multiple: item.multiple ?? '',
      computing: item.computing ?? '',
      beginTime: item.beginTime ?? '',
      endTime: item.endTime ?? '',
      status: item.status === 1,
    })
    setErr(null)
    setOpen(true)
  }
  function closeDialog() {
    if (saveMut.isPending) return
    setOpen(false)
    setEditing(null)
    setErr(null)
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!form.activityName.trim()) {
      setErr('请输入活动名称')
      return
    }
    saveMut.mutate()
  }
  function handleDelete(item: ZhsActivity) {
    if (!window.confirm(`确认删除 "${item.activityName}" ?`)) return
    deleteMut.mutate(item.id)
  }
  function handleExport() {
    exportToExcel(
      'ZHS活动',
      [
        { key: 'id', title: 'ID' },
        { key: 'activityName', title: '活动名称' },
        { key: 'activityRule', title: '活动规则' },
        { key: 'activityRecharge', title: '活动充值' },
        { key: 'beginAmount', title: '起始金额' },
        { key: 'multiple', title: '倍数' },
        { key: 'computing', title: '计算方式' },
        { key: 'beginTime', title: '开始时间' },
        { key: 'endTime', title: '结束时间' },
        { key: 'status', title: '状态', formatter: (v) => (v === 1 ? '启用' : '关闭') },
      ],
      (data?.list ?? []) as unknown as Record<string, unknown>[],
    )
  }

  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">ZHS活动管理</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4" />
            导出
          </Button>
          <HasPermi code="ai:zhs_activity:add">
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              新增
            </Button>
          </HasPermi>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            placeholder="搜索活动名称"
            className="h-9 pl-8"
          />
        </div>
        <DatePicker
          value={searchBegin}
          onChange={(v) => {
            setSearchBegin(v as string)
            setPage(1)
          }}
          placeholder="开始时间"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-4 py-2.5">活动名称</TableHead>
              <TableHead className="px-4 py-2.5">活动规则</TableHead>
              <TableHead className="px-4 py-2.5">起始金额</TableHead>
              <TableHead className="px-4 py-2.5">倍数</TableHead>
              <TableHead className="px-4 py-2.5">开始时间</TableHead>
              <TableHead className="px-4 py-2.5">结束时间</TableHead>
              <TableHead className="px-4 py-2.5">状态</TableHead>
              <TableHead className="px-4 py-2.5 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  加载中…
                </TableCell>
              </TableRow>
            ) : list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  <CalendarClock className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  暂无数据
                </TableCell>
              </TableRow>
            ) : (
              list.map((item) => (
                <TableRow key={item.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5 font-medium">
                    {item.activityName || '-'}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 max-w-[200px] truncate text-muted-foreground">
                    {item.activityRule || '-'}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">{item.beginAmount || '-'}</TableCell>
                  <TableCell className="px-4 py-2.5">{item.multiple || '-'}</TableCell>
                  <TableCell className="px-4 py-2.5 text-muted-foreground">
                    {item.beginTime || '-'}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-muted-foreground">
                    {item.endTime || '-'}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    <span
                      className={
                        item.status === 1
                          ? 'inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600'
                          : 'inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground'
                      }
                    >
                      {item.status === 1 ? '启用' : '关闭'}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      <HasPermi code="ai:zhs_activity:edit">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(item)}
                          title="编辑"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </HasPermi>
                      <HasPermi code="ai:zhs_activity:remove">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(item)}
                          title="删除"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </HasPermi>
                    </div>
                  </TableCell>
                </TableRow>
              ))
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

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : closeDialog())}>
        <DialogContent className="max-w-lg">
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editing ? '编辑ZHS活动' : '新增ZHS活动'}</DialogTitle>
            </DialogHeader>
            {err && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}
            <div className="space-y-2">
              <Label>活动名称 *</Label>
              <Input
                value={form.activityName}
                onChange={(e) => setForm({ ...form, activityName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>活动规则</Label>
              <Input
                value={form.activityRule}
                onChange={(e) => setForm({ ...form, activityRule: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>活动充值</Label>
              <Input
                value={form.activityRecharge}
                onChange={(e) => setForm({ ...form, activityRecharge: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>起始金额</Label>
                <Input
                  value={form.beginAmount}
                  onChange={(e) => setForm({ ...form, beginAmount: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>倍数</Label>
                <Input
                  value={form.multiple}
                  onChange={(e) => setForm({ ...form, multiple: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>计算方式</Label>
                <Input
                  value={form.computing}
                  onChange={(e) => setForm({ ...form, computing: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>开始时间</Label>
                <DatePicker
                  value={form.beginTime}
                  onChange={(v) => setForm({ ...form, beginTime: v as string })}
                />
              </div>
              <div className="space-y-2">
                <Label>结束时间</Label>
                <DatePicker
                  value={form.endTime}
                  onChange={(v) => setForm({ ...form, endTime: v as string })}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.status}
                onCheckedChange={(v) => setForm({ ...form, status: v })}
              />
              <Label>启用</Label>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeDialog}
                disabled={saveMut.isPending}
              >
                取消
              </Button>
              <Button type="submit" disabled={saveMut.isPending}>
                {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}保存
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
