'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { LayoutGrid, Plus } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button } from '@ihui/ui'

import { RecConfigTable } from './RecConfigTable'
import { RecConfigDialog } from './RecConfigDialog'
import { EMPTY_FORM, slotToForm } from './helpers'
import type { RecommendSlot, RecommendForm } from './types'

export default function RecommendationConfigPage() {
  const t = useTranslations('adminTools')
  const qc = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<RecommendSlot | null>(null)
  const [form, setForm] = React.useState<RecommendForm>(EMPTY_FORM)

  const { data: list, isLoading } = useQuery({
    queryKey: ['admin', 'recommendation-config'],
    queryFn: async () => {
      const r = await fetchApi<RecommendSlot[]>('/api/admin/recommendation-config')
      if (!r.success) throw new Error(r.error)
      return r.data
    },
  })

  const saveMut = useMutation({
    mutationFn: async () => {
      const r = editing
        ? await fetchApi(`/api/admin/recommendation-config/${editing.id}`, {
            method: 'PUT',
            body: JSON.stringify(form),
          })
        : await fetchApi('/api/admin/recommendation-config', {
            method: 'POST',
            body: JSON.stringify(form),
          })
      if (!r.success) throw new Error(r.error)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'recommendation-config'] })
      close()
      toast.success(t('rec.saveSuccess'))
    },
  })
  const toggleMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetchApi(`/api/admin/recommendation-config/${id}/toggle`, { method: 'PUT' })
      if (!r.success) throw new Error(r.error)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'recommendation-config'] })
      toast.success(t('rec.toggleSuccess'))
    },
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setOpen(true)
  }
  function openEdit(s: RecommendSlot) {
    setEditing(s)
    setForm(slotToForm(s))
    setOpen(true)
  }
  function close() {
    if (saveMut.isPending) return
    setOpen(false)
    setEditing(null)
    setForm(EMPTY_FORM)
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.position.trim()) {
      toast.error(t('rec.required'))
      return
    }
    saveMut.mutate()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <LayoutGrid className="h-6 w-6 text-primary" />
            {t('rec.title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('rec.subtitle')}</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {t('rec.create')}
        </Button>
      </div>

      <RecConfigTable
        list={list}
        isLoading={isLoading}
        togglePending={toggleMut.isPending}
        onEdit={openEdit}
        onToggle={toggleMut.mutate}
      />

      <RecConfigDialog
        open={open}
        editing={editing}
        form={form}
        setForm={setForm}
        savePending={saveMut.isPending}
        onSubmit={submit}
        onClose={close}
      />
    </div>
  )
}
