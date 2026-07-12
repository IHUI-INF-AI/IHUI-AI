'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { eduApi, buildQs, type PageData } from '@/lib/edu'
import { exportFromApi } from '@/lib/export-utils'
import { Button } from '@ihui/ui'

import { EMPTY, PAGE_SIZE, API, EXPORT_COLS } from './helpers'
import type { Course, CForm } from './types'
import { CourseFilter } from './CourseFilter'
import { CourseTable } from './CourseTable'
import { CourseDialog } from './CourseDialog'

export default function EduCoursePage() {
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [q, setQ] = React.useState({ title: '', stage: '', label: '', creator: '' })
  const [ids, setIds] = React.useState<string[]>([])
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Course | null>(null)
  const [form, setForm] = React.useState<CForm>(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  const params = { page, pageSize: PAGE_SIZE, ...q }
  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'course', params],
    queryFn: () => eduApi<PageData<Course>>(`${API}${buildQs(params)}`),
  })
  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || null,
        content: form.content,
        remark: form.remark.trim() || null,
        remarkFile: form.remarkFile.trim() || null,
        binding: form.binding || null,
        stage: Number(form.stage),
        label: form.label.trim() || null,
        creator: form.creator.trim() || null,
      }
      return editing
        ? eduApi(`${API}/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) })
        : eduApi(API, { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(editing ? '更新成功' : '创建成功')
      qc.invalidateQueries({ queryKey: ['edu', 'course'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => eduApi(`${API}/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('删除成功')
      qc.invalidateQueries({ queryKey: ['edu', 'course'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const batchDeleteMut = useMutation({
    mutationFn: (ids: string[]) => eduApi(`${API}/${ids.join(',')}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('批量删除成功')
      setIds([])
      qc.invalidateQueries({ queryKey: ['edu', 'course'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setErr(null)
    setOpen(true)
  }
  function openEdit(r: Course) {
    setEditing(r)
    setForm({
      title: r.title ?? '',
      subtitle: r.subtitle ?? '',
      content: r.content ?? '',
      remark: r.remark ?? '',
      remarkFile: r.remarkFile ?? '',
      binding: r.binding ?? '',
      stage: String(r.stage ?? 0),
      label: r.label ?? '',
      creator: r.creator ?? '',
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
    if (!form.title.trim()) return setErr('标题不能为空')
    saveMut.mutate()
  }
  function handleExport() {
    exportFromApi(
      `${API}${buildQs({ ...q, pageSize: 10000 })}`,
      `course_${Date.now()}`,
      EXPORT_COLS,
    ).then((ok) => toast[ok ? 'success' : 'error'](ok ? '导出成功' : '导出失败'))
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rows = data?.list ?? []
  const allChecked = rows.length > 0 && rows.every((r) => ids.includes(r.id))
  function toggleAll() {
    setIds(allChecked ? [] : rows.map((r) => r.id))
  }
  function toggleOne(id: string) {
    setIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">课程管理</h1>
        <p className="mt-1 text-sm text-muted-foreground">课程 CRUD、视频与价格管理</p>
      </div>
      <CourseFilter
        q={q}
        onQChange={(patch) => {
          setQ({ ...q, ...patch })
          setPage(1)
        }}
        onReset={() => {
          setQ({ title: '', stage: '', label: '', creator: '' })
          setPage(1)
        }}
        onCreate={openCreate}
        onBatchDelete={() => {
          if (window.confirm(`确定删除选中的 ${ids.length} 项？`)) batchDeleteMut.mutate(ids)
        }}
        onExport={handleExport}
        hasSelection={ids.length > 0}
      />
      <CourseTable
        rows={rows}
        isLoading={isLoading}
        error={error as Error | null}
        ids={ids}
        allChecked={allChecked}
        onToggleAll={toggleAll}
        onToggleOne={toggleOne}
        onEdit={openEdit}
        onDelete={(r) => {
          if (window.confirm('确定删除？')) deleteMut.mutate(r.id)
        }}
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
      <CourseDialog
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
