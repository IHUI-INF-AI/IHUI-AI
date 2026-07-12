'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Workflow } from 'lucide-react'
import { WorkflowCreateDialog } from './WorkflowCreateDialog'
import { WorkflowCardList } from './WorkflowCardList'
import { api, EMPTY_FORM } from './helpers'
import type { WorkflowItem } from './types'

export default function WorkflowsPage() {
  const t = useTranslations('workflows')
  const router = useRouter()
  const qc = useQueryClient()

  const wfsQ = useQuery({
    queryKey: ['workflows'],
    queryFn: () => api<{ list: WorkflowItem[] }>('/api/workflows').then((d) => d.list ?? []),
  })

  const [createOpen, setCreateOpen] = React.useState(false)
  const [form, setForm] = React.useState(EMPTY_FORM)
  const [formErr, setFormErr] = React.useState<string | null>(null)

  const createMut = useMutation({
    mutationFn: () => {
      let steps: unknown
      try {
        steps = JSON.parse(form.steps)
      } catch {
        throw new Error(t('create.invalidSteps'))
      }
      return api('/api/workflows', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          triggerType: form.triggerType,
          steps,
        }),
      })
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['workflows'] })
      setCreateOpen(false)
      setForm(EMPTY_FORM)
      setFormErr(null)
      const created = d as { id?: string }
      if (created?.id) router.push(`/workflows/${created.id}`)
    },
    onError: (e: Error) => setFormErr(e.message),
  })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    setFormErr(null)
    if (!form.name.trim()) {
      setFormErr(t('create.nameRequired'))
      return
    }
    createMut.mutate()
  }

  const handleOpenChange = (o: boolean) => {
    if (!o && createMut.isPending) return
    setCreateOpen(o)
    if (!o) {
      setForm(EMPTY_FORM)
      setFormErr(null)
    }
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
        <WorkflowCreateDialog
          open={createOpen}
          onOpenChange={handleOpenChange}
          form={form}
          setForm={setForm}
          formErr={formErr}
          createPending={createMut.isPending}
          onSubmit={handleCreate}
          onCancel={() => setCreateOpen(false)}
        />
      </div>
      <WorkflowCardList
        wfs={wfsQ.data ?? []}
        isLoading={wfsQ.isLoading}
        onItemClick={(id) => router.push(`/workflows/${id}`)}
      />
    </div>
  )
}
