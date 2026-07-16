'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@ihui/ui'

import { ResourceTagFilter } from './ResourceTagFilter'
import { ResourceTagTable } from './ResourceTagTable'
import { ResourceTagDialog } from './ResourceTagDialog'
import { PAGE_SIZE, api, fetchTags, EMPTY_FORM, tagToForm } from './helpers'
import type { TagItem, TagForm } from './types'

export default function AdminResourceTagsPage() {
  const t = useTranslations('admin.resources')
  const qc = useQueryClient()

  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [page, setPage] = React.useState(1)

  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<TagItem | null>(null)
  const [form, setForm] = React.useState<TagForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [search])

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'resources', 'tags', debounced, page],
    queryFn: () => fetchTags({ page, search: debounced }),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name.trim(),
        pid: form.pid || null,
        sort: Number(form.sort) || 0,
        status: form.status ? 1 : 0,
      }
      if (editing) {
        return api<{ tag: TagItem }>(`/api/admin/resources/tags/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
      }
      return api<{ tag: TagItem }>(`/api/admin/resources/tags`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      toast.success(editing ? t('updateSuccess') : t('createSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'resources', 'tags'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/resources/tags/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'resources', 'tags'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErr(null)
    setOpen(true)
  }

  function openEdit(tag: TagItem) {
    setEditing(tag)
    setForm(tagToForm(tag))
    setErr(null)
    setOpen(true)
  }

  function closeDialog() {
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

  function handleDelete(tag: TagItem) {
    if (!window.confirm(t('deleteConfirm'))) return
    deleteMut.mutate(tag.id)
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const tags = data?.list ?? []

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('tagsTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('tagsSubtitle')}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/resources">
            <ChevronLeft className="h-4 w-4" />
            {t('backToResources')}
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ResourceTagFilter search={search} setSearch={setSearch} />
        <Button onClick={openCreate} size="sm" className="ml-auto">
          <Plus className="h-4 w-4" />
          {t('create')}
        </Button>
      </div>

      <ResourceTagTable
        list={tags}
        tags={tags}
        isLoading={isLoading}
        error={error}
        deletePending={deleteMut.isPending}
        onEdit={openEdit}
        onDelete={handleDelete}
      />

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{t('total', { total })}</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
            {t('prev')}
          </Button>
          <span className="text-sm text-muted-foreground">
            {t('page', { page, total: totalPages })}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('next')}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ResourceTagDialog
        open={open}
        editing={editing}
        form={form}
        setForm={setForm}
        err={err}
        savePending={saveMut.isPending}
        tags={tags}
        onSubmit={submit}
        onClose={closeDialog}
      />
    </div>
  )
}
