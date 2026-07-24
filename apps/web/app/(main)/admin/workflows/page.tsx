'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Workflow, Plus } from 'lucide-react'

import { Button } from '@ihui/ui-react'
import { WorkflowsTable } from './WorkflowsTable'
import { WorkflowDialog } from './WorkflowDialog'
import { WorkflowViewDialog, WorkflowDeleteDialog } from './WorkflowDialogs'
import { api, fetchWorkflows, EMPTY_FORM, stepsToText, textToSteps } from './helpers'
import type { WorkflowItem, WorkflowForm } from './types'

export default function AdminWorkflowsPage() {
  const t = useTranslations('admin.workflows')
  const qc = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<WorkflowItem | null>(null)
  const [form, setForm] = React.useState<WorkflowForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)
  const [delId, setDelId] = React.useState<string | null>(null)
  const [viewItem, setViewItem] = React.useState<WorkflowItem | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'workflows'],
    queryFn: fetchWorkflows,
  })

  const workflows = data ?? []
  const total = workflows.length

  const saveMut = useMutation({
    mutationFn: () => {
      const steps = textToSteps(form.stepsText)
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        triggerType: form.triggerType,
        steps,
      }
      return editing
        ? api(`/api/workflows/${editing.id}`, { method: 'PATCH', body: JSON.stringify(body) })
        : api('/api/workflows', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'workflows'] })
      close()
    },
    onError: (e: Error) => setErr(e.message),
  })
  const delMut = useMutation({
    mutationFn: (id: string) => api(`/api/workflows/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'workflows'] })
      setDelId(null)
    },
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErr(null)
    setOpen(true)
  }
  function openEdit(w: WorkflowItem) {
    setEditing(w)
    setForm({
      name: w.name,
      description: w.description ?? '',
      triggerType: w.triggerType,
      stepsText: stepsToText(w.steps),
    })
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
    const stepCount = form.stepsText.split('\n').filter((s) => s.trim()).length
    if (stepCount === 0) {
      setErr(t('stepsRequired'))
      return
    }
    saveMut.mutate()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Workflow className="h-6 w-6 text-primary" />
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          {t('create')}
        </Button>
      </div>

      <WorkflowsTable
        list={workflows}
        isLoading={isLoading}
        error={error as Error | null}
        onView={setViewItem}
        onEdit={openEdit}
        onDelete={setDelId}
      />

      <div className="text-sm text-muted-foreground">{t('total', { total })}</div>

      <WorkflowDialog
        open={open}
        editing={editing}
        form={form}
        err={err}
        isPending={saveMut.isPending}
        onFormChange={setForm}
        onClose={close}
        onSubmit={submit}
      />

      <WorkflowViewDialog item={viewItem} onClose={() => setViewItem(null)} />

      <WorkflowDeleteDialog
        delId={delId}
        isPending={delMut.isPending}
        onClose={() => setDelId(null)}
        onConfirm={() => {
          if (delId) delMut.mutate(delId)
        }}
      />
    </div>
  )
}
