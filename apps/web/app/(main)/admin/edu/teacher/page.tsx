'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { eduApi, buildQs, type PageData } from '@/lib/edu'
import { Button } from '@ihui/ui'

import { EMPTY, PAGE_SIZE } from './helpers'
import type { Teacher, TForm } from './types'
import { TeacherFilter } from './TeacherFilter'
import { TeacherTable } from './TeacherTable'
import { TeacherDialog } from './TeacherDialog'

export default function EduTeacherPage() {
  const t = useTranslations('admin.edu.teacher')
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Teacher | null>(null)
  const [form, setForm] = React.useState<TForm>(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [search])

  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'teacher', debounced, page],
    queryFn: () =>
      eduApi<PageData<Teacher>>(
        `/api/admin/users${buildQs({ page, pageSize: PAGE_SIZE, search: debounced, role: 'teacher' })}`,
      ),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        nickname: form.nickname.trim(),
        phone: form.phone.trim() || null,
        title: form.title,
        intro: form.intro.trim() || null,
        status: form.status,
      }
      if (editing)
        return eduApi(`/api/admin/users/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
      return eduApi(`/api/admin/users`, {
        method: 'POST',
        body: JSON.stringify({ ...body, role: 'teacher' }),
      })
    },
    onSuccess: () => {
      toast.success(editing ? t('updateSuccess') : t('createSuccess'))
      qc.invalidateQueries({ queryKey: ['edu', 'teacher'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => eduApi(`/api/admin/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['edu', 'teacher'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setErr(null)
    setOpen(true)
  }
  function openEdit(tc: Teacher) {
    setEditing(tc)
    setForm({
      nickname: tc.nickname,
      phone: tc.phone ?? '',
      title: tc.title,
      intro: tc.intro ?? '',
      status: tc.status,
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
    if (!form.nickname.trim()) return setErr(t('nicknameRequired'))
    saveMut.mutate()
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
      <TeacherFilter search={search} onSearchChange={setSearch} onCreate={openCreate} />
      <TeacherTable
        rows={rows}
        isLoading={isLoading}
        error={error as Error | null}
        onEdit={openEdit}
        onDelete={(tc) => {
          if (window.confirm(t('deleteConfirm'))) deleteMut.mutate(tc.id)
        }}
        deletePending={deleteMut.isPending}
      />
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{t('totalItems', { total })}</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
            {t('prev')}
          </Button>
          <span className="text-sm text-muted-foreground">{t('pageOf', { page, totalPages })}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('next')}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <TeacherDialog
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
