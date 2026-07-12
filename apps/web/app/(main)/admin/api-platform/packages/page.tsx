'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Package } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@ihui/ui'

import { ApiPackageTable } from './ApiPackageTable'
import { ApiPackageDialog } from './ApiPackageDialog'
import { api, EMPTY, packageToForm } from './helpers'
import type { ApiPackage, ApiPackageForm } from './types'

export default function AdminApiPlatformPackagesPage() {
  const t = useTranslations('adminApiPackages')
  const qc = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<ApiPackage | null>(null)
  const [form, setForm] = React.useState<ApiPackageForm>(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  const { data: list = [], isLoading } = useQuery({
    queryKey: ['admin', 'api-platform', 'packages'],
    queryFn: () =>
      api<{ list: ApiPackage[] }>('/api/admin/api-platform/packages').then((d) => d.list ?? []),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name.trim(),
        price: Number(form.price) || 0,
        quota: Number(form.quota) || 0,
        period: form.period,
        description: form.description,
      }
      return editing
        ? api(`/api/admin/api-platform/packages/${editing.id}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
          })
        : api('/api/admin/api-platform/packages', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'api-platform', 'packages'] })
      setOpen(false)
    },
    onError: (e: Error) => setErr(e.message),
  })

  const delMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/api-platform/packages/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'api-platform', 'packages'] }),
  })

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY)
    setErr(null)
    setOpen(true)
  }
  const openEdit = (p: ApiPackage) => {
    setEditing(p)
    setForm(packageToForm(p))
    setErr(null)
    setOpen(true)
  }
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    if (!form.name.trim()) {
      setErr(t('enterName'))
      return
    }
    saveMut.mutate()
  }
  const closeDialog = () => {
    setOpen(false)
    setErr(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Package className="h-6 w-6 text-primary" />
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {t('createBtn')}
        </Button>
      </div>

      <ApiPackageTable
        list={list}
        isLoading={isLoading}
        onEdit={openEdit}
        onDelete={(id) => delMut.mutate(id)}
      />

      <ApiPackageDialog
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
