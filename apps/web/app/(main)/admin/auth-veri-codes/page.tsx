'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Plus, Download, KeyRound } from 'lucide-react'

import { exportFromApi } from '@/lib/export-utils'
import { HasPermi } from '@/components/auth/HasPermi'
import { Button } from '@ihui/ui'

import { AuthVeriCodeFilter } from './AuthVeriCodeFilter'
import { AuthVeriCodeTable } from './AuthVeriCodeTable'
import { AuthVeriCodeDialog, AuthVeriCodeDeleteDialog } from './AuthVeriCodeDialog'
import {
  PAGE_SIZE,
  RESOURCE,
  PERM,
  api,
  EMPTY_SEARCH,
  EMPTY_FORM,
  EXPORT_COLS,
  authVeriCodeToForm,
  buildParams,
} from './helpers'
import type { AuthVeriCode, AuthVeriCodeForm, AuthVeriCodeSearch, ListData } from './types'

export default function AuthVeriCodesPage() {
  const t = useTranslations('adminAuthVeriCode')
  const qc = useQueryClient()
  const [search, setSearch] = React.useState<AuthVeriCodeSearch>(EMPTY_SEARCH)
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<AuthVeriCode | null>(null)
  const [form, setForm] = React.useState<AuthVeriCodeForm>(EMPTY_FORM)
  const [delId, setDelId] = React.useState<string | null>(null)

  const params = buildParams(search, page)
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'auth-veri-codes', params],
    queryFn: () => api<ListData>(`${RESOURCE}?${new URLSearchParams(params)}`),
  })
  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const saveMut = useMutation({
    mutationFn: () =>
      editing
        ? api(`${RESOURCE}/${editing.id}`, { method: 'PUT', body: JSON.stringify(form) })
        : api(RESOURCE, { method: 'POST', body: JSON.stringify(form) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'auth-veri-codes'] })
      toast.success(editing ? t('updateSuccess') : t('createSuccess'))
      close()
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const delMut = useMutation({
    mutationFn: (id: string) => api(`${RESOURCE}/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'auth-veri-codes'] })
      toast.success(t('deleteSuccess'))
      setDelId(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function patchSearch(patch: Partial<AuthVeriCodeSearch>) {
    setSearch((s) => ({ ...s, ...patch }))
  }
  function patchForm(patch: Partial<AuthVeriCodeForm>) {
    setForm((f) => ({ ...f, ...patch }))
  }
  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setOpen(true)
  }
  function openEdit(item: AuthVeriCode) {
    setEditing(item)
    setForm(authVeriCodeToForm(item))
    setOpen(true)
  }
  function close() {
    if (saveMut.isPending) return
    setOpen(false)
    setEditing(null)
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.userId.trim() || !form.phone.trim() || !form.code.trim() || !form.type.trim()) {
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
    const ok = await exportFromApi(
      `${RESOURCE}?${new URLSearchParams(params)}`,
      t('exportName'),
      EXPORT_COLS,
    )
    if (!ok) toast.error(t('exportFailed'))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <KeyRound className="h-6 w-6 text-primary" />
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

      <AuthVeriCodeFilter
        search={search}
        onSearchChange={patchSearch}
        onQuery={() => setPage(1)}
        onReset={handleReset}
      />

      <AuthVeriCodeTable
        list={list}
        isLoading={isLoading}
        onEdit={openEdit}
        onDelete={(item) => setDelId(item.id)}
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

      <AuthVeriCodeDialog
        open={open}
        editing={editing}
        form={form}
        onFormChange={patchForm}
        savePending={saveMut.isPending}
        onSubmit={submit}
        onClose={close}
      />

      <AuthVeriCodeDeleteDialog
        open={delId !== null}
        onClose={() => setDelId(null)}
        onConfirm={() => delId && delMut.mutate(delId)}
        pending={delMut.isPending}
      />
    </div>
  )
}
