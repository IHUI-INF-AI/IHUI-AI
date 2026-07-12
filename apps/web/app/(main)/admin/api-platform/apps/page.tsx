'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'

import { ApiAppFilter } from './ApiAppFilter'
import { ApiAppTable } from './ApiAppTable'
import { ApiAppCreateDialog, ApiAppCreatedDialog, ApiAppDeleteDialog } from './ApiAppDialog'
import { api, RESOURCE, EMPTY_FORM } from './helpers'
import type { ApiApp, ApiAppForm } from './types'

export default function AdminApiPlatformAppsPage() {
  const t = useTranslations('adminApiApps')
  const qc = useQueryClient()
  const locale = useLocale()
  const [createOpen, setCreateOpen] = React.useState(false)
  const [form, setForm] = React.useState<ApiAppForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)
  const [created, setCreated] = React.useState<ApiApp | null>(null)
  const [delTarget, setDelTarget] = React.useState<ApiApp | null>(null)

  const { data: apps = [], isLoading } = useQuery({
    queryKey: ['admin', 'api-platform', 'apps'],
    queryFn: () => api<{ list: ApiApp[] }>(RESOURCE).then((d) => d.list ?? []),
  })

  const createMut = useMutation({
    mutationFn: () =>
      api<ApiApp>(RESOURCE, {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          permissions: form.permissions
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['admin', 'api-platform', 'apps'] })
      setCreateOpen(false)
      setForm(EMPTY_FORM)
      setErr(null)
      setCreated(data)
    },
    onError: (e: Error) => setErr(e.message),
  })

  const toggleMut = useMutation({
    mutationFn: (a: ApiApp) =>
      api(`${RESOURCE}/${a.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: a.status === 1 ? 0 : 1 }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'api-platform', 'apps'] }),
  })

  const delMut = useMutation({
    mutationFn: (id: string) => api(`${RESOURCE}/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'api-platform', 'apps'] })
      setDelTarget(null)
    },
    onError: (e: Error) => setErr(e.message),
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    if (!form.name.trim()) {
      setErr(t('validateName'))
      return
    }
    createMut.mutate()
  }

  function openCreate() {
    setForm(EMPTY_FORM)
    setErr(null)
    setCreateOpen(true)
  }
  function closeCreate() {
    setCreateOpen(false)
    setErr(null)
  }

  return (
    <div className="space-y-4">
      <ApiAppFilter onCreate={openCreate} />

      <ApiAppTable
        apps={apps}
        isLoading={isLoading}
        locale={locale}
        togglePending={toggleMut.isPending}
        onToggle={(a) => toggleMut.mutate(a)}
        onDelete={(a) => {
          setErr(null)
          setDelTarget(a)
        }}
      />

      <ApiAppCreateDialog
        open={createOpen}
        form={form}
        setForm={setForm}
        err={err}
        createPending={createMut.isPending}
        onSubmit={submit}
        onClose={closeCreate}
      />

      <ApiAppCreatedDialog created={created} onClose={() => setCreated(null)} />

      <ApiAppDeleteDialog
        delTarget={delTarget}
        err={err}
        delPending={delMut.isPending}
        onConfirm={() => delTarget && delMut.mutate(delTarget.id)}
        onCancel={() => {
          setDelTarget(null)
          setErr(null)
        }}
      />
    </div>
  )
}
