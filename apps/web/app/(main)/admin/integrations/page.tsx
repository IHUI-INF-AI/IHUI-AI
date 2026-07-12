'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'

import { IntegrationFilter } from './IntegrationFilter'
import { IntegrationTable } from './IntegrationTable'
import { IntegrationDialog } from './IntegrationDialog'
import { EMPTY_FORM, api, normList, integrationToForm } from './helpers'
import type { Integration, IntegrationForm, TestResult } from './types'

export default function AdminIntegrationsPage() {
  const t = useTranslations('admin.integrations')
  const qc = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Integration | null>(null)
  const [form, setForm] = React.useState<IntegrationForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)
  const [testResults, setTestResults] = React.useState<Record<string, TestResult | 'loading'>>({})
  const [delTarget, setDelTarget] = React.useState<Integration | null>(null)

  const { data: list = [], isLoading } = useQuery({
    queryKey: ['admin', 'integrations'],
    queryFn: async () => normList(await api('/api/admin/integrations')),
  })
  const saveMut = useMutation({
    mutationFn: () => {
      let cred: unknown = form.credentials
      try {
        cred = JSON.parse(form.credentials)
      } catch {
        /* keep as string */
      }
      const body = {
        name: form.name,
        provider: form.provider,
        credentials: cred,
        isEnabled: form.isEnabled,
      }
      return editing
        ? api(`/api/admin/integrations/${editing.id}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
          })
        : api('/api/admin/integrations', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'integrations'] })
      close()
    },
    onError: (e: Error) => setErr(e.message),
  })
  const testMut = useMutation({
    mutationFn: (id: string) =>
      api<TestResult>(`/api/admin/integrations/${id}/test`, { method: 'POST' }),
    onMutate: (id) => setTestResults((p) => ({ ...p, [id]: 'loading' })),
    onSuccess: (res, id) => setTestResults((p) => ({ ...p, [id]: res })),
    onError: (e: Error, id) =>
      setTestResults((p) => ({ ...p, [id]: { success: false, message: e.message } })),
  })
  const delMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/integrations/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'integrations'] })
      setDelTarget(null)
    },
    onError: (e: Error) => setErr(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErr(null)
    setOpen(true)
  }
  function openEdit(i: Integration) {
    setEditing(i)
    setForm(integrationToForm(i))
    setErr(null)
    setOpen(true)
  }
  function close() {
    if (saveMut.isPending) return
    setOpen(false)
    setEditing(null)
    setErr(null)
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!form.name.trim()) {
      setErr(t('nameRequired'))
      return
    }
    saveMut.mutate()
  }
  function handleDelete(i: Integration) {
    setErr(null)
    setDelTarget(i)
  }

  return (
    <div className="space-y-4">
      <IntegrationFilter onCreate={openCreate} />

      <IntegrationTable
        list={list}
        isLoading={isLoading}
        testResults={testResults}
        testPending={testMut.isPending}
        onTest={(id) => testMut.mutate(id)}
        onEdit={openEdit}
        onDelete={handleDelete}
      />

      <IntegrationDialog
        open={open}
        editing={editing}
        form={form}
        setForm={setForm}
        err={err}
        savePending={saveMut.isPending}
        onSubmit={submit}
        onClose={close}
        delTarget={delTarget}
        delPending={delMut.isPending}
        onConfirmDelete={() => delMut.mutate(delTarget!.id)}
        onCancelDelete={() => setDelTarget(null)}
      />
    </div>
  )
}
