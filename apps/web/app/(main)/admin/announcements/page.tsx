'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'

import { AnnouncementFilter } from './AnnouncementFilter'
import { AnnouncementTable } from './AnnouncementTable'
import { AnnouncementDialog } from './AnnouncementDialog'
import { api, fetchList, EMPTY_FORM, announcementToForm } from './helpers'
import type { Announcement, AnnouncementForm } from './types'

export default function AdminAnnouncementsPage() {
  const t = useTranslations('admin.announcements')
  const qc = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Announcement | null>(null)
  const [form, setForm] = React.useState<AnnouncementForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)

  const {
    data: list = [],
    isLoading,
    isError,
  } = useQuery({ queryKey: ['admin', 'announcements'], queryFn: fetchList })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        title: form.title,
        content: form.content,
        isTop: form.isPinned,
        isPublished: form.isPublished,
      }
      return editing
        ? api(`/api/admin/messages/announcements/${editing.id}`, {
            method: 'PUT',
            body: JSON.stringify(body),
          })
        : api('/api/admin/messages/announcements', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'announcements'] })
      close()
    },
    onError: (e: Error) => setErr(e.message),
  })
  const delMut = useMutation({
    mutationFn: (id: string) =>
      api(`/api/admin/messages/announcements/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'announcements'] }),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErr(null)
    setOpen(true)
  }
  function openEdit(a: Announcement) {
    setEditing(a)
    setForm(announcementToForm(a))
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
    if (!form.title.trim()) {
      setErr(t('titleRequired'))
      return
    }
    saveMut.mutate()
  }

  return (
    <div className="space-y-4">
      <AnnouncementFilter onCreate={openCreate} />

      <AnnouncementTable
        list={list}
        isLoading={isLoading}
        isError={isError}
        deletePending={delMut.isPending}
        onEdit={openEdit}
        onDelete={delMut.mutate}
      />

      <AnnouncementDialog
        open={open}
        editing={editing}
        form={form}
        setForm={setForm}
        err={err}
        savePending={saveMut.isPending}
        onSubmit={submit}
        onClose={close}
      />
    </div>
  )
}
