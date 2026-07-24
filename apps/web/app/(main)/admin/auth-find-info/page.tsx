'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Plus, Download, CreditCard } from 'lucide-react'

import { HasPermi } from '@/components/auth/HasPermi'
import { Button } from '@ihui/ui-react'

import { AuthFindInfoFilter } from './AuthFindInfoFilter'
import { AuthFindInfoTable } from './AuthFindInfoTable'
import { AuthFindInfoDialog, AuthFindInfoDeleteDialog } from './AuthFindInfoDialog'
import {
  RESOURCE,
  PERM,
  PAGE_SIZE,
  api,
  EMPTY_FORM,
  EMPTY_SEARCH,
  authFindInfoToForm,
  buildParams,
  exportAuthFindInfo,
} from './helpers'
import type { AuthFindInfo, ListData, AuthFindInfoForm, AuthFindInfoSearch } from './types'

export default function AuthFindInfoPage() {
  const t = useTranslations('adminAuthFindInfo')
  const qc = useQueryClient()
  const [search, setSearch] = React.useState<AuthFindInfoSearch>(EMPTY_SEARCH)
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<AuthFindInfo | null>(null)
  const [form, setForm] = React.useState<AuthFindInfoForm>(EMPTY_FORM)
  const [delId, setDelId] = React.useState<string | null>(null)

  const params = React.useMemo(() => buildParams(search, page, PAGE_SIZE), [search, page])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'auth-find-info', params],
    queryFn: () => api<ListData>(`${RESOURCE}?${new URLSearchParams(params)}`),
  })

  const saveMut = useMutation({
    mutationFn: () =>
      editing
        ? api(`${RESOURCE}/${editing.id}`, { method: 'PUT', body: JSON.stringify(form) })
        : api(RESOURCE, { method: 'POST', body: JSON.stringify(form) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'auth-find-info'] })
      toast.success(editing ? t('updateSuccess') : t('createSuccess'))
      closeDialog()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const delMut = useMutation({
    mutationFn: (id: string) => api(`${RESOURCE}/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'auth-find-info'] })
      toast.success(t('deleteSuccess'))
      setDelId(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setOpen(true)
  }
  function openEdit(item: AuthFindInfo) {
    setEditing(item)
    setForm(authFindInfoToForm(item))
    setOpen(true)
  }
  function closeDialog() {
    if (saveMut.isPending) return
    setOpen(false)
    setEditing(null)
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.userUuid.trim() || !form.card.trim() || !form.belong.trim()) {
      toast.error(t('validateRequired'))
      return
    }
    saveMut.mutate()
  }
  function handleReset() {
    setSearch(EMPTY_SEARCH)
    setPage(1)
  }
  async function handleExport() {
    const ok = await exportAuthFindInfo(params)
    if (!ok) toast.error(t('exportFailed'))
  }

  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <CreditCard className="h-6 w-6 text-primary" />
          {t('title')}
        </h1>
        <div className="flex gap-2">
          <HasPermi code={`${PERM}:export`}>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4" />
              {t('export')}
            </Button>
          </HasPermi>
          <HasPermi code={`${PERM}:add`}>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              {t('add')}
            </Button>
          </HasPermi>
        </div>
      </div>

      <AuthFindInfoFilter
        search={search}
        onSearchChange={(patch) => setSearch({ ...search, ...patch })}
        onQuery={() => setPage(1)}
        onReset={handleReset}
      />

      <AuthFindInfoTable
        list={list}
        isLoading={isLoading}
        onEdit={openEdit}
        onDelete={(id) => setDelId(id)}
      />

      {total > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t('total', { total, page, totalPages })}</span>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              {t('prev')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              {t('next')}
            </Button>
          </div>
        </div>
      )}

      <AuthFindInfoDialog
        open={open}
        editing={editing}
        form={form}
        onFormChange={(patch) => setForm({ ...form, ...patch })}
        savePending={saveMut.isPending}
        onSubmit={submit}
        onClose={closeDialog}
      />

      <AuthFindInfoDeleteDialog
        delId={delId}
        deletePending={delMut.isPending}
        onConfirm={() => delId && delMut.mutate(delId)}
        onCancel={() => setDelId(null)}
      />
    </div>
  )
}
