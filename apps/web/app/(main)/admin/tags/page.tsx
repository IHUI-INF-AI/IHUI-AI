'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Plus } from 'lucide-react'

import { Button } from '@ihui/ui'

import { TagTable } from './TagTable'
import { TagFormDialog, TagDeleteDialog } from './TagDialog'
import { api, fetchTags, EMPTY_FORM, tagToForm } from './helpers'
import type { TagItem, TagForm } from './types'

export default function AdminTagsPage() {
  const t = useTranslations('admin.tags')
  const qc = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<TagItem | null>(null)
  const [delId, setDelId] = React.useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'tags'],
    queryFn: fetchTags,
  })

  const saveMut = useMutation({
    mutationFn: (input: TagForm) => {
      const body = {
        name: input.name.trim(),
        description: input.description.trim() || undefined,
        color: input.color.trim() || undefined,
      }
      return editing
        ? api(`/api/tags/${editing.id}`, { method: 'PATCH', body: JSON.stringify(body) })
        : api('/api/tags', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'tags'] })
      close()
    },
  })
  const delMut = useMutation({
    mutationFn: (id: string) => api(`/api/tags/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'tags'] })
      setDelId(null)
    },
  })

  function openCreate() {
    setEditing(null)
    setOpen(true)
  }
  function openEdit(tag: TagItem) {
    setEditing(tag)
    setOpen(true)
  }
  function close() {
    if (saveMut.isPending) return
    setOpen(false)
    setEditing(null)
  }
  function onValid(values: TagForm) {
    saveMut.mutate(values)
  }

  const tags = data ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          {t('create')}
        </Button>
      </div>

      <TagTable
        tags={tags}
        isLoading={isLoading}
        error={error as Error | null}
        onEdit={openEdit}
        onDelete={(id) => setDelId(id)}
      />

      <TagFormDialog
        open={open}
        editing={editing}
        defaultValues={editing ? tagToForm(editing) : EMPTY_FORM}
        savePending={saveMut.isPending}
        onValid={onValid}
        onClose={close}
      />

      <TagDeleteDialog
        delId={delId}
        delPending={delMut.isPending}
        onConfirm={() => {
          if (delId) delMut.mutate(delId)
        }}
        onClose={() => setDelId(null)}
      />
    </div>
  )
}
