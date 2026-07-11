'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Edit, Trash2, Loader2, ChevronLeft, ChevronRight, Building2 } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'
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

interface CompanyType {
  id: string
  name: string
  description: string | null
  sort: number
  status: number
  createdAt: string
  updatedAt: string
}

interface CompanyTypesData {
  list: CompanyType[]
  total: number
}

const PAGE_SIZE = 20

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

function fetchCompanyTypes(params: { page: number }): Promise<CompanyTypesData> {
  const qs = new URLSearchParams({ page: String(params.page), pageSize: String(PAGE_SIZE) })
  return api<CompanyTypesData>(`/api/admin/member/company-types?${qs.toString()}`)
}

interface TypeForm {
  name: string
  description: string
  sort: string
  status: boolean
}

const EMPTY_FORM: TypeForm = {
  name: '',
  description: '',
  sort: '0',
  status: true,
}

export default function AdminMemberCompanyTypesPage() {
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<CompanyType | null>(null)
  const [form, setForm] = React.useState<TypeForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'member', 'company-types', page],
    queryFn: () => fetchCompanyTypes({ page }),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        sort: Number(form.sort) || 0,
        status: form.status ? 1 : 0,
      }
      if (editing) {
        return api<{ type: CompanyType }>(`/api/admin/member/company-types/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
      }
      return api<{ type: CompanyType }>(`/api/admin/member/company-types`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      toast.success(editing ? '更新成功' : '创建成功')
      qc.invalidateQueries({ queryKey: ['admin', 'member', 'company-types'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/member/company-types/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('删除成功')
      qc.invalidateQueries({ queryKey: ['admin', 'member', 'company-types'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErr(null)
    setOpen(true)
  }

  function openEdit(type: CompanyType) {
    setEditing(type)
    setForm({
      name: type.name,
      description: type.description ?? '',
      sort: String(type.sort),
      status: type.status === 1,
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
    if (!form.name.trim()) {
      setErr('名称不能为空')
      return
    }
    saveMut.mutate()
  }

  function handleDelete(type: CompanyType) {
    if (!window.confirm(`确定删除「${type.name}」？`)) return
    deleteMut.mutate(type.id)
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const types = data?.list ?? []

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">公司类型管理</h1>
        <p className="mt-1 text-sm text-muted-foreground">管理会员公司的分类类型</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/member/companies">
            <ChevronLeft className="h-4 w-4" />
            返回公司列表
          </Link>
        </Button>
        <Button onClick={openCreate} size="sm" className="ml-auto">
          <Plus className="h-4 w-4" />
          新建类型
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-4 py-2.5">名称</TableHead>
              <TableHead className="px-4 py-2.5">描述</TableHead>
              <TableHead className="px-4 py-2.5">排序</TableHead>
              <TableHead className="px-4 py-2.5">状态</TableHead>
              <TableHead className="px-4 py-2.5">创建时间</TableHead>
              <TableHead className="px-4 py-2.5 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  加载中...
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={6} className="px-4 py-10 text-center text-destructive">
                  {(error as Error).message}
                </TableCell>
              </TableRow>
            ) : types.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  <Building2 className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  暂无数据
                </TableCell>
              </TableRow>
            ) : (
              types.map((type) => {
                const enabled = type.status === 1
                return (
                  <TableRow key={type.id} className="hover:bg-muted/30">
                    <TableCell className="px-4 py-2.5 font-medium">{type.name}</TableCell>
                    <TableCell className="px-4 py-2.5">{type.description ?? '—'}</TableCell>
                    <TableCell className="px-4 py-2.5">{type.sort}</TableCell>
                    <TableCell className="px-4 py-2.5">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                          enabled
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        <span
                          className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            enabled ? 'bg-emerald-500' : 'bg-muted-foreground',
                          )}
                        />
                        {enabled ? '启用' : '禁用'}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">
                      {type.createdAt ? new Date(type.createdAt).toLocaleDateString() : '-'}
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(type)}
                          title="编辑"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(type)}
                          title="删除"
                          className="text-destructive hover:text-destructive"
                          disabled={deleteMut.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
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
            第 {page} / {totalPages} 页
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
        <DialogContent className="max-w-md">
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editing ? '编辑类型' : '新建类型'}</DialogTitle>
            </DialogHeader>
            {err && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="t-name">名称</Label>
              <Input
                id="t-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="请输入类型名称"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-desc">描述</Label>
              <Input
                id="t-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="可选"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="t-sort">排序</Label>
                <Input
                  id="t-sort"
                  type="number"
                  min="0"
                  value={form.sort}
                  onChange={(e) => setForm({ ...form, sort: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-status">状态</Label>
                <div className="flex h-9 items-center gap-2">
                  <Switch
                    id="t-status"
                    checked={form.status}
                    onCheckedChange={(v) => setForm({ ...form, status: v })}
                  />
                  <span className="text-sm text-muted-foreground">
                    {form.status ? '启用' : '禁用'}
                  </span>
                </div>
              </div>
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
