'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'

import { HelpFilter } from './HelpFilter'
import { HelpTable } from './HelpTable'
import { HelpDialog } from './HelpDialog'
import { api, fetchList, slugify, EMPTY_FORM, articleToForm } from './helpers'
import type { HelpArticle, HelpForm } from './types'

export default function AdminHelpPage() {
  const t = useTranslations('admin.help')
  const qc = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<HelpArticle | null>(null)
  const [slugTouched, setSlugTouched] = React.useState(false)
  const [form, setForm] = React.useState<HelpForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)

  const { data: list = [], isLoading } = useQuery({
    queryKey: ['admin', 'help'],
    queryFn: fetchList,
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        title: form.title,
        slug: form.slug || slugify(form.title),
        category: form.category,
        content: form.content,
        isPublished: form.isPublished,
      }
      return editing
        ? api(`/api/admin/help/articles/${editing.id}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
          })
        : api('/api/admin/help/articles', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'help'] })
      close()
    },
    onError: (e: Error) => setErr(e.message),
  })
  const delMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/help/articles/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'help'] }),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setSlugTouched(false)
    setErr(null)
    setOpen(true)
  }
  function openEdit(h: HelpArticle) {
    setEditing(h)
    setForm(articleToForm(h))
    setSlugTouched(true)
    setErr(null)
    setOpen(true)
  }
  function close() {
    if (saveMut.isPending) return
    setOpen(false)
    setEditing(null)
    setSlugTouched(false)
    setErr(null)
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!form.title.trim()) {
      setErr(t('titleRequired'))
      return
    }
    saveMut.mutate()
  }
  function handleDelete(h: HelpArticle) {
    if (confirm(t('deleteConfirm'))) delMut.mutate(h.id)
  }

  return (
    <div className="space-y-4">
      <HelpFilter onCreate={openCreate} />

      <HelpTable
        list={list}
        isLoading={isLoading}
        deletePending={delMut.isPending}
        onEdit={openEdit}
        onDelete={handleDelete}
      />

      <HelpDialog
        open={open}
        editing={editing}
        form={form}
        setForm={setForm}
        slugTouched={slugTouched}
        setSlugTouched={setSlugTouched}
        err={err}
        savePending={saveMut.isPending}
        onSubmit={submit}
        onClose={close}
      />
    </div>
  )
}
