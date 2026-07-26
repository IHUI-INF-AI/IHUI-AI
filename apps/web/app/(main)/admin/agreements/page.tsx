'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { AgreementFilter } from './AgreementFilter'
import { AgreementTable } from './AgreementTable'
import { AgreementDialog } from './AgreementDialog'
import { api, EMPTY_FORM, agreementToForm, formToBody } from './helpers'
import type { Agreement, AgreementForm } from './types'

export default function AgreementsPage() {
  const t = useTranslations('admin.agreements')
  const qc = useQueryClient()
  const [currentPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Agreement | null>(null)
  const [form, setForm] = React.useState<AgreementForm>(EMPTY_FORM)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'agreements', currentPage],
    queryFn: () => api<{ list: Agreement[] }>('/api/admin/agreements'),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = formToBody(form)
      return editing
        ? api<Agreement>(`/api/admin/agreements/${editing.id}`, {
            method: 'PUT',
            body: JSON.stringify(body),
          })
        : api<Agreement>('/api/admin/agreements', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'agreements'] })
      toast.success(editing ? t('updateSuccess') : t('createSuccess'))
      close()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api<void>(`/api/admin/agreements/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'agreements'] })
      toast.success(t('deleteSuccess'))
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setOpen(true)
  }
  function openEdit(item: Agreement) {
    setEditing(item)
    setForm(agreementToForm(item))
    setOpen(true)
  }
  function close() {
    if (saveMut.isPending) return
    setOpen(false)
    setEditing(null)
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) {
      toast.error(t('titleRequired'))
      return
    }
    if (!form.content.trim()) {
      toast.error(t('contentRequired'))
      return
    }
    if (!form.version.trim()) {
      toast.error(t('versionRequired'))
      return
    }
    saveMut.mutate()
  }
  function handleDelete(item: Agreement) {
    if (!window.confirm(t('deleteConfirm'))) return
    deleteMut.mutate(item.id)
  }

  const list = data?.list ?? []

  return (
    <div className="space-y-4">
      <AgreementFilter onCreate={openCreate} />

      <AgreementTable
        list={list}
        isLoading={isLoading}
        deletePending={deleteMut.isPending}
        onEdit={openEdit}
        onDelete={handleDelete}
      />

      <AgreementDialog
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
