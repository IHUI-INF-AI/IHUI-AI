'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'

import { OssConfigFilter } from './OssConfigFilter'
import { OssConfigTable } from './OssConfigTable'
import { OssConfigDialog } from './OssConfigDialog'
import { api, normList, parseJson, EMPTY_FORM, ossDriverToForm } from './helpers'
import type { OssDriver, OssForm } from './types'

export default function AdminOssPage() {
  const t = useTranslations('admin.oss')
  const qc = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<OssDriver | null>(null)
  const [form, setForm] = React.useState<OssForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)

  const { data: list = [], isLoading } = useQuery({
    queryKey: ['admin', 'oss', 'drivers'],
    queryFn: async () => normList(await api('/api/admin/oss/drivers')),
  })
  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name,
        driver: form.driver,
        isEnabled: form.isEnabled,
        isDefault: form.isDefault,
        sort: form.sort,
        description: form.description || undefined,
        credentials: parseJson(form.credentialsJson),
        config: parseJson(form.configJson),
      }
      return editing
        ? api(`/api/admin/oss/drivers/${editing.id}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
          })
        : api('/api/admin/oss/drivers', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'oss', 'drivers'] })
      close()
    },
    onError: (e: Error) => setErr(e.message),
  })
  const delMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/oss/drivers/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'oss', 'drivers'] }),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErr(null)
    setOpen(true)
  }
  function openEdit(c: OssDriver) {
    setEditing(c)
    setForm(ossDriverToForm(c))
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
    if (!form.name.trim()) {
      setErr(t('nameRequired'))
      return
    }
    saveMut.mutate()
  }
  function handleDelete(c: OssDriver) {
    if (confirm(t('deleteConfirm'))) delMut.mutate(c.id)
  }

  return (
    <div className="space-y-4">
      <OssConfigFilter onCreate={openCreate} />
      <OssConfigTable
        list={list}
        isLoading={isLoading}
        deletePending={delMut.isPending}
        onEdit={openEdit}
        onDelete={handleDelete}
      />
      <OssConfigDialog
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
