'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, ChevronLeft, ChevronRight, Download } from 'lucide-react'

import { exportToExcel } from '@/lib/export-utils'
import { HasPermi } from '@/components/auth/HasPermi'
import { Button } from '@ihui/ui'

import { UserAgentImageFilter } from './UserAgentImageFilter'
import { UserAgentImageTable } from './UserAgentImageTable'
import { UserAgentImageDialog } from './UserAgentImageDialog'
import {
  PAGE_SIZE,
  api,
  EMPTY_FORM,
  EMPTY_SEARCH,
  EXPORT_COLUMNS,
  userAgentImageToForm,
} from './helpers'
import type { UserAgentImage, UserAgentImageForm, UserAgentImageSearch, ListData } from './types'

export default function UserAgentImagePage() {
  const qc = useQueryClient()
  const [search, setSearch] = React.useState<UserAgentImageSearch>(EMPTY_SEARCH)
  const [debounced, setDebounced] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<UserAgentImage | null>(null)
  const [form, setForm] = React.useState<UserAgentImageForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(JSON.stringify(search))
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [search])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'user-agent-image', debounced, page],
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (search.userUuid) qs.set('userUuid', search.userUuid)
      if (search.imageName) qs.set('imageName', search.imageName)
      if (search.platform) qs.set('platform', search.platform)
      if (search.modelName) qs.set('modelName', search.modelName)
      return api<ListData>(`/api/admin/user-agent-image?${qs.toString()}`)
    },
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        userUuid: form.userUuid.trim(),
        imagePath: form.imagePath || undefined,
        imageName: form.imageName || undefined,
        type: form.type || undefined,
        platform: form.platform || undefined,
        modelName: form.modelName || undefined,
      }
      return editing
        ? api(`/api/admin/user-agent-image/${editing.id}`, {
            method: 'PUT',
            body: JSON.stringify(body),
          })
        : api('/api/admin/user-agent-image', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(editing ? '更新成功' : '新增成功')
      qc.invalidateQueries({ queryKey: ['admin', 'user-agent-image'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/user-agent-image/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('删除成功')
      qc.invalidateQueries({ queryKey: ['admin', 'user-agent-image'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErr(null)
    setOpen(true)
  }
  function openEdit(item: UserAgentImage) {
    setEditing(item)
    setForm(userAgentImageToForm(item))
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
    if (!form.userUuid.trim()) {
      setErr('请输入用户UUID')
      return
    }
    saveMut.mutate()
  }
  function handleDelete(item: UserAgentImage) {
    if (!window.confirm(`确认删除 "${item.imageName || item.id}" ?`)) return
    deleteMut.mutate(item.id)
  }
  function handleExport() {
    exportToExcel(
      '用户Agent图片',
      EXPORT_COLUMNS,
      (data?.list ?? []) as unknown as Record<string, unknown>[],
    )
  }

  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">用户Agent图片</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4" />
            导出
          </Button>
          <HasPermi code="ai:useragentimage:add">
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              新增
            </Button>
          </HasPermi>
        </div>
      </div>

      <UserAgentImageFilter
        search={search}
        onSearchChange={(patch) => setSearch({ ...search, ...patch })}
      />

      <UserAgentImageTable
        list={list}
        isLoading={isLoading}
        onEdit={openEdit}
        onDelete={handleDelete}
      />

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

      <UserAgentImageDialog
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
