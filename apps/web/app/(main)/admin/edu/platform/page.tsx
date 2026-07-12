'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { eduApi, buildQs, type PageData } from '@/lib/edu'
import { exportFromApi } from '@/lib/export-utils'
import { Button } from '@ihui/ui'

import { EMPTY, PAGE_SIZE, API, EXPORT_COLS } from './helpers'
import type { EduPlatform, CForm } from './types'
import { PlatformFilter } from './PlatformFilter'
import { PlatformTable } from './PlatformTable'
import { PlatformDialog } from './PlatformDialog'

export default function EduPlatformPage() {
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [q, setQ] = React.useState({ code: '', name: '' })
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<EduPlatform | null>(null)
  const [form, setForm] = React.useState<CForm>(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  const params = { page, pageSize: PAGE_SIZE, ...q }
  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'platform', params],
    queryFn: () => eduApi<PageData<EduPlatform>>(`${API}${buildQs(params)}`),
  })
  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        code: form.code,
        name: form.name,
        domain: form.domain || undefined,
        remark: form.remark || undefined,
        binding: form.binding || undefined,
        filePath: form.filePath || undefined,
        type: Number(form.type),
        status: form.status ? 1 : 0,
        sort: Number(form.sort) || 0,
        field1: form.field1 || undefined,
        field2: form.field2 || undefined,
      }
      return editing
        ? eduApi(`${API}/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) })
        : eduApi(API, { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(editing ? '更新成功' : '创建成功')
      qc.invalidateQueries({ queryKey: ['edu', 'platform'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => eduApi(`${API}/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('删除成功')
      qc.invalidateQueries({ queryKey: ['edu', 'platform'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setErr(null)
    setOpen(true)
  }
  function openEdit(r: EduPlatform) {
    setEditing(r)
    setForm({
      code: r.code,
      name: r.name,
      domain: r.domain ?? '',
      remark: r.remark ?? '',
      binding: r.binding ?? '',
      filePath: r.filePath ?? '',
      type: String(r.type ?? 0),
      status: r.status === 1,
      sort: String(r.sort ?? 0),
      field1: r.field1 ?? '',
      field2: r.field2 ?? '',
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
    if (!form.code.trim()) return setErr('编码不能为空')
    if (!form.name.trim()) return setErr('名称不能为空')
    saveMut.mutate()
  }
  function handleExport() {
    exportFromApi(
      `${API}${buildQs({ ...q, pageSize: 10000 })}`,
      `educationPlatform_${Date.now()}`,
      EXPORT_COLS,
    ).then((ok) => toast[ok ? 'success' : 'error'](ok ? '导出成功' : '导出失败'))
  }
  function handleDelete(r: EduPlatform) {
    if (window.confirm('确定删除？')) deleteMut.mutate(r.id)
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rows = data?.list ?? []

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">平台发布管理</h1>
        <p className="mt-1 text-sm text-muted-foreground">教育平台发布与绑定管理</p>
      </div>
      <PlatformFilter
        q={q}
        onQChange={(patch) => {
          setQ({ ...q, ...patch })
          setPage(1)
        }}
        onReset={() => {
          setQ({ code: '', name: '' })
          setPage(1)
        }}
        onCreate={openCreate}
        onExport={handleExport}
      />
      <PlatformTable
        rows={rows}
        isLoading={isLoading}
        error={error as Error | null}
        onEdit={openEdit}
        onDelete={handleDelete}
        deletePending={deleteMut.isPending}
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
      <PlatformDialog
        open={open}
        editing={editing}
        form={form}
        onFormChange={(patch) => setForm({ ...form, ...patch })}
        onClose={closeDialog}
        onSubmit={submit}
        pending={saveMut.isPending}
        err={err}
      />
    </div>
  )
}
