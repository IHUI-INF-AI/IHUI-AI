'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, ChevronLeft, ChevronRight, Download } from 'lucide-react'

import { HasPermi } from '@/components/auth/HasPermi'
import { Button } from '@ihui/ui-react'

import { ZhsUserFilter } from './ZhsUserFilter'
import { ZhsUserTable } from './ZhsUserTable'
import { ZhsUserDialog } from './ZhsUserDialog'
import { PAGE_SIZE, api, EMPTY, FIELDS, buildQuery, zhsUserToForm, exportZhsUser } from './helpers'
import type { ZhsUser, ListData } from './types'
import { BackButton } from '@/components/common'

export default function ZhsUserPage() {
  const qc = useQueryClient()
  const [search, setSearch] = React.useState<Record<string, string>>({})
  const [debounced, setDebounced] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<ZhsUser | null>(null)
  const [form, setForm] = React.useState<Record<string, string>>({ ...EMPTY })
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(JSON.stringify(search))
      setPage(1)
    }, 400)
    return () => clearTimeout(tm)
  }, [search])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'zhs-user', debounced, page],
    queryFn: () => api<ListData>(`/api/admin/zhs-user?${buildQuery(search, page)}`),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {}
      FIELDS.forEach((f) => {
        body[f.key] = form[f.key]?.trim() || undefined
      })
      return editing
        ? api(`/api/admin/zhs-user/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) })
        : api('/api/admin/zhs-user', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(editing ? '更新成功' : '新增成功')
      qc.invalidateQueries({ queryKey: ['admin', 'zhs-user'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/zhs-user/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('删除成功')
      qc.invalidateQueries({ queryKey: ['admin', 'zhs-user'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm({ ...EMPTY })
    setErr(null)
    setOpen(true)
  }
  function openEdit(item: ZhsUser) {
    setEditing(item)
    setForm(zhsUserToForm(item))
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
    const missing = FIELDS.find((f) => f.required && !form[f.key]?.trim())
    if (missing) {
      setErr(`请输入${missing.label}`)
      return
    }
    saveMut.mutate()
  }
  function handleDelete(item: ZhsUser) {
    if (!window.confirm(`确认删除 "${item.nickname}" ?`)) return
    deleteMut.mutate(item.id)
  }
  function handleExport() {
    exportZhsUser(data?.list ?? [])
  }

  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-4 px-4 py-6">
      <BackButton />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex min-w-0 items-center gap-2 text-2xl font-bold tracking-tight">
          <span className="truncate">ZHS用户管理</span>
        </h1>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" className="shrink-0" onClick={handleExport}>
            <Download className="h-4 w-4 shrink-0" />
            <span className="whitespace-nowrap">导出</span>
          </Button>
          <HasPermi code="ai:zhs_user:add">
            <Button size="sm" className="shrink-0" onClick={openCreate}>
              <Plus className="h-4 w-4 shrink-0" />
              <span className="whitespace-nowrap">新增</span>
            </Button>
          </HasPermi>
        </div>
      </div>

      <ZhsUserFilter search={search} onSearchChange={(k, v) => setSearch({ ...search, [k]: v })} />

      <ZhsUserTable list={list} isLoading={isLoading} onEdit={openEdit} onDelete={handleDelete} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="shrink-0 whitespace-nowrap tabular-nums text-sm text-muted-foreground">
          共 {total} 条
        </span>
        <div className="flex shrink-0 flex-nowrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="whitespace-nowrap">上一页</span>
          </Button>
          <span className="shrink-0 whitespace-nowrap tabular-nums text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            <span className="whitespace-nowrap">下一页</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ZhsUserDialog
        open={open}
        editing={editing}
        form={form}
        onFormChange={(patch) => setForm({ ...form, ...patch })}
        err={err}
        savePending={saveMut.isPending}
        onSubmit={submit}
        onClose={closeDialog}
      />
    </div>
  )
}
