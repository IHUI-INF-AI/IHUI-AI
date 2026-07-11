'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Loader2,
  Briefcase,
  Plus,
  Pencil,
  Trash2,
  Download,
  Search,
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

interface Post {
  id: string
  postCode: string
  postName: string
  postSort: number
  status: number
  remark: string
  createdAt: string
}

interface ListResp {
  list: Post[]
  total: number
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const RESOURCE = '/api/admin/system/posts'
const th = 'px-4 py-2.5 text-left font-medium text-xs uppercase text-muted-foreground'
const inputCls =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
const textareaCls =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
const EMPTY = { postCode: '', postName: '', postSort: 0, status: 0, remark: '' }

export default function PostPage() {
  const qc = useQueryClient()
  const [search, setSearch] = React.useState({ postCode: '', postName: '', status: '' })
  const [applied, setApplied] = React.useState({ postCode: '', postName: '', status: '' })
  const [page, setPage] = React.useState(1)
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Post | null>(null)
  const [form, setForm] = React.useState(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)
  const pageSize = 15

  const params = React.useMemo(() => {
    const qs = new URLSearchParams()
    qs.set('page', String(page))
    qs.set('pageSize', String(pageSize))
    if (applied.postCode) qs.set('postCode', applied.postCode)
    if (applied.postName) qs.set('postName', applied.postName)
    if (applied.status) qs.set('status', applied.status)
    return qs.toString()
  }, [page, applied])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'posts', params],
    queryFn: () => api<ListResp>(`${RESOURCE}?${params}`),
  })
  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const saveMut = useMutation({
    mutationFn: () =>
      editing
        ? api(`${RESOURCE}/${editing.id}`, { method: 'PUT', body: JSON.stringify(form) })
        : api(RESOURCE, { method: 'POST', body: JSON.stringify(form) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'posts'] })
      setOpen(false)
      toast.success(editing ? '修改成功' : '新增成功')
    },
    onError: (e: Error) => setErr(e.message),
  })
  const delMut = useMutation({
    mutationFn: (ids: string[]) =>
      api(RESOURCE, { method: 'DELETE', body: JSON.stringify({ ids }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'posts'] })
      toast.success('删除成功')
      setSelected(new Set())
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const handleSearch = () => {
    setPage(1)
    setApplied(search)
  }
  const handleReset = () => {
    setSearch({ postCode: '', postName: '', status: '' })
    setApplied({ postCode: '', postName: '', status: '' })
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
  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY)
    setErr(null)
    setOpen(true)
  }
  const openEdit = (p: Post) => {
    setEditing(p)
    setForm({
      postCode: p.postCode,
      postName: p.postName,
      postSort: p.postSort,
      status: p.status,
      remark: p.remark ?? '',
    })
    setErr(null)
    setOpen(true)
  }
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    if (!form.postCode.trim() || !form.postName.trim()) {
      setErr('岗位编码和名称不能为空')
      return
    }
    saveMut.mutate()
  }
  const handleExport = () =>
    exportFromApi(
      `${RESOURCE}?pageSize=9999&${new URLSearchParams(applied as Record<string, string>)}`,
      'posts',
      [
        { key: 'id', title: 'ID' },
        { key: 'postCode', title: '岗位编码' },
        { key: 'postName', title: '岗位名称' },
        { key: 'postSort', title: '排序' },
        { key: 'status', title: '状态', formatter: (v) => (Number(v) === 0 ? '正常' : '停用') },
        { key: 'remark', title: '备注' },
        { key: 'createdAt', title: '创建时间' },
      ],
    ).then((ok) => (ok ? toast.success('导出成功') : toast.error('导出失败')))

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Briefcase className="h-6 w-6 text-primary" />
          岗位管理
        </h1>
        <HasPermi code="system:post:add">
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            新增
          </Button>
        </HasPermi>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
        <div className="space-y-1.5">
          <Label className="text-xs">岗位编码</Label>
          <Input
            value={search.postCode}
            onChange={(e) => setSearch({ ...search, postCode: e.target.value })}
            placeholder="岗位编码"
            className={inputCls}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">岗位名称</Label>
          <Input
            value={search.postName}
            onChange={(e) => setSearch({ ...search, postName: e.target.value })}
            placeholder="岗位名称"
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
              <SelectItem value="0">正常</SelectItem>
              <SelectItem value="1">停用</SelectItem>
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
        <HasPermi code="system:post:remove">
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
        </HasPermi>
        <HasPermi code="system:post:export">
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
              <th className={th}>岗位编码</th>
              <th className={th}>岗位名称</th>
              <th className={th}>排序</th>
              <th className={th}>状态</th>
              <th className={th}>备注</th>
              <th className={th}>创建时间</th>
              <th className={th}>操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                </td>
              </tr>
            ) : list.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                  暂无数据
                </td>
              </tr>
            ) : (
              list.map((p) => (
                <tr key={p.id} className="transition-colors hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <Checkbox
                      checked={selected.has(p.id)}
                      onCheckedChange={() => toggleOne(p.id)}
                    />
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{p.id}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{p.postCode}</td>
                  <td className="px-4 py-2.5 font-medium">{p.postName}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{p.postSort}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2 py-0.5 text-xs',
                        p.status === 0
                          ? 'bg-emerald-500/10 text-emerald-600'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {p.status === 0 ? '正常' : '停用'}
                    </span>
                  </td>
                  <td
                    className="max-w-[160px] truncate px-4 py-2.5 text-xs text-muted-foreground"
                    title={p.remark}
                  >
                    {p.remark || '-'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">
                    {p.createdAt ? new Date(p.createdAt).toLocaleString() : '-'}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1">
                      <HasPermi code="system:post:edit">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </HasPermi>
                      <HasPermi code="system:post:remove">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => {
                            if (confirm('确认删除？')) delMut.mutate([p.id])
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </HasPermi>
                    </div>
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

      <Dialog open={open} onOpenChange={(o) => (o ? null : (setOpen(false), setErr(null)))}>
        <DialogContent>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editing ? '编辑岗位' : '新增岗位'}</DialogTitle>
            </DialogHeader>
            {err && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="p-name">岗位名称</Label>
              <Input
                id="p-name"
                value={form.postName}
                onChange={(e) => setForm({ ...form, postName: e.target.value })}
                placeholder="岗位名称"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-code">岗位编码</Label>
              <Input
                id="p-code"
                value={form.postCode}
                onChange={(e) => setForm({ ...form, postCode: e.target.value })}
                placeholder="岗位编码"
                disabled={!!editing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-sort">排序</Label>
              <Input
                id="p-sort"
                type="number"
                value={form.postSort}
                onChange={(e) => setForm({ ...form, postSort: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>状态</Label>
              <Select
                value={String(form.status)}
                onValueChange={(v) => setForm({ ...form, status: Number(v) })}
              >
                <SelectTrigger className={inputCls}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">正常</SelectItem>
                  <SelectItem value="1">停用</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-remark">备注</Label>
              <textarea
                id="p-remark"
                value={form.remark}
                onChange={(e) => setForm({ ...form, remark: e.target.value })}
                rows={2}
                className={textareaCls}
              />
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
                {saveMut.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}保存
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
