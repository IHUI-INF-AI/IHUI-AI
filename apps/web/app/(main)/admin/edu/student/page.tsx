'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { eduApi, buildQs, type PageData } from '@/lib/edu'
import { Button, Card, CardContent } from '@ihui/ui-react'

import { EMPTY, PAGE_SIZE } from './helpers'
import type { Student, SForm } from './types'
import { StudentFilter } from './StudentFilter'
import { StudentTable } from './StudentTable'
import { StudentDialog } from './StudentDialog'

export default function EduStudentPage() {
  const t = useTranslations('admin.edu.student')
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [levelFilter, setLevelFilter] = React.useState('all')
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Student | null>(null)
  const [form, setForm] = React.useState<SForm>(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [search])
  React.useEffect(() => {
    setPage(1)
  }, [levelFilter])

  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'student', debounced, levelFilter, page],
    queryFn: () =>
      eduApi<PageData<Student>>(
        `/api/admin/users${buildQs({ page, pageSize: PAGE_SIZE, search: debounced, role: 0, level: levelFilter === 'all' ? '' : levelFilter })}`,
      ),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const base = {
        nickname: form.nickname.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
      }
      if (editing) {
        // 编辑:不支持改密码(stub PUT /admin/users/:id strict 模式),密码修改走单独端点
        return eduApi(`/api/admin/users/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            ...base,
            level: Number(form.level),
            status: form.status,
          }),
        })
      }
      return eduApi(`/api/admin/users`, {
        method: 'POST',
        body: JSON.stringify({
          ...base,
          password: form.password || '123456',
          roleId: 0,
          status: form.status,
        }),
      })
    },
    onSuccess: () => {
      toast.success(editing ? t('updateSuccess') : t('createSuccess'))
      qc.invalidateQueries({ queryKey: ['edu', 'student'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => eduApi(`/api/admin/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['edu', 'student'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setErr(null)
    setOpen(true)
  }
  function openEdit(s: Student) {
    setEditing(s)
    setForm({
      nickname: s.nickname ?? '',
      phone: s.phone ?? '',
      email: s.email ?? '',
      password: '',
      level: String(s.level),
      status: s.status,
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <div className="text-sm text-muted-foreground">{t('totalStudents')}</div>
            <div className="mt-1 text-2xl font-semibold">{total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-sm text-muted-foreground">{t('currentPageSignups')}</div>
            <div className="mt-1 text-2xl font-semibold">
              {rows.reduce((a, s) => a + s.signupCount, 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-sm text-muted-foreground">{t('currentPageLearnHours')}</div>
            <div className="mt-1 text-2xl font-semibold">
              {rows.reduce((a, s) => a + s.learnHours, 0)}h
            </div>
          </CardContent>
        </Card>
      </div>
      <StudentFilter
        search={search}
        onSearchChange={setSearch}
        levelFilter={levelFilter}
        onLevelFilterChange={setLevelFilter}
        onCreate={openCreate}
      />
      <StudentTable
        rows={rows}
        isLoading={isLoading}
        error={error as Error | null}
        onEdit={openEdit}
        onDelete={(s) => {
          if (window.confirm(t('deleteConfirm'))) deleteMut.mutate(s.id)
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
      <StudentDialog
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
