'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Download, ChevronLeft, ChevronRight } from 'lucide-react'

import { exportToExcel } from '@/lib/export-utils'
import { HasPermi } from '@/components/auth/HasPermi'
import { Button } from '@ihui/ui'

import { ZhsActivityFilter } from './ZhsActivityFilter'
import { ZhsActivityTable } from './ZhsActivityTable'
import { ZhsActivityDialog } from './ZhsActivityDialog'
import { PAGE_SIZE, api, EMPTY_FORM, EXPORT_COLUMNS, activityToForm } from './helpers'
import type { ZhsActivity, ZhsActivityForm, ListData } from './types'

export default function ZhsActivityPage() {
  const qc = useQueryClient()
  const [searchName, setSearchName] = React.useState('')
  const [searchBegin, setSearchBegin] = React.useState('')
  const [debouncedName, setDebouncedName] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<ZhsActivity | null>(null)
  const [form, setForm] = React.useState<ZhsActivityForm>(EMPTY_FORM)
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
    setForm(EMPTY_FORM)
    setErr(null)
    setOpen(true)
  }
  function openEdit(item: ZhsActivity) {
    setEditing(item)
    setForm(activityToForm(item))
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

      <ZhsActivityFilter
        searchName={searchName}
        setSearchName={setSearchName}
        searchBegin={searchBegin}
        setSearchBegin={(v) => {
          setSearchBegin(v)
          setPage(1)
        }}
      />

      <ZhsActivityTable
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

      <ZhsActivityDialog
        open={open}
        editing={editing}
        form={form}
        setForm={setForm}
        err={err}
        savePending={saveMut.isPending}
        onSubmit={submit}
        onClose={closeDialog}
      />
    </div>
  )
}
