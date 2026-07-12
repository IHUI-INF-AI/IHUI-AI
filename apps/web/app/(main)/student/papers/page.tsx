'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { FileText, Plus } from 'lucide-react'

import { Button } from '@ihui/ui'

import { PapersList } from './PapersList'
import { PaperDialog } from './PaperDialog'
import { EMPTY_FORM, api } from './helpers'
import type { Paper, PaperForm } from './types'

export default function MyPapersPage() {
  const t = useTranslations('papers')
  const qc = useQueryClient()

  const [open, setOpen] = React.useState(false)
  const [form, setForm] = React.useState<PaperForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)

  const {
    data: list = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['student', 'papers'],
    queryFn: () =>
      api<Paper[] | { list: Paper[] }>('/api/edu/my-papers').then((d) =>
        Array.isArray(d) ? d : (d.list ?? []),
      ),
  })

  const createMut = useMutation({
    mutationFn: () => {
      const body = {
        paperTitle: form.paperTitle.trim(),
        paperUrl: form.paperUrl.trim() || undefined,
      }
      return api('/api/edu/papers', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['student', 'papers'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const delMut = useMutation({
    mutationFn: (id: string) => api(`/api/edu/papers/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['student', 'papers'] }),
  })

  function openCreate() {
    setForm(EMPTY_FORM)
    setErr(null)
    setOpen(true)
  }
  function closeDialog() {
    if (createMut.isPending) return
    setOpen(false)
    setErr(null)
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!form.paperTitle.trim()) {
      setErr(t('paperTitleField'))
      return
    }
    createMut.mutate()
  }
  function handleDelete(paper: Paper) {
    if (!window.confirm(t('deleteConfirm'))) return
    delMut.mutate(paper.id)
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
            <FileText className="h-7 w-7 text-primary" />
            {t('title')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {t('upload')}
        </Button>
      </header>

      <PapersList
        list={list}
        isLoading={isLoading}
        error={error}
        delPending={delMut.isPending}
        onDelete={handleDelete}
      />

      <PaperDialog
        open={open}
        form={form}
        setForm={setForm}
        err={err}
        createPending={createMut.isPending}
        onSubmit={submit}
        onClose={closeDialog}
      />
    </div>
  )
}
