'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, ChevronLeft, ChevronRight, Download } from 'lucide-react'

import { eduApi, buildQs, type PageData } from '@/lib/edu'
import { HasPermi } from '@/components/auth/HasPermi'
import { exportFromApi } from '@/lib/export-utils'
import { Button } from '@ihui/ui'

import { UserPlatformFilter } from './UserPlatformFilter'
import { UserPlatformTable } from './UserPlatformTable'
import { UserPlatformDialog } from './UserPlatformDialog'
import { PAGE_SIZE, PERM, EMPTY_FORM, EMPTY_SEARCH, userPlatformToForm } from './helpers'
import type { UserPlatform, CForm, SearchQ } from './types'

export default function EduUserPlatformPage() {
  const t = useTranslations('admin.eduUserPlatform')
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [q, setQ] = React.useState<SearchQ>(EMPTY_SEARCH)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<UserPlatform | null>(null)
  const [form, setForm] = React.useState<CForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)

  const params = { page, pageSize: PAGE_SIZE, ...q }
  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'user-platform', params],
    queryFn: () => eduApi<PageData<UserPlatform>>(`/api/admin/user-platform${buildQs(params)}`),
  })
  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        userUuid: form.userUuid,
        platformId: form.platformId,
        identityId: form.identityId,
        status: Number(form.status),
        isDel: Number(form.isDel),
        field1: form.field1 || undefined,
      }
      return editing
        ? eduApi(`/api/admin/user-platform/${editing.id}`, {
            method: 'PUT',
            body: JSON.stringify(body),
          })
        : eduApi(`/api/admin/user-platform`, { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(editing ? t('updateSuccess') : t('createSuccess'))
      qc.invalidateQueries({ queryKey: ['edu', 'user-platform'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => eduApi(`/api/admin/user-platform/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['edu', 'user-platform'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErr(null)
    setOpen(true)
  }
  function openEdit(r: UserPlatform) {
    setEditing(r)
    setForm(userPlatformToForm(r))
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
    if (!form.userUuid.trim()) return setErr(t('userUuidRequired'))
    if (!form.platformId.trim()) return setErr(t('platformIdRequired'))
    saveMut.mutate()
  }
  function handleExport() {
    exportFromApi(
      `/api/admin/user-platform${buildQs({ ...q, pageSize: 10000 })}`,
      `userPlatform_${Date.now()}`,
      [
        { key: 'id', title: t('colId') },
        { key: 'userUuid', title: t('colUserUuid') },
        { key: 'platformId', title: t('colPlatformId') },
        { key: 'identityId', title: t('colIdentityId') },
        { key: 'status', title: t('colStatus') },
        { key: 'isDel', title: t('labelIsDel') },
        { key: 'createdAt', title: t('colCreatedAt') },
        { key: 'updator', title: t('colUpdator') },
      ],
    ).then((ok) => toast[ok ? 'success' : 'error'](ok ? t('exportSuccess') : t('exportFailed')))
  }
  function handleDelete(r: UserPlatform) {
    if (!window.confirm(t('deleteConfirm'))) return
    deleteMut.mutate(r.id)
  }

  const set = (k: keyof SearchQ, v: string) => {
    setQ({ ...q, [k]: v })
    setPage(1)
  }
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rows = data?.list ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <HasPermi code={`${PERM}add`}>
            <Button onClick={openCreate} size="sm">
              <Plus className="h-4 w-4" />
              {t('create')}
            </Button>
          </HasPermi>
          <HasPermi code={`${PERM}export`}>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4" />
              {t('export')}
            </Button>
          </HasPermi>
        </div>
      </div>

      <UserPlatformFilter
        q={q}
        set={set}
        onReset={() => {
          setQ(EMPTY_SEARCH)
          setPage(1)
        }}
      />

      <UserPlatformTable
        list={rows}
        isLoading={isLoading}
        error={error as Error | null}
        onEdit={openEdit}
        onDelete={handleDelete}
        deletePending={deleteMut.isPending}
      />

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{t('total', { total })}</span>
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

      <UserPlatformDialog
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
