'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Settings, Plus } from 'lucide-react'
import { Button } from '@ihui/ui'

import { SystemConfigFilter } from './SystemConfigFilter'
import { SystemConfigTable } from './SystemConfigTable'
import { SystemConfigDialog } from './SystemConfigDialog'
import { EMPTY, api, configToForm } from './helpers'
import type { SystemConfig, Category } from './types'

export default function AdminSystemConfigPage() {
  const qc = useQueryClient()
  const [category, setCategory] = React.useState<'all' | Category>('all')
  const [search, setSearch] = React.useState('')
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<SystemConfig | null>(null)
  const [form, setForm] = React.useState(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  const { data: list = [], isLoading } = useQuery({
    queryKey: ['admin', 'system', 'config', category],
    queryFn: () => {
      const qs = new URLSearchParams()
      if (category !== 'all') qs.set('category', category)
      return api<{ list: SystemConfig[] }>(`/api/admin/system/config?${qs.toString()}`).then(
        (d) => d.list ?? [],
      )
    },
  })

  const filtered = React.useMemo(() => {
    const kw = search.trim().toLowerCase()
    if (!kw) return list
    return list.filter((c) => `${c.key} ${c.description ?? ''}`.toLowerCase().includes(kw))
  }, [list, search])

  const saveMut = useMutation({
    mutationFn: () => {
      const body = { ...form }
      return editing
        ? api(`/api/admin/system/config/${editing.id}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
          })
        : api('/api/admin/system/config', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'system', 'config'] })
      setOpen(false)
    },
    onError: (e: Error) => setErr(e.message),
  })

  const delMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/system/config/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'system', 'config'] }),
  })

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY)
    setErr(null)
    setOpen(true)
  }
  const openEdit = (c: SystemConfig) => {
    setEditing(c)
    setForm(configToForm(c))
    setErr(null)
    setOpen(true)
  }
  const closeDialog = () => {
    setOpen(false)
    setErr(null)
  }
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    if (!form.key.trim()) {
      setErr('请输入配置键')
      return
    }
    saveMut.mutate()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Settings className="h-6 w-6 text-primary" />
            系统配置
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">系统参数与配置项管理</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          新建
        </Button>
      </div>

      <SystemConfigFilter
        category={category}
        onCategoryChange={setCategory}
        search={search}
        onSearchChange={setSearch}
      />

      <SystemConfigTable
        list={filtered}
        isLoading={isLoading}
        onEdit={openEdit}
        onDelete={(id) => delMut.mutate(id)}
      />

      <SystemConfigDialog
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
