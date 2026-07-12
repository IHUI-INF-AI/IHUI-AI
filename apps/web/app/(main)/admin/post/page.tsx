'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Briefcase, Plus, Trash2, Download, ChevronLeft, ChevronRight } from 'lucide-react'

import { exportFromApi } from '@/lib/export-utils'
import { HasPermi } from '@/components/auth/HasPermi'
import { Button } from '@ihui/ui'
import { PostFilter } from './PostFilter'
import { PostTable } from './PostTable'
import { PostDialog } from './PostDialog'
import { RESOURCE, PAGE_SIZE, EMPTY, EXPORT_COLUMNS, api } from './helpers'
import type { Post, ListResp, PostForm, PostSearch } from './types'

const EMPTY_SEARCH: PostSearch = { postCode: '', postName: '', status: '' }

export default function PostPage() {
  const qc = useQueryClient()
  const [search, setSearch] = React.useState<PostSearch>(EMPTY_SEARCH)
  const [applied, setApplied] = React.useState<PostSearch>(EMPTY_SEARCH)
  const [page, setPage] = React.useState(1)
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Post | null>(null)
  const [form, setForm] = React.useState<PostForm>(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  const params = React.useMemo(() => {
    const qs = new URLSearchParams()
    qs.set('page', String(page))
    qs.set('pageSize', String(PAGE_SIZE))
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
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

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
    setSearch(EMPTY_SEARCH)
    setApplied(EMPTY_SEARCH)
    setPage(1)
  }
  const toggleAll = () =>
    setSelected(selected.size === list.length ? new Set() : new Set(list.map((l) => l.id)))
  const toggleOne = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
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
  const closeDialog = () => {
    setOpen(false)
    setErr(null)
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
      `${RESOURCE}?pageSize=9999&${new URLSearchParams(applied as unknown as Record<string, string>)}`,
      'posts',
      EXPORT_COLUMNS,
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

      <PostFilter
        search={search}
        onSearchChange={setSearch}
        onSearch={handleSearch}
        onReset={handleReset}
      />

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

      <PostTable
        list={list}
        isLoading={isLoading}
        selected={selected}
        onToggleAll={toggleAll}
        onToggleOne={toggleOne}
        onEdit={openEdit}
        onDelete={(id) => delMut.mutate([id])}
      />

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

      <PostDialog
        open={open}
        editing={!!editing}
        form={form}
        err={err}
        isPending={saveMut.isPending}
        onFormChange={setForm}
        onClose={closeDialog}
        onSubmit={submit}
      />
    </div>
  )
}
