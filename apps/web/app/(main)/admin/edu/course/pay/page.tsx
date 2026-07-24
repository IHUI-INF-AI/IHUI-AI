'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { eduApi, buildQs, type PageData } from '@/lib/edu'
import { exportFromApi } from '@/lib/export-utils'
import { Button } from '@ihui/ui-react'

import { CoursePayFilter } from './CoursePayFilter'
import { CoursePayTable } from './CoursePayTable'
import { CoursePayDialog } from './CoursePayDialog'
import { PAGE_SIZE, EMPTY_FORM, EMPTY_SEARCH, EXPORT_COLS, coursePayToForm } from './helpers'
import type { CoursePay, CForm, CoursePaySearch } from './types'

export default function EduCoursePayPage() {
  const t = useTranslations('admin.edu.course.pay')
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [q, setQ] = React.useState<CoursePaySearch>(EMPTY_SEARCH)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<CoursePay | null>(null)
  const [form, setForm] = React.useState<CForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)

  const params = { page, pageSize: PAGE_SIZE, ...q }
  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'course-pay', params],
    queryFn: () => eduApi<PageData<CoursePay>>(`/api/admin/course/pay${buildQs(params)}`),
  })
  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        courseId: form.courseId,
        payType: Number(form.payType),
        payCrowd: Number(form.payCrowd),
        amount: form.amount,
      }
      return editing
        ? eduApi(`/api/admin/course/pay/${editing.id}`, {
            method: 'PUT',
            body: JSON.stringify(body),
          })
        : eduApi(`/api/admin/course/pay`, { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(editing ? t('updateSuccess') : t('createSuccess'))
      qc.invalidateQueries({ queryKey: ['edu', 'course-pay'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => eduApi(`/api/admin/course/pay/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['edu', 'course-pay'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErr(null)
    setOpen(true)
  }
  function openEdit(r: CoursePay) {
    setEditing(r)
    setForm(coursePayToForm(r))
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
    if (!form.courseId.trim()) return setErr(t('courseIdRequired'))
    saveMut.mutate()
  }
  function handleDelete(r: CoursePay) {
    if (window.confirm(t('confirmDelete'))) deleteMut.mutate(r.id)
  }
  function handleExport() {
    exportFromApi(
      `/api/admin/course/pay${buildQs({ ...q, pageSize: 10000 })}`,
      `coursePay_${Date.now()}`,
      EXPORT_COLS,
      t,
    ).then((ok) => toast[ok ? 'success' : 'error'](ok ? t('exportSuccess') : t('exportFailed')))
  }
  function patchQ(patch: Partial<CoursePaySearch>) {
    setQ((s) => ({ ...s, ...patch }))
    setPage(1)
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rows = data?.list ?? []

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>
      <CoursePayFilter
        q={q}
        onQChange={patchQ}
        onReset={() => {
          setQ(EMPTY_SEARCH)
          setPage(1)
        }}
        onCreate={openCreate}
        onExport={handleExport}
      />
      <CoursePayTable
        list={rows}
        isLoading={isLoading}
        error={error}
        deletePending={deleteMut.isPending}
        onEdit={openEdit}
        onDelete={handleDelete}
      />
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{t('totalItems', { count: total })}</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
            {t('prevPage')}
          </Button>
          <span className="text-sm text-muted-foreground">
            {t('pageInfo', { page, totalPages })}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('nextPage')}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <CoursePayDialog
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
