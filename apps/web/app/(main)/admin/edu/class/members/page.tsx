'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { eduApi, buildQs, type PageData } from '@/lib/edu'
import { Button } from '@ihui/ui'

import { EMPTY, PAGE_SIZE } from './helpers'
import type { Member, MForm } from './types'
import { MemberFilter } from './MemberFilter'
import { MemberTable } from './MemberTable'
import { MemberDialog } from './MemberDialog'

export default function EduClassMembersPage() {
  const t = useTranslations('admin.eduClassMembers')
  const qc = useQueryClient()
  const [classId, setClassId] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [form, setForm] = React.useState<MForm>(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'class', 'members', classId, page],
    queryFn: () =>
      eduApi<PageData<Member>>(
        `/api/admin/edu/classes/${classId}/members${buildQs({ page, pageSize: PAGE_SIZE })}`,
      ),
    enabled: !!classId,
    retry: false,
  })

  const addMut = useMutation({
    mutationFn: () =>
      eduApi(`/api/admin/edu/classes/${classId}/members`, {
        method: 'POST',
        body: JSON.stringify({ userId: form.userId.trim() }),
      }),
    onSuccess: () => {
      toast.success(t('addSuccess'))
      qc.invalidateQueries({ queryKey: ['edu', 'class', 'members', classId] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })
  const removeMut = useMutation({
    mutationFn: (id: string) =>
      eduApi(`/api/admin/edu/classes/${classId}/members/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('removeSuccess'))
      qc.invalidateQueries({ queryKey: ['edu', 'class', 'members', classId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function closeDialog() {
    if (addMut.isPending) return
    setOpen(false)
    setForm(EMPTY)
    setErr(null)
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!form.userId.trim()) return setErr(t('userIdRequired'))
    addMut.mutate()
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
      <MemberFilter
        classId={classId}
        onClassIdChange={(v) => {
          setClassId(v)
          setPage(1)
        }}
        onAddMember={() => {
          setForm(EMPTY)
          setErr(null)
          setOpen(true)
        }}
      />
      <MemberTable
        rows={rows}
        isLoading={isLoading}
        error={error}
        classId={classId}
        onRemove={(m) => {
          if (window.confirm(t('confirmRemove'))) removeMut.mutate(m.id)
        }}
        removePending={removeMut.isPending}
      />
      {classId && rows.length > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{t('total', { total })}</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              {t('prev')}
            </Button>
            <span className="text-sm text-muted-foreground">
              {t('pageOf', { page, totalPages })}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              {t('next')}
            </Button>
          </div>
        </div>
      )}
      <MemberDialog
        open={open}
        form={form}
        onFormChange={(patch) => setForm({ ...form, ...patch })}
        onClose={closeDialog}
        onSubmit={submit}
        pending={addMut.isPending}
        err={err}
      />
    </div>
  )
}
