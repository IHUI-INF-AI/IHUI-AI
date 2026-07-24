'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Menu as MenuIcon, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@ihui/ui-react'

import { MenuFilter } from './MenuFilter'
import { MenuTable } from './MenuTable'
import { MenuDialog } from './MenuDialog'
import { PAGE_SIZE, api, EMPTY_FORM, menuToForm } from './helpers'
import type { MenuItem, MenuForm, ListData } from './types'

export default function MenuPage() {
  const t = useTranslations('admin.menu')
  const qc = useQueryClient()
  const [search, setSearch] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<MenuItem | null>(null)
  const [form, setForm] = React.useState<MenuForm>(EMPTY_FORM)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'menu', search, page],
    queryFn: async () => {
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        keyword: search,
      })
      const res = await api<ListData | MenuItem[]>(`/api/admin/menu?${qs}`)
      const list = Array.isArray(res) ? res : (res.list ?? [])
      const total = Array.isArray(res) ? res.length : (res.total ?? 0)
      return { list, total }
    },
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = { ...form, sort: Number(form.sort) }
      return editing
        ? api(`/api/admin/menu/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) })
        : api('/api/admin/menu', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'menu'] })
      close()
      toast.success(t('saveSuccess'))
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const delMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/menu/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'menu'] })
      toast.success(t('deleteSuccess'))
    },
  })

  const toggleVisibleMut = useMutation({
    mutationFn: (m: MenuItem) =>
      api(`/api/admin/menu/${m.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...m, visible: !m.visible }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'menu'] }),
  })

  function openCreate(parentId?: string) {
    setEditing(null)
    setForm({ ...EMPTY_FORM, parentId: parentId ?? null })
    setOpen(true)
  }
  function openEdit(m: MenuItem) {
    setEditing(m)
    setForm(menuToForm(m))
    setOpen(true)
  }
  function close() {
    if (saveMut.isPending) return
    setOpen(false)
    setEditing(null)
    setForm(EMPTY_FORM)
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error(t('nameRequired'))
      return
    }
    saveMut.mutate()
  }

  const list = data?.list ?? []
  const total = data?.total ?? 0

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <MenuIcon className="h-6 w-6 text-primary" />
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button size="sm" onClick={() => openCreate()}>
          <Plus className="h-4 w-4" />
          {t('create')}
        </Button>
      </div>

      <MenuFilter
        search={search}
        setSearch={(v) => {
          setSearch(v)
          setPage(1)
        }}
      />

      <MenuTable
        list={list}
        isLoading={isLoading}
        page={page}
        total={total}
        delPending={delMut.isPending}
        onToggleVisible={(m) => toggleVisibleMut.mutate(m)}
        onEdit={openEdit}
        onAddChild={(parentId) => openCreate(parentId)}
        onDelete={(m) => delMut.mutate(m.id)}
        onPageChange={setPage}
      />

      <MenuDialog
        open={open}
        editing={editing}
        form={form}
        setForm={setForm}
        list={list}
        savePending={saveMut.isPending}
        onSubmit={submit}
        onClose={close}
      />
    </div>
  )
}
