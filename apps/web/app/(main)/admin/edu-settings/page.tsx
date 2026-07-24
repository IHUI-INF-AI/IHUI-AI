'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { School, Plus } from 'lucide-react'

import { Button } from '@ihui/ui-react'

import { EduSettingsFilter } from './EduSettingsFilter'
import { EduSettingsTable } from './EduSettingsTable'
import { EduSettingsDialog } from './EduSettingsDialog'
import { api, normList, parseJson, EMPTY_FORM, eduSettingToForm } from './helpers'
import type { EduSetting, EduSettingForm } from './types'

export default function AdminEduSettingsPage() {
  const t = useTranslations('admin.eduSettings')
  const qc = useQueryClient()
  const [group, setGroup] = React.useState<'all' | string>('all')
  const [groupInput, setGroupInput] = React.useState('')
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<EduSetting | null>(null)
  const [form, setForm] = React.useState<EduSettingForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)

  const { data: list = [], isLoading } = useQuery({
    queryKey: ['admin', 'edu-settings'],
    queryFn: async () => normList(await api('/api/admin/edu-settings?pageSize=100')),
  })
  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        group: form.group,
        key: form.key,
        value: form.value || undefined,
        type: form.type,
        credentials: parseJson(form.credentialsJson),
        isPublic: form.isPublic,
        sort: form.sort,
        status: form.status,
        description: form.description || undefined,
      }
      return editing
        ? api(`/api/admin/edu-settings/${editing.id}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
          })
        : api('/api/admin/edu-settings', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'edu-settings'] })
      close()
    },
    onError: (e: Error) => setErr(e.message),
  })
  const delMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/edu-settings/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'edu-settings'] }),
  })

  const groups = React.useMemo(() => {
    const set = new Set<string>()
    list.forEach((c) => set.add(c.group))
    return Array.from(set)
  }, [list])

  function openCreate() {
    setEditing(null)
    setForm({ ...EMPTY_FORM, group: group === 'all' ? 'site' : group })
    setErr(null)
    setOpen(true)
  }
  function openEdit(c: EduSetting) {
    setEditing(c)
    setForm(eduSettingToForm(c))
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
  function handleDelete(c: EduSetting) {
    if (!confirm(t('deleteConfirm'))) return
    delMut.mutate(c.id)
  }
  function handleAddGroup() {
    if (groupInput.trim()) {
      setGroup(groupInput.trim())
      setGroupInput('')
    }
  }

  const filtered = group === 'all' ? list : list.filter((c) => c.group === group)

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <School className="h-6 w-6 text-primary" />
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {t('create')}
        </Button>
      </div>

      <EduSettingsFilter
        group={group}
        groups={groups}
        groupInput={groupInput}
        setGroup={setGroup}
        setGroupInput={setGroupInput}
        onAddGroup={handleAddGroup}
      />

      <EduSettingsTable
        list={filtered}
        isLoading={isLoading}
        onEdit={openEdit}
        onDelete={handleDelete}
        deletePending={delMut.isPending}
      />

      <EduSettingsDialog
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
