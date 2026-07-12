'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { StickyNote, Plus, Search } from 'lucide-react'
import { Button, Input } from '@ihui/ui'

import { NotesList } from './NotesList'
import { NoteDialog } from './NoteDialog'
import { api, EMPTY_FORM } from './helpers'
import type { Note, NoteForm, NotesData } from './types'

export default function MyNotesPage() {
  const t = useTranslations('notes')
  const qc = useQueryClient()

  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Note | null>(null)
  const [form, setForm] = React.useState<NoteForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    const tm = setTimeout(() => setDebounced(search), 300)
    return () => clearTimeout(tm)
  }, [search])

  const { data, isLoading, error } = useQuery({
    queryKey: ['student', 'notes', debounced],
    queryFn: () => {
      const qs = new URLSearchParams({ page: '1', pageSize: '20' })
      if (debounced) qs.set('search', debounced)
      return api<NotesData>(`/api/edu/my-notes?${qs.toString()}`)
    },
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        title: form.title.trim() || undefined,
        content: form.content,
        isPublic: form.isPublic,
        ...(editing?.lessonId ? { lessonId: editing.lessonId } : {}),
      }
      if (editing) {
        return api(`/api/notes/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
      }
      return api('/api/edu/notes', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['student', 'notes'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const delMut = useMutation({
    mutationFn: (id: string) => api(`/edu/notes/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['student', 'notes'] }),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErr(null)
    setOpen(true)
  }
  function openEdit(note: Note) {
    setEditing(note)
    setForm({ title: note.title, content: note.content, isPublic: note.isPublic })
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
    if (!form.content.trim()) {
      setErr(t('contentField'))
      return
    }
    saveMut.mutate()
  }
  function handleDelete(note: Note) {
    if (!window.confirm(t('deleteConfirm'))) return
    delMut.mutate(note.id)
  }

  const list = data?.list ?? []

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
            <StickyNote className="h-7 w-7 text-primary" />
            {t('title')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {t('create')}
        </Button>
      </header>

      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('search')}
          className="h-9 pl-8"
        />
      </div>

      <NotesList
        list={list}
        isLoading={isLoading}
        error={error}
        onEdit={openEdit}
        onDelete={handleDelete}
        deletePending={delMut.isPending}
      />

      <NoteDialog
        open={open}
        editing={editing}
        form={form}
        setForm={setForm}
        err={err}
        savePending={saveMut.isPending}
        onSubmit={submit}
        onClose={closeDialog}
      />
    </div>
  )
}
