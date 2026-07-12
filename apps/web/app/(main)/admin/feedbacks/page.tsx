'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Plus, Download, ChevronLeft, ChevronRight } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button } from '@ihui/ui'
import { api as fbApi } from '@/lib/feedback'
import { HasPermi } from '@/components/auth/HasPermi'
import { exportToExcel } from '@/lib/export-utils'
import { FeedbackFilter } from './FeedbackFilter'
import { FeedbackTable } from './FeedbackTable'
import { FeedbackEditDialog, FeedbackCreateDialog } from './FeedbackDialog'
import { PAGE_SIZE, EMPTY_CREATE, EMPTY_SEARCH, EMPTY_EDIT_FORM, EXPORT_COLUMNS } from './helpers'
import type { AdminFeedbackItem, ListData, SearchState, EditForm, CreateForm } from './types'

export default function AdminFeedbacksPage() {
  const t = useTranslations('admin.feedbacks')
  const tc = useTranslations('common')
  const qc = useQueryClient()

  const [type, setType] = React.useState('all')
  const [status, setStatus] = React.useState('all')
  const [search, setSearch] = React.useState<SearchState>(EMPTY_SEARCH)
  const [debounced, setDebounced] = React.useState<SearchState>(EMPTY_SEARCH)
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<AdminFeedbackItem | null>(null)
  const [form, setForm] = React.useState<EditForm>(EMPTY_EDIT_FORM)
  const [err, setErr] = React.useState<string | null>(null)
  const [openCreate, setOpenCreate] = React.useState(false)
  const [createForm, setCreateForm] = React.useState<CreateForm>(EMPTY_CREATE)
  const [createErr, setCreateErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 400)
    return () => clearTimeout(timer)
  }, [search])

  const qs = React.useMemo(() => {
    const q = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
    if (type !== 'all') q.set('type', type)
    if (status !== 'all') q.set('status', status)
    if (debounced.title) q.set('title', debounced.title)
    if (debounced.creator) q.set('creator', debounced.creator)
    if (debounced.createdAt) q.set('createdAt', debounced.createdAt)
    return q.toString()
  }, [type, status, debounced, page])

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'feedbacks', type, status, debounced, page],
    queryFn: () => fbApi<ListData>(`/api/admin/feedbacks?${qs}`),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = { status: form.status, priority: form.priority }
      if (form.adminReply.trim()) body.adminReply = form.adminReply.trim()
      return fetchApi(`/api/admin/feedbacks/${editing?.id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      toast.success('更新成功')
      qc.invalidateQueries({ queryKey: ['admin', 'feedbacks'] })
      close()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const createMut = useMutation({
    mutationFn: () => {
      const body = {
        title: createForm.title.trim(),
        context: createForm.context.trim(),
        filePath: createForm.filePath || undefined,
        isDel: Number(createForm.isDel) || 0,
        feedback: createForm.feedback.trim() || undefined,
        feedbackPath: createForm.feedbackPath || undefined,
      }
      return fetchApi('/api/admin/feedbacks', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success('新增成功')
      qc.invalidateQueries({ queryKey: ['admin', 'feedbacks'] })
      closeCreate()
    },
    onError: (e: Error) => setCreateErr(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => fetchApi(`/api/admin/feedbacks/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('删除成功')
      qc.invalidateQueries({ queryKey: ['admin', 'feedbacks'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openEdit(fb: AdminFeedbackItem) {
    setEditing(fb)
    setForm({ status: fb.status, priority: fb.priority, adminReply: fb.adminReply ?? '' })
    setErr(null)
    setOpen(true)
  }
  function close() {
    if (saveMut.isPending) return
    setOpen(false)
    setEditing(null)
    setErr(null)
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    saveMut.mutate()
  }
  function openCreateDialog() {
    setCreateForm(EMPTY_CREATE)
    setCreateErr(null)
    setOpenCreate(true)
  }
  function closeCreate() {
    if (createMut.isPending) return
    setOpenCreate(false)
    setCreateErr(null)
  }
  function submitCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreateErr(null)
    if (!createForm.title.trim()) return setCreateErr('请输入标题')
    createMut.mutate()
  }
  function handleDelete(fb: AdminFeedbackItem) {
    if (!confirm(`确认删除反馈 "${fb.title}"?`)) return
    deleteMut.mutate(fb.id)
  }
  function handleReset() {
    setSearch(EMPTY_SEARCH)
    setType('all')
    setStatus('all')
    setPage(1)
  }
  function handleExport() {
    exportToExcel(
      `feedbacks_${Date.now()}`,
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
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <HasPermi code="ai:userfeedback:export">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4" />
              {tc('export')}
            </Button>
          </HasPermi>
          <HasPermi code="ai:userfeedback:add">
            <Button size="sm" onClick={openCreateDialog}>
              <Plus className="h-4 w-4" />
              {tc('add')}
            </Button>
          </HasPermi>
        </div>
      </div>

      <FeedbackFilter
        type={type}
        status={status}
        search={search}
        onTypeChange={setType}
        onStatusChange={setStatus}
        onSearchChange={setSearch}
        onReset={handleReset}
      />

      <FeedbackTable
        list={list}
        isLoading={isLoading}
        error={error as Error | null}
        onEdit={openEdit}
        onDelete={handleDelete}
      />

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            共 {total} 条 · 第 {page}/{totalPages} 页
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
              上一页
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              下一页
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <FeedbackEditDialog
        open={open}
        editing={editing}
        form={form}
        err={err}
        isPending={saveMut.isPending}
        onFormChange={setForm}
        onClose={close}
        onSubmit={submit}
      />

      <FeedbackCreateDialog
        open={openCreate}
        form={createForm}
        err={createErr}
        isPending={createMut.isPending}
        onFormChange={setCreateForm}
        onClose={closeCreate}
        onSubmit={submitCreate}
      />
    </div>
  )
}
