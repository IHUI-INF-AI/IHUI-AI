'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { eduApi, buildQs, type PageData } from '@/lib/edu'
import { exportFromApi } from '@/lib/export-utils'
import { Button } from '@ihui/ui'

import { RecordedFilter } from './RecordedFilter'
import { RecordedTable } from './RecordedTable'
import { RecordedDialog } from './RecordedDialog'
import { PAGE_SIZE, API, LEVEL_TEXT, AUDIT_TEXT, EMPTY_FORM, videoToForm } from './helpers'
import type { Video, CForm, RecordedSearch } from './types'

export default function EduLearnRecordedPage() {
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [urlCourseId] = React.useState(() =>
    typeof window !== 'undefined'
      ? (new URLSearchParams(window.location.search).get('courseId') ?? '')
      : '',
  )
  const [q, setQ] = React.useState<RecordedSearch>({ title: '', label: '', creator: '' })
  const [ids, setIds] = React.useState<string[]>([])
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Video | null>(null)
  const [form, setForm] = React.useState<CForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)

  const params = { page, pageSize: PAGE_SIZE, courseId: urlCourseId, ...q }
  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'course-video', params],
    queryFn: () => eduApi<PageData<Video>>(`${API}${buildQs(params)}`),
  })
  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        courseId: form.courseId.trim() || null,
        videoPath: form.videoPath.trim() || null,
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || null,
        content: form.content,
        remark: form.remark,
        lecturer: form.lecturer.trim() || null,
        duration: form.duration.trim() || null,
        adjunctUrl: form.adjunctUrl.trim() || null,
        isPay: Number(form.isPay),
        amount: form.amount,
        label: form.label.trim() || null,
        agentIds: form.agentIds.trim() || null,
        hot: Number(form.hot) || 0,
        collect: Number(form.collect) || 0,
        sort: Number(form.sort) || 0,
        creator: form.creator.trim() || null,
        binding: form.binding || null,
        status: Number(form.status),
        auditStatus: Number(form.auditStatus),
      }
      return editing
        ? eduApi(`${API}/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) })
        : eduApi(API, { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(editing ? '更新成功' : '创建成功')
      qc.invalidateQueries({ queryKey: ['edu', 'course-video'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => eduApi(`${API}/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('删除成功')
      qc.invalidateQueries({ queryKey: ['edu', 'course-video'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const batchDeleteMut = useMutation({
    mutationFn: (ids: string[]) => eduApi(`${API}/${ids.join(',')}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('批量删除成功')
      setIds([])
      qc.invalidateQueries({ queryKey: ['edu', 'course-video'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm({ ...EMPTY_FORM, courseId: urlCourseId })
    setErr(null)
    setOpen(true)
  }
  function openEdit(r: Video) {
    setEditing(r)
    setForm(videoToForm(r))
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
  function handleSearchChange(newQ: RecordedSearch) {
    setQ(newQ)
    setPage(1)
  }
  function handleReset() {
    setQ({ title: '', label: '', creator: '' })
    setPage(1)
  }
  function handleExport() {
    exportFromApi(
      `${API}${buildQs({ ...q, courseId: urlCourseId, pageSize: 10000 })}`,
      `courseVideo_${Date.now()}`,
      [
        { key: 'id', title: 'ID' },
        { key: 'courseId', title: '课程ID' },
        { key: 'title', title: '标题' },
        { key: 'lecturer', title: '讲师' },
        { key: 'duration', title: '时长' },
        { key: 'isPay', title: '付费', formatter: (v) => (Number(v) === 1 ? '付费' : '免费') },
        { key: 'amount', title: '金额' },
        { key: 'label', title: '标签' },
        { key: 'hot', title: '热度' },
        { key: 'status', title: '难度', formatter: (v) => LEVEL_TEXT[Number(v)] ?? String(v) },
        { key: 'auditStatus', title: '审核', formatter: (v) => AUDIT_TEXT[Number(v)] ?? String(v) },
        { key: 'creator', title: '创建人' },
      ],
    ).then((ok) => toast[ok ? 'success' : 'error'](ok ? '导出成功' : '导出失败'))
  }
  function handleBatchDelete() {
    if (window.confirm(`确定删除选中的 ${ids.length} 项？`)) batchDeleteMut.mutate(ids)
  }
  function handleDelete(r: Video) {
    if (window.confirm('确定删除？')) deleteMut.mutate(r.id)
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
        <h1 className="text-2xl font-bold tracking-tight">课程视频</h1>
        <p className="mt-1 text-sm text-muted-foreground">管理课程视频、审核与付费信息</p>
      </div>
      <RecordedFilter
        q={q}
        onSearchChange={handleSearchChange}
        onReset={handleReset}
        onCreate={openCreate}
        onBatchDelete={handleBatchDelete}
        onExport={handleExport}
        idsCount={ids.length}
      />
      <RecordedTable
        rows={rows}
        isLoading={isLoading}
        error={error as Error | null}
        ids={ids}
        allChecked={allChecked}
        onToggleAll={toggleAll}
        onToggleOne={toggleOne}
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
      <RecordedDialog
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
