'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Settings, Plus } from 'lucide-react'

import { Button } from '@ihui/ui'
import { ConfigFilter } from './ConfigFilter'
import { ConfigTable } from './ConfigTable'
import { ConfigDialog } from './ConfigDialog'
import { EMPTY_FORM, api, normList, configToForm } from './helpers'
import type { Category, Config, ConfigForm } from './types'

export default function AdminConfigsPage() {
  const t = useTranslations('admin.configs')
  const qc = useQueryClient()
  const [category, setCategory] = React.useState<'all' | Category>('all')
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Config | null>(null)
  const [form, setForm] = React.useState<ConfigForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)

  const {
    data: list = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['admin', 'configs'],
    queryFn: async () => normList(await api('/api/admin/configs')),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = { ...form }
      return editing
        ? api(`/api/admin/configs/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) })
        : api('/api/admin/configs', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'configs'] })
      close()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const delMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/configs/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'configs'] }),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErr(null)
    setOpen(true)
  }
  function openEdit(c: Config) {
    setEditing(c)
    setForm(configToForm(c))
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
    if (!form.key.trim()) {
      setErr(t('keyRequired'))
      return
    }
    saveMut.mutate()
  }
  function handleDelete(c: Config) {
    if (!confirm(t('deleteConfirm'))) return
    delMut.mutate(c.id)
  }

  const filtered = category === 'all' ? list : list.filter((c) => c.category === category)

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Settings className="h-6 w-6 text-primary" />
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {t('create')}
        </Button>
      </div>

      <ConfigFilter category={category} setCategory={setCategory} />

      <ConfigTable
        list={filtered}
        isLoading={isLoading}
        isError={isError}
        delPending={delMut.isPending}
        onEdit={openEdit}
        onDelete={handleDelete}
      />

      <ConfigDialog
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
