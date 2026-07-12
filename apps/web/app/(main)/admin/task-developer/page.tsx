'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Edit, Trash2, Search, Download, Loader2, Terminal } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { HasPermi } from '@/components/auth/HasPermi'
import { exportFromApi } from '@/lib/export-utils'
import {
  Button,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@ihui/ui'

interface TaskDeveloper {
  id: string
  taskId: string
  accept: string
  acceptAt: string | null
  amount: number
  discount: number
  realAmount: number
  nodes: string
  status: number
  publisher: string
  creator: string
  updator: string | null
  createdAt: string
  updatedAt: string
}

interface PageData {
  list: TaskDeveloper[]
  total: number
}

const RESOURCE = '/api/admin/task-developer'
const PERM = 'ai:taskDeveloper'
const PERMS = {
  add: `${PERM}:add`,
  edit: `${PERM}:edit`,
  remove: `${PERM}:remove`,
  export: `${PERM}:export`,
}

const STATUS_MAP: Record<number, { label: string; cls: string }> = {
  0: { label: '待接单', cls: 'bg-amber-500/10 text-amber-600' },
  1: { label: '进行中', cls: 'bg-blue-500/10 text-blue-600' },
  2: { label: '已完成', cls: 'bg-emerald-500/10 text-emerald-600' },
  3: { label: '已取消', cls: 'bg-red-500/10 text-red-600' },
  4: { label: '已超时', cls: 'bg-gray-500/10 text-gray-600' },
}

const FIELDS: { key: keyof TaskDeveloper; label: string; type?: 'number' }[] = [
  { key: 'taskId', label: '任务ID' },
  { key: 'accept', label: '接单人' },
  { key: 'amount', label: '金额', type: 'number' },
  { key: 'discount', label: '折扣', type: 'number' },
  { key: 'realAmount', label: '实付', type: 'number' },
  { key: 'nodes', label: '节点' },
  { key: 'publisher', label: '发布者' },
  { key: 'creator', label: '创建者' },
]

const SEARCH_FIELDS: { key: string; label: string }[] = [
  { key: 'taskId', label: '任务ID' },
  { key: 'accept', label: '接单人' },
  { key: 'amount', label: '金额' },
  { key: 'nodes', label: '节点' },
  { key: 'publisher', label: '发布者' },
  { key: 'creator', label: '创建者' },
]

const EXPORT_COLS = [
  { key: 'taskId', title: '任务ID' },
  { key: 'accept', title: '接单人' },
  { key: 'amount', title: '金额' },
  { key: 'discount', title: '折扣' },
  { key: 'realAmount', title: '实付' },
  { key: 'nodes', title: '节点' },
  { key: 'status', title: '状态' },
  { key: 'publisher', title: '发布者' },
  { key: 'creator', title: '创建者' },
  { key: 'createdAt', title: '创建时间' },
]

const EMPTY: Record<string, string> = {
  taskId: '',
  accept: '',
  amount: '0',
  discount: '0',
  realAmount: '0',
  nodes: '',
  publisher: '',
  creator: '',
}

const th = 'px-4 py-2.5 font-medium'

function fmtDate(d: string | null) {
  if (!d) return '-'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(d))
}

export default function TaskDeveloperPage() {
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState<Record<string, string>>({})
  const [applied, setApplied] = React.useState<Record<string, string>>({})
  const [open, setOpen] = React.useState(false)
  const [editId, setEditId] = React.useState<string | null>(null)
  const [form, setForm] = React.useState<Record<string, string>>(EMPTY)
  const [ids, setIds] = React.useState<string[]>([])

  const qs = React.useMemo(() => {
    const p = new URLSearchParams({ page: String(page), pageSize: '10' })
    Object.entries(applied).forEach(([k, v]) => {
      if (v.trim()) p.set(k, v.trim())
    })
    return p.toString()
  }, [page, applied])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'task-developer', qs],
    queryFn: async () => {
      const r = await fetchApi<PageData>(`${RESOURCE}?${qs}`)
      if (!r.success) throw new Error(r.error)
      return r.data
    },
  })

  const saveMut = useMutation({
    mutationFn: async () => {
      const body = {
        ...form,
        amount: Number(form.amount),
        discount: Number(form.discount),
        realAmount: Number(form.realAmount),
      }
      const url = editId ? `${RESOURCE}/${editId}` : RESOURCE
      const method = editId ? 'PUT' : 'POST'
      const r = await fetchApi(url, { method, body: JSON.stringify(body) })
      if (!r.success) throw new Error(r.error)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'task-developer'] })
      setOpen(false)
      toast.success(editId ? '更新成功' : '创建成功')
    },
  })

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetchApi(`${RESOURCE}/${id}`, { method: 'DELETE' })
      if (!r.success) throw new Error(r.error)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'task-developer'] })
      toast.success('删除成功')
    },
  })

  const batchDelMut = useMutation({
    mutationFn: async () => {
      const r = await fetchApi(`${RESOURCE}/batch`, { method: 'DELETE', body: JSON.stringify(ids) })
      if (!r.success) throw new Error(r.error)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'task-developer'] })
      setIds([])
      toast.success('批量删除成功')
    },
  })

  const rows = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / 10))
  const allChecked = rows.length > 0 && rows.every((r) => ids.includes(r.id))

  function toggleAll() {
    setIds(allChecked ? [] : rows.map((r) => r.id))
  }
  function toggleOne(id: string) {
    setIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]))
  }

  function openCreate() {
    setEditId(null)
    setForm(EMPTY)
    setOpen(true)
  }
  function openEdit(row: TaskDeveloper) {
    setEditId(row.id)
    setForm({
      taskId: row.taskId,
      accept: row.accept,
      amount: String(row.amount),
      discount: String(row.discount),
      realAmount: String(row.realAmount),
      nodes: row.nodes,
      publisher: row.publisher,
      creator: row.creator,
    })
    setOpen(true)
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    saveMut.mutate()
  }
  function applySearch() {
    setPage(1)
    setApplied(search)
  }
  function resetSearch() {
    setSearch({})
    setApplied({})
    setPage(1)
  }
  function handleExport() {
    exportFromApi(`${RESOURCE}?pageSize=10000`, '任务开发者', EXPORT_COLS)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Terminal className="h-6 w-6 text-primary" />
          任务开发者管理
        </h1>
        <div className="flex gap-2">
          <HasPermi code={PERMS.export}>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4" />
              导出
            </Button>
          </HasPermi>
          {ids.length > 0 && (
            <HasPermi code={PERMS.remove}>
              <Button variant="destructive" size="sm" onClick={() => batchDelMut.mutate()}>
                <Trash2 className="h-4 w-4" />
                批量删除({ids.length})
              </Button>
            </HasPermi>
          )}
          <HasPermi code={PERMS.add}>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              新增
            </Button>
          </HasPermi>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 rounded-lg border bg-muted/30 p-3">
        {SEARCH_FIELDS.map((f) => (
          <Input
            key={f.key}
            placeholder={f.label}
            value={search[f.key] || ''}
            onChange={(e) => setSearch({ ...search, [f.key]: e.target.value })}
            className="h-8 w-40"
          />
        ))}
        <Button size="sm" variant="outline" onClick={applySearch}>
          <Search className="h-4 w-4" />
          搜索
        </Button>
        <Button size="sm" variant="ghost" onClick={resetSearch}>
          重置
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={toggleAll}
                  className="rounded"
                />
              </th>
              <th className={th}>任务ID</th>
              <th className={th}>接单人</th>
              <th className={th}>金额</th>
              <th className={th}>折扣</th>
              <th className={th}>实付</th>
              <th className={th}>节点</th>
              <th className={th}>状态</th>
              <th className={th}>发布者</th>
              <th className={th}>创建者</th>
              <th className={th}>创建时间</th>
              <th className={th}>操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={12} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  加载中...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-4 py-10 text-center text-muted-foreground">
                  <Terminal className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  暂无数据
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const st = STATUS_MAP[row.status] ?? {
                  label: '未知',
                  cls: 'bg-gray-500/10 text-gray-600',
                }
                return (
                  <tr key={row.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2.5">
                      <input
                        type="checkbox"
                        checked={ids.includes(row.id)}
                        onChange={() => toggleOne(row.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="px-4 py-2.5 font-medium">{row.taskId}</td>
                    <td className="px-4 py-2.5">{row.accept}</td>
                    <td className="px-4 py-2.5">{row.amount}</td>
                    <td className="px-4 py-2.5">{row.discount}</td>
                    <td className="px-4 py-2.5">{row.realAmount}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{row.nodes}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}
                      >
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{row.publisher}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{row.creator}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {fmtDate(row.createdAt)}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-2">
                        <HasPermi code={PERMS.edit}>
                          <button
                            onClick={() => openEdit(row)}
                            className="text-primary hover:underline"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                        </HasPermi>
                        <HasPermi code={PERMS.remove}>
                          <button
                            onClick={() => delMut.mutate(row.id)}
                            className="text-red-600 hover:underline"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </HasPermi>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {total > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>共 {total} 条</span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              上一页
            </Button>
            <span className="flex items-center px-2">
              {page} / {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              下一页
            </Button>
          </div>
        </div>
      )}

      <Dialog
        open={open}
        onOpenChange={(o) => (o ? setOpen(true) : !saveMut.isPending && setOpen(false))}
      >
        <DialogContent>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editId ? '编辑任务开发者' : '新增任务开发者'}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              {FIELDS.map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <Label>{f.label}</Label>
                  <Input
                    type={f.type === 'number' ? 'number' : 'text'}
                    value={form[f.key] || ''}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  />
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={saveMut.isPending}
              >
                取消
              </Button>
              <Button type="submit" disabled={saveMut.isPending}>
                {saveMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editId ? '更新' : '创建'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
