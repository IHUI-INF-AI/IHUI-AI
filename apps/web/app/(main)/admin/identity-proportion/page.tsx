'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Plus, ChevronLeft, ChevronRight, Download } from 'lucide-react'

import { exportToExcel } from '@/lib/export-utils'
import { HasPermi } from '@/components/auth/HasPermi'
import { Button } from '@ihui/ui'

import { IdentityProportionFilter } from './IdentityProportionFilter'
import { IdentityProportionTable } from './IdentityProportionTable'
import { IdentityProportionDialog } from './IdentityProportionDialog'
import { PAGE_SIZE, api, EMPTY_FORM, EXPORT_COLUMNS, identityProportionToForm } from './helpers'
import type { IdentityProportion, IdentityProportionForm, ListData } from './types'

export default function IdentityProportionPage() {
  const t = useTranslations('admin.identityProportion')
  const tc = useTranslations('common')
  const qc = useQueryClient()
  const [searchBegin, setSearchBegin] = React.useState('')
  const [searchEnd, setSearchEnd] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<IdentityProportion | null>(null)
  const [form, setForm] = React.useState<IdentityProportionForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'identity-proportion', searchBegin, searchEnd, page],
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (searchBegin) qs.set('beginTime', searchBegin)
      if (searchEnd) qs.set('endTime', searchEnd)
      return api<ListData>(`/api/admin/identity-proportion?${qs.toString()}`)
    },
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        identityType: form.identityType.trim(),
        gift: form.gift || undefined,
        tokenProportion: form.tokenProportion || undefined,
        vipGift: form.vipGift || undefined,
        routineProportion: form.routineProportion || undefined,
        beginTime: form.beginTime || undefined,
        endTime: form.endTime || undefined,
        status: form.status ? 1 : 0,
      }
      return editing
        ? api(`/api/admin/identity-proportion/${editing.id}`, {
            method: 'PUT',
            body: JSON.stringify(body),
          })
        : api('/api/admin/identity-proportion', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(editing ? t('updateSuccess') : t('createSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'identity-proportion'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/identity-proportion/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'identity-proportion'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErr(null)
    setOpen(true)
  }
  function openEdit(item: IdentityProportion) {
    setEditing(item)
    setForm(identityProportionToForm(item))
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
    if (!form.identityType.trim()) {
      setErr(t('identityTypeRequired'))
      return
    }
    saveMut.mutate()
  }
  function handleDelete(item: IdentityProportion) {
    if (!window.confirm(t('deleteConfirm', { name: item.identityType }))) return
    deleteMut.mutate(item.id)
  }
  function handleExport() {
    exportToExcel(
      t('exportFileName'),
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
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4" />
            {tc('export')}
          </Button>
          <HasPermi code="ai:identity_proportion:add">
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              {tc('add')}
            </Button>
          </HasPermi>
        </div>
      </div>

      <IdentityProportionFilter
        searchBegin={searchBegin}
        setSearchBegin={(v) => {
          setSearchBegin(v)
          setPage(1)
        }}
        searchEnd={searchEnd}
        setSearchEnd={(v) => {
          setSearchEnd(v)
          setPage(1)
        }}
      />

      <IdentityProportionTable
        list={list}
        isLoading={isLoading}
        onEdit={openEdit}
        onDelete={handleDelete}
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
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
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

      <IdentityProportionDialog
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
