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
  CheckCircle,
  XCircle,
  ClipboardList,
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
} from '@ihui/ui'

interface AgentTask {
  id: string
  title: string | null
  context: string | null
  createdName: string | null
  closingTime: string | null
  cycle: string | null
  cycleUnit: string | null
  lowestPrice: string | null
  peakPrice: string | null
  status: number
  remark: string | null
  createdAt: string | null
}

interface ListData {
  list: AgentTask[]
  total: number
}

const PAGE_SIZE = 10

const STATUS_MAP: Record<number, string> = {
  0: '待审批',
  1: '已拒绝',
  2: '已审批',
  3: '沟通中',
  4: '开发中',
  5: '交付中',
  6: '已完成',
}
const STATUS_STYLE: Record<number, string> = {
  0: 'bg-amber-500/10 text-amber-600',
  1: 'bg-red-500/10 text-red-600',
  2: 'bg-emerald-500/10 text-emerald-600',
  3: 'bg-blue-500/10 text-blue-600',
  4: 'bg-purple-500/10 text-purple-600',
  5: 'bg-cyan-500/10 text-cyan-600',
  6: 'bg-muted text-muted-foreground',
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const EMPTY = {
  title: '',
  context: '',
  lowestPrice: '',
  peakPrice: '',
  cycle: '',
  cycleUnit: '',
  closingTime: '',
}

export default function AgentTaskPage() {
  const qc = useQueryClient()
  const [searchTitle, setSearchTitle] = React.useState('')
  const [searchCreator, setSearchCreator] = React.useState('')
  const [searchClosing, setSearchClosing] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<AgentTask | null>(null)
  const [form, setForm] = React.useState(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(JSON.stringify({ t: searchTitle, c: searchCreator, d: searchClosing }))
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [searchTitle, searchCreator, searchClosing])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'agent-task', debounced, page],
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (searchTitle) qs.set('title', searchTitle)
      if (searchCreator) qs.set('creator', searchCreator)
      if (searchClosing) qs.set('closingTime', searchClosing)
      return api<ListData>(`/api/admin/agent-task?${qs.toString()}`)
    },
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        title: form.title.trim(),
        context: form.context || undefined,
        lowestPrice: form.lowestPrice || undefined,
        peakPrice: form.peakPrice || undefined,
        cycle: form.cycle || undefined,
        cycleUnit: form.cycleUnit || undefined,
        closingTime: form.closingTime || undefined,
      }
      return editing
        ? api(`/api/admin/agent-task/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) })
        : api('/api/admin/agent-task', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(editing ? '更新成功' : '新增成功')
      qc.invalidateQueries({ queryKey: ['admin', 'agent-task'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: number }) =>
      api(`/api/admin/agent-task/${id}`, { method: 'PUT', body: JSON.stringify({ status }) }),
    onSuccess: () => {
      toast.success('操作成功')
      qc.invalidateQueries({ queryKey: ['admin', 'agent-task'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/agent-task/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('删除成功')
      qc.invalidateQueries({ queryKey: ['admin', 'agent-task'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setErr(null)
    setOpen(true)
  }
  function openEdit(item: AgentTask) {
    setEditing(item)
    setForm({
      title: item.title ?? '',
      context: item.context ?? '',
      lowestPrice: item.lowestPrice ?? '',
      peakPrice: item.peakPrice ?? '',
      cycle: item.cycle ?? '',
      cycleUnit: item.cycleUnit ?? '',
      closingTime: item.closingTime ?? '',
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
    if (!form.title.trim()) {
      setErr('请输入需求标题')
      return
    }
    saveMut.mutate()
  }
  function handleDelete(item: AgentTask) {
    if (!window.confirm(`确认删除 "${item.title}" ?`)) return
    deleteMut.mutate(item.id)
  }
  function handleExport() {
    exportToExcel(
      'Agent任务',
      [
        { key: 'id', title: 'ID' },
        { key: 'title', title: '需求标题' },
        { key: 'context', title: '需求描述' },
        { key: 'createdName', title: '发布者' },
        { key: 'closingTime', title: '截止时间' },
        { key: 'cycle', title: '项目周期' },
        { key: 'lowestPrice', title: '最低价' },
        { key: 'peakPrice', title: '最高价' },
        { key: 'status', title: '状态', formatter: (v) => STATUS_MAP[v as number] ?? '-' },
        { key: 'createdAt', title: '创建时间' },
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
        <h1 className="text-2xl font-bold tracking-tight">Agent任务管理</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4" />
            导出
          </Button>
          <HasPermi code="ai:agentTask:add">
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
            value={searchTitle}
            onChange={(e) => setSearchTitle(e.target.value)}
            placeholder="搜索需求标题"
            className="h-9 pl-8"
          />
        </div>
        <Input
          value={searchCreator}
          onChange={(e) => setSearchCreator(e.target.value)}
          placeholder="发布者"
          className="h-9 w-32"
        />
        <DatePicker
          value={searchClosing}
          onChange={(v) => {
            setSearchClosing(v as string)
            setPage(1)
          }}
          placeholder="截止时间"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-4 py-2.5">需求标题</TableHead>
              <TableHead className="px-4 py-2.5">发布者</TableHead>
              <TableHead className="px-4 py-2.5">截止时间</TableHead>
              <TableHead className="px-4 py-2.5">周期</TableHead>
              <TableHead className="px-4 py-2.5">价格范围</TableHead>
              <TableHead className="px-4 py-2.5">状态</TableHead>
              <TableHead className="px-4 py-2.5 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  加载中…
                </TableCell>
              </TableRow>
            ) : list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  <ClipboardList className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  暂无数据
                </TableCell>
              </TableRow>
            ) : (
              list.map((item) => (
                <TableRow key={item.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5 font-medium max-w-[200px] truncate">
                    {item.title || '-'}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">{item.createdName || '-'}</TableCell>
                  <TableCell className="px-4 py-2.5 text-muted-foreground">
                    {item.closingTime || '-'}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    {item.cycle ? `${item.cycle}${item.cycleUnit || ''}` : '-'}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    {item.lowestPrice || item.peakPrice
                      ? `${item.lowestPrice || '-'} - ${item.peakPrice || '-'}`
                      : '-'}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[item.status] ?? 'bg-muted text-muted-foreground'}`}
                    >
                      {STATUS_MAP[item.status] ?? '-'}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      {item.status === 0 && (
                        <>
                          <HasPermi code="ai:agentTask:edit">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => statusMut.mutate({ id: item.id, status: 2 })}
                              title="审批"
                              className="text-emerald-600"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          </HasPermi>
                          <HasPermi code="ai:agentTask:edit">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => statusMut.mutate({ id: item.id, status: 1 })}
                              title="拒绝"
                              className="text-amber-600"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </HasPermi>
                        </>
                      )}
                      <HasPermi code="ai:agentTask:edit">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(item)}
                          title="编辑"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </HasPermi>
                      <HasPermi code="ai:agentTask:remove">
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
              <DialogTitle>{editing ? '编辑Agent任务' : '新增Agent任务'}</DialogTitle>
            </DialogHeader>
            {err && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}
            <div className="space-y-2">
              <Label>需求标题 *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>需求描述</Label>
              <Input
                value={form.context}
                onChange={(e) => setForm({ ...form, context: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>最低价</Label>
                <Input
                  value={form.lowestPrice}
                  onChange={(e) => setForm({ ...form, lowestPrice: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>最高价</Label>
                <Input
                  value={form.peakPrice}
                  onChange={(e) => setForm({ ...form, peakPrice: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>周期</Label>
                <Input
                  value={form.cycle}
                  onChange={(e) => setForm({ ...form, cycle: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>周期单位</Label>
                <Input
                  value={form.cycleUnit}
                  onChange={(e) => setForm({ ...form, cycleUnit: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>截止时间</Label>
              <DatePicker
                value={form.closingTime}
                onChange={(v) => setForm({ ...form, closingTime: v as string })}
              />
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
