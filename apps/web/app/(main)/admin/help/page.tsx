'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'

import { HelpFilter } from './HelpFilter'
import { HelpTable } from './HelpTable'
import { HelpDialog } from './HelpDialog'
import { api, fetchList, EMPTY_FORM, articleToForm } from './helpers'
import { slugify } from '@/lib/content'
import type { HelpArticle, HelpForm } from './types'

export default function AdminHelpPage() {
  const t = useTranslations('admin.help')
  const qc = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<HelpArticle | null>(null)

  const { data: list = [], isLoading } = useQuery({
    queryKey: ['admin', 'help'],
    queryFn: fetchList,
  })

  const saveMut = useMutation({
    mutationFn: (input: HelpForm) => {
      const body = {
        title: input.title,
        slug: input.slug || slugify(input.title),
        category: input.category,
        content: input.content,
        isPublished: input.isPublished,
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
  })
  const delMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/help/articles/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'help'] }),
  })

  function openCreate() {
    setEditing(null)
    setOpen(true)
  }
  function openEdit(h: HelpArticle) {
    setEditing(h)
    setOpen(true)
  }
  function close() {
    if (saveMut.isPending) return
    setOpen(false)
    setEditing(null)
  }
  function onValid(values: HelpForm) {
    saveMut.mutate(values)
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
        defaultValues={editing ? articleToForm(editing) : EMPTY_FORM}
        savePending={saveMut.isPending}
        onValid={onValid}
        onClose={close}
      />
    </div>
  )
}
