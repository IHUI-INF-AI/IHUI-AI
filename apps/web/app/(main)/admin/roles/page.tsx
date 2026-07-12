'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'

import { RoleFilter } from './RoleFilter'
import { RoleTable } from './RoleTable'
import { RoleDialog } from './RoleDialog'
import { api, EMPTY } from './helpers'
import type { Role, RoleForm } from './types'

export default function AdminRolesPage() {
  const t = useTranslations('admin.roles')
  const qc = useQueryClient()

  const rolesQ = useQuery({
    queryKey: ['admin', 'roles'],
    queryFn: async () => {
      const { list } = await api<{ list: Role[] }>('/api/roles')
      const details = await Promise.all(
        list.map((r) =>
          api<{ permissions: unknown[] }>(`/api/roles/${r.id}`).catch(() => ({ permissions: [] })),
        ),
      )
      return list.map((r, i) => ({ ...r, permissionsCount: details[i]?.permissions.length ?? 0 }))
    },
  })

  const [mode, setMode] = React.useState<'create' | 'edit' | null>(null)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [form, setForm] = React.useState<RoleForm>(EMPTY)
  const [formErr, setFormErr] = React.useState<string | null>(null)
  const [delTarget, setDelTarget] = React.useState<Role | null>(null)

  const createMut = useMutation({
    mutationFn: () =>
      api('/api/roles', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          displayName: form.displayName || form.name,
          description: form.description,
          scope: form.scope,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'roles'] })
      close()
    },
    onError: (e: Error) => setFormErr(e.message),
  })

  const updateMut = useMutation({
    mutationFn: () =>
      api(`/api/roles/${editingId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          displayName: form.displayName,
          description: form.description,
          scope: form.scope,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'roles'] })
      close()
    },
    onError: (e: Error) => setFormErr(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/api/roles/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'roles'] })
      setDelTarget(null)
    },
    onError: (e: Error) => setFormErr(e.message),
  })

  function close() {
    if (createMut.isPending || updateMut.isPending) return
    setMode(null)
    setEditingId(null)
    setForm(EMPTY)
    setFormErr(null)
  }

  function openCreate() {
    setForm(EMPTY)
    setFormErr(null)
    setMode('create')
  }

  function openEdit(r: Role) {
    setForm({
      name: r.name,
      displayName: r.displayName,
      description: r.description ?? '',
      scope: r.scope,
    })
    setEditingId(r.id)
    setFormErr(null)
    setMode('edit')
  }

  function openDelete(r: Role) {
    setFormErr(null)
    setDelTarget(r)
  }

  function closeDelete() {
    setDelTarget(null)
    setFormErr(null)
  }

  function confirmDelete() {
    if (delTarget) deleteMut.mutate(delTarget.id)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setFormErr(null)
    if (mode === 'create' && !form.name.trim()) {
      setFormErr(t('nameRequired'))
      return
    }
    if (mode === 'create') createMut.mutate()
    else updateMut.mutate()
  }

  const saving = createMut.isPending || updateMut.isPending
  const roles = rolesQ.data ?? []

  return (
    <div className="space-y-4">
      <RoleFilter onCreate={openCreate} />

      <RoleTable
        list={roles}
        isLoading={rolesQ.isLoading}
        onEdit={openEdit}
        onDelete={openDelete}
      />

      <RoleDialog
        mode={mode}
        form={form}
        setForm={setForm}
        formErr={formErr}
        saving={saving}
        delTarget={delTarget}
        deletePending={deleteMut.isPending}
        onSubmit={submit}
        onClose={close}
        onDeleteConfirm={confirmDelete}
        onDeleteCancel={closeDelete}
      />
    </div>
  )
}
