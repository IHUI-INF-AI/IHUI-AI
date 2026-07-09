'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2, Plus, Shield, Pencil, Trash2, Lock } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Input, Label, Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@ihui/ui'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@ihui/ui'

type Scope = 'none' | 'self' | 'team' | 'org' | 'all'
const SCOPES: Scope[] = ['none', 'self', 'team', 'org', 'all']

interface Role {
  id: string
  name: string
  displayName: string
  description: string | null
  scope: Scope
  isSystem: boolean
  createdAt: string
  permissionsCount?: number
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const inputClass =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
const EMPTY = { name: '', displayName: '', description: '', scope: 'self' as Scope }

export default function AdminRolesPage() {
  const t = useTranslations('admin.roles')
  const tc = useTranslations('common')
  const locale = useLocale()
  const qc = useQueryClient()

  const rolesQ = useQuery({
    queryKey: ['admin', 'roles'],
    queryFn: async () => {
      const { list } = await api<{ list: Role[] }>('/api/roles')
      const details = await Promise.all(
        list.map((r) => api<{ permissions: unknown[] }>(`/api/roles/${r.id}`).catch(() => ({ permissions: [] }))),
      )
      return list.map((r, i) => ({ ...r, permissionsCount: details[i]?.permissions.length ?? 0 }))
    },
  })

  const [mode, setMode] = React.useState<'create' | 'edit' | null>(null)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [form, setForm] = React.useState(EMPTY)
  const [formErr, setFormErr] = React.useState<string | null>(null)
  const [delTarget, setDelTarget] = React.useState<Role | null>(null)

  const close = () => { if (createMut.isPending || updateMut.isPending) return; setMode(null); setEditingId(null); setForm(EMPTY); setFormErr(null) }

  const createMut = useMutation({
    mutationFn: () =>
      api('/api/roles', {
        method: 'POST',
        body: JSON.stringify({ name: form.name, displayName: form.displayName || form.name, description: form.description, scope: form.scope }),
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'roles'] }); close() },
    onError: (e: Error) => setFormErr(e.message),
  })
  const updateMut = useMutation({
    mutationFn: () =>
      api(`/api/roles/${editingId}`, {
        method: 'PATCH',
        body: JSON.stringify({ displayName: form.displayName, description: form.description, scope: form.scope }),
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'roles'] }); close() },
    onError: (e: Error) => setFormErr(e.message),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/api/roles/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'roles'] }); setDelTarget(null) },
    onError: (e: Error) => setFormErr(e.message),
  })

  const openCreate = () => { setForm(EMPTY); setFormErr(null); setMode('create') }
  const openEdit = (r: Role) => { setForm({ name: r.name, displayName: r.displayName, description: r.description ?? '', scope: r.scope }); setEditingId(r.id); setFormErr(null); setMode('edit') }
  const submit = (e: React.FormEvent) => {
    e.preventDefault(); setFormErr(null)
    if (mode === 'create' && !form.name.trim()) { setFormErr(t('nameRequired')); return }
    if (mode === 'create') createMut.mutate()
    else updateMut.mutate()
  }
  const saving = createMut.isPending || updateMut.isPending
  const roles = rolesQ.data ?? []
  const dateFmt = new Intl.DateTimeFormat(locale, { year: 'numeric', month: '2-digit', day: '2-digit' })

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Shield className="h-6 w-6 text-primary" />{t('title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" />{t('add')}</Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">{t('name')}</th>
              <th className="px-4 py-2.5 font-medium">{t('description')}</th>
              <th className="px-4 py-2.5 font-medium">{t('permissionsCount')}</th>
              <th className="px-4 py-2.5 font-medium">{t('type')}</th>
              <th className="px-4 py-2.5 font-medium">{t('createdAt')}</th>
              <th className="px-4 py-2.5 text-right font-medium">{t('actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rolesQ.isLoading ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />{t('loading')}
              </td></tr>
            ) : roles.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">{t('noData')}</td></tr>
            ) : (
              roles.map((r) => (
                <tr key={r.id} className="transition-colors hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{r.displayName}</div>
                    <div className="text-xs text-muted-foreground">{r.name}</div>
                  </td>
                  <td className="max-w-[240px] truncate px-4 py-2.5 text-muted-foreground">{r.description || '-'}</td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">{r.permissionsCount ?? 0}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    {r.isSystem ? (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-600 dark:text-amber-500"><Lock className="h-3 w-3" />{t('builtinYes')}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">{t('builtinNo')}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{dateFmt.format(new Date(r.createdAt))}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" disabled={r.isSystem} onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5" />{t('edit')}</Button>
                      <Button size="sm" variant="ghost" disabled={r.isSystem} onClick={() => { setFormErr(null); setDelTarget(r) }}><Trash2 className="h-3.5 w-3.5" />{t('delete')}</Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 新增 / 编辑 */}
      <Dialog open={mode !== null} onOpenChange={(o) => (o ? null : close())}>
        <DialogContent>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{mode === 'edit' ? t('edit') : t('add')}</DialogTitle>
              <DialogDescription>{t('subtitle')}</DialogDescription>
            </DialogHeader>
            {formErr && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{formErr}</div>}
            <div className="space-y-2">
              <Label htmlFor="r-name">{t('name')}</Label>
              <Input id="r-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('namePlaceholder')} disabled={mode === 'edit'} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="r-display">{t('displayName')}</Label>
              <Input id="r-display" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder={t('namePlaceholder')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="r-desc">{t('description')}</Label>
              <textarea id="r-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={t('descPlaceholder')} rows={2} className={inputClass} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="r-scope">{t('scope')}</Label>
              <Select value={form.scope} onValueChange={(v) => setForm({ ...form, scope: v as Scope })}>
  <SelectTrigger className={selectClass}>
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    {SCOPES.map((s) => <SelectItem key={s} value={s}>{t(`scopes.${s}`)}</SelectItem>)}
  </SelectContent>
</Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close} disabled={saving}>{tc('cancel')}</Button>
              <Button type="submit" disabled={saving}>{saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}{t('save')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <Dialog open={!!delTarget} onOpenChange={(o) => (o ? null : (setDelTarget(null), setFormErr(null)))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteTitle')}</DialogTitle>
            <DialogDescription>{t('deleteDesc')}</DialogDescription>
          </DialogHeader>
          {formErr && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{formErr}</div>}
          <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
            <span className="font-medium">{delTarget?.displayName}</span>
            <span className="ml-2 text-xs text-muted-foreground">{delTarget?.name}</span>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDelTarget(null)} disabled={deleteMut.isPending}>{tc('cancel')}</Button>
            <Button type="button" variant="destructive" disabled={deleteMut.isPending} onClick={() => delTarget && deleteMut.mutate(delTarget.id)}>
              {deleteMut.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}{t('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
