'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Menu as MenuIcon, Plus, Edit, Trash2, Loader2, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'

import { fetchApi } from '@/lib/api'
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
import { DataTable, type Column } from '@/components/data'
import { cn } from '@/lib/utils'

interface MenuItem {
  id: string
  name: string
  icon: string
  path: string
  sort: number
  parentId: string | null
  visible: boolean
  [key: string]: unknown
}

interface MenuForm {
  name: string
  icon: string
  path: string
  sort: number
  parentId: string | null
  visible: boolean
}

const EMPTY_FORM: MenuForm = {
  name: '',
  icon: '',
  path: '',
  sort: 0,
  parentId: null,
  visible: true,
}
const PAGE_SIZE = 20

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export default function MenuPage() {
  const qc = useQueryClient()
  const [search, setSearch] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<MenuItem | null>(null)
  const [form, setForm] = React.useState<MenuForm>(EMPTY_FORM)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'menu', search, page],
    queryFn: async () => {
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        keyword: search,
      })
      const res = await api<{ list: MenuItem[]; total: number } | MenuItem[]>(
        `/api/admin/menu?${qs}`,
      )
      const list = Array.isArray(res) ? res : (res.list ?? [])
      const total = Array.isArray(res) ? res.length : (res.total ?? 0)
      return { list, total }
    },
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = { ...form, sort: Number(form.sort) }
      return editing
        ? api(`/api/admin/menu/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) })
        : api('/api/admin/menu', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'menu'] })
      close()
      toast.success('保存成功')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const delMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/menu/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'menu'] })
      toast.success('删除成功')
    },
  })

  const toggleVisibleMut = useMutation({
    mutationFn: (m: MenuItem) =>
      api(`/api/admin/menu/${m.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...m, visible: !m.visible }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'menu'] }),
  })

  function openCreate(parentId?: string) {
    setEditing(null)
    setForm({ ...EMPTY_FORM, parentId: parentId ?? null })
    setOpen(true)
  }
  function openEdit(m: MenuItem) {
    setEditing(m)
    setForm({
      name: m.name,
      icon: m.icon,
      path: m.path,
      sort: m.sort,
      parentId: m.parentId,
      visible: m.visible,
    })
    setOpen(true)
  }
  function close() {
    if (saveMut.isPending) return
    setOpen(false)
    setEditing(null)
    setForm(EMPTY_FORM)
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error('请输入菜单名称')
      return
    }
    saveMut.mutate()
  }

  const list = data?.list ?? []
  const total = data?.total ?? 0

  const columns: Column<MenuItem>[] = [
    {
      key: 'name',
      title: '菜单名称',
      render: (m) => <span className="font-medium">{m.name}</span>,
    },
    {
      key: 'icon',
      title: '图标',
      render: (m) => (
        <code className="font-mono text-xs text-muted-foreground">{m.icon || '-'}</code>
      ),
    },
    {
      key: 'path',
      title: '路由路径',
      render: (m) => (
        <code className="font-mono text-xs text-muted-foreground">{m.path || '-'}</code>
      ),
    },
    {
      key: 'sort',
      title: '排序',
      render: (m) => <span className="text-muted-foreground">{m.sort}</span>,
    },
    {
      key: 'parentId',
      title: '父菜单',
      render: (m) => {
        const parent = list.find((p) => p.id === m.parentId)
        return <span className="text-muted-foreground">{parent?.name ?? '顶级菜单'}</span>
      },
    },
    {
      key: 'visible',
      title: '显示',
      render: (m) => (
        <button
          onClick={() => toggleVisibleMut.mutate(m)}
          className="inline-flex items-center gap-1"
        >
          {m.visible ? (
            <Eye className="h-4 w-4 text-emerald-500" />
          ) : (
            <EyeOff className="h-4 w-4 text-muted-foreground" />
          )}
          <span className={cn('text-xs', m.visible ? 'text-emerald-600' : 'text-muted-foreground')}>
            {m.visible ? '显示' : '隐藏'}
          </span>
        </button>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      align: 'right',
      render: (m) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => openEdit(m)}>
            <Edit className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => openCreate(m.id)}>
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            disabled={delMut.isPending}
            onClick={() => {
              if (confirm('确认删除该菜单?')) delMut.mutate(m.id)
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <MenuIcon className="h-6 w-6 text-primary" />
            菜单管理
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            管理后台侧边栏菜单的增删改查与层级关系
          </p>
        </div>
        <Button size="sm" onClick={() => openCreate()}>
          <Plus className="h-4 w-4" />
          新建菜单
        </Button>
      </div>

      <Input
        placeholder="搜索菜单名称..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value)
          setPage(1)
        }}
        className="max-w-sm"
      />

      <DataTable
        columns={columns}
        data={list}
        rowKey={(m) => m.id}
        loading={isLoading}
        pagination={{ page, pageSize: PAGE_SIZE, total }}
        onPageChange={setPage}
      />

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <DialogContent>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editing ? '编辑菜单' : '新建菜单'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="m-name">菜单名称</Label>
              <Input
                id="m-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="请输入菜单名称"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="m-icon">图标</Label>
                <Input
                  id="m-icon"
                  value={form.icon}
                  onChange={(e) => setForm({ ...form, icon: e.target.value })}
                  placeholder="如 Settings"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="m-sort">排序权重</Label>
                <Input
                  id="m-sort"
                  type="number"
                  value={form.sort}
                  onChange={(e) => setForm({ ...form, sort: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="m-path">路由路径</Label>
              <Input
                id="m-path"
                value={form.path}
                onChange={(e) => setForm({ ...form, path: e.target.value })}
                placeholder="/admin/menu"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="m-parent">父菜单</Label>
              <select
                id="m-parent"
                value={form.parentId ?? ''}
                onChange={(e) => setForm({ ...form, parentId: e.target.value || null })}
                className={selectClass}
              >
                <option value="">顶级菜单</option>
                {list
                  .filter((m) => m.id !== editing?.id)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </select>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.visible}
                onChange={(e) => setForm({ ...form, visible: e.target.checked })}
                className="h-4 w-4 accent-primary"
              />
              是否显示
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close} disabled={saveMut.isPending}>
                取消
              </Button>
              <Button type="submit" disabled={saveMut.isPending}>
                {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                保存
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
