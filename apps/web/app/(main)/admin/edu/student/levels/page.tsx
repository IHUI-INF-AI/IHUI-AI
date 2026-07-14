'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { Plus, ChevronLeft } from 'lucide-react'
import { eduApi, type PageData } from '@/lib/edu'
import { Button } from '@ihui/ui'

import { EMPTY } from './helpers'
import type { Level, LForm } from './types'
import { LevelTable } from './LevelTable'
import { LevelDialog } from './LevelDialog'

export default function EduStudentLevelsPage() {
  const t = useTranslations('admin.edu.student.levels')
  const qc = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Level | null>(null)
  const [form, setForm] = React.useState<LForm>(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'student', 'levels'],
    queryFn: () => eduApi<PageData<Level>>(`/api/admin/member-levels`),
    retry: false,
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name.trim(),
        level: Number(form.level),
        minScore: Number(form.minScore),
        maxScore: Number(form.maxScore),
        discount: Number(form.discount),
      }
      if (editing)
        return eduApi(`/api/admin/member-levels/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
      return eduApi(`/api/admin/member-levels`, { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(editing ? t('updateSuccess') : t('createSuccess'))
      qc.invalidateQueries({ queryKey: ['edu', 'student', 'levels'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => eduApi(`/api/admin/member-levels/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['edu', 'student', 'levels'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setErr(null)
    setOpen(true)
  }
  function openEdit(l: Level) {
    setEditing(l)
    setForm({
      name: l.name,
      level: String(l.level),
      minScore: String(l.minScore),
      maxScore: String(l.maxScore),
      discount: String(l.discount),
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
    if (!form.name.trim()) return setErr(t('nameRequired'))
    saveMut.mutate()
  }

  const rows = data?.list ?? []

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/edu/student">
            <ChevronLeft className="h-4 w-4" />
            {t('backToStudent')}
          </Link>
        </Button>
        <Button onClick={openCreate} size="sm" className="ml-auto">
          <Plus className="h-4 w-4" />
          {t('createLevel')}
        </Button>
      </div>
      <LevelTable
        rows={rows}
        isLoading={isLoading}
        error={error}
        onEdit={openEdit}
        onDelete={(l) => {
          if (window.confirm(t('confirmDelete'))) deleteMut.mutate(l.id)
        }}
        deletePending={deleteMut.isPending}
      />
      <LevelDialog
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
