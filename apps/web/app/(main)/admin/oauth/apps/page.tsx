'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, KeyRound } from 'lucide-react'
import { Button } from '@ihui/ui'

import { OauthAppFilter } from './OauthAppFilter'
import { OauthAppTable } from './OauthAppTable'
import { OauthAppCreateDialog, OauthAppDeleteDialog } from './OauthAppDialog'
import { api, EMPTY_FORM } from './helpers'
import type { OAuthApp, OAuthAppForm, ListData } from './types'

export default function AdminOAuthAppsPage() {
  const qc = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [form, setForm] = React.useState<OAuthAppForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)
  const [delTarget, setDelTarget] = React.useState<OAuthApp | null>(null)

  const { data: apps = [], isLoading } = useQuery({
    queryKey: ['admin', 'oauth', 'apps'],
    queryFn: () => api<ListData>('/api/admin/oauth/apps').then((d) => d.list ?? []),
  })

  const createMut = useMutation({
    mutationFn: () =>
      api<OAuthApp>('/api/admin/oauth/apps', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          ownerId: form.ownerId.trim(),
          redirectUris: form.redirectUris
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          scopes: form.scopes
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'oauth', 'apps'] })
      setOpen(false)
      setForm(EMPTY_FORM)
      setErr(null)
    },
    onError: (e: Error) => setErr(e.message),
  })

  const toggleMut = useMutation({
    mutationFn: (a: OAuthApp) =>
      api(`/api/admin/oauth/apps/${a.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: a.status === 'active' ? 'disabled' : 'active' }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'oauth', 'apps'] }),
  })

  const delMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/oauth/apps/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'oauth', 'apps'] })
      setDelTarget(null)
    },
    onError: (e: Error) => setErr(e.message),
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    if (!form.name.trim()) {
      setErr('请输入应用名称')
      return
    }
    if (!form.ownerId.trim()) {
      setErr('请输入所属用户ID')
      return
    }
    createMut.mutate()
  }

  function openCreate() {
    setForm(EMPTY_FORM)
    setErr(null)
    setOpen(true)
  }
  function closeCreate() {
    setOpen(false)
    setErr(null)
  }
  function closeDelete() {
    setDelTarget(null)
    setErr(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <KeyRound className="h-6 w-6 text-primary" />
            OAuth 应用管理
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">管理开放平台 OAuth 应用</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          新建应用
        </Button>
      </div>

      <OauthAppFilter />

      <OauthAppTable
        list={apps}
        isLoading={isLoading}
        togglePending={toggleMut.isPending}
        onToggle={(a) => toggleMut.mutate(a)}
        onDelete={(a) => {
          setErr(null)
          setDelTarget(a)
        }}
      />

      <OauthAppCreateDialog
        open={open}
        form={form}
        setForm={setForm}
        err={err}
        savePending={createMut.isPending}
        onSubmit={submit}
        onClose={closeCreate}
      />

      <OauthAppDeleteDialog
        target={delTarget}
        err={err}
        deletePending={delMut.isPending}
        onConfirm={() => delTarget && delMut.mutate(delTarget.id)}
        onClose={closeDelete}
      />
    </div>
  )
}
