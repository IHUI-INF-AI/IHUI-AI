'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Plug, Zap, Check, X, Plus, Edit, Trash2, Loader2 } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Input, Label, Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@ihui/ui'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@ihui/ui'
import { cn } from '@/lib/utils'

type Provider = 'openai' | 'anthropic' | 'google' | 'stripe' | 'alipay' | 'wechat' | 'oss' | 's3' | 'smtp' | 'webhook'

interface Integration {
  id: string
  name: string
  provider: Provider
  credentials: Record<string, unknown> | string
  isEnabled: boolean
  lastTestedAt?: string
  updatedAt?: string
}

interface TestResult {
  success: boolean
  message: string
  latency?: number
}

const PROVIDERS: Provider[] = ['openai', 'anthropic', 'google', 'stripe', 'alipay', 'wechat', 'oss', 's3', 'smtp', 'webhook']
const PROVIDER_INITIAL: Record<Provider, string> = { openai: 'O', anthropic: 'A', google: 'G', stripe: 'S', alipay: 'Z', wechat: 'W', oss: 'O', s3: 'S', smtp: 'M', webhook: 'H' }
const EMPTY = { name: '', provider: 'openai' as Provider, credentials: '{\n  \n}', isEnabled: true }
const selectClass = 'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
const textareaClass = 'flex w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}
function normList(d: unknown): Integration[] {
  return Array.isArray(d) ? (d as Integration[]) : ((d as { list?: Integration[] })?.list ?? [])
}
function credToString(c: Integration['credentials']): string {
  if (typeof c === 'string') return c
  try { return JSON.stringify(c, null, 2) } catch { return '{}' }
}

export default function AdminIntegrationsPage() {
  const t = useTranslations('admin.integrations')
  const tc = useTranslations('common')
  const qc = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Integration | null>(null)
  const [form, setForm] = React.useState(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)
  const [testResults, setTestResults] = React.useState<Record<string, TestResult | 'loading'>>({})
  const [delTarget, setDelTarget] = React.useState<Integration | null>(null)

  const { data: list = [], isLoading } = useQuery({
    queryKey: ['admin', 'integrations'],
    queryFn: async () => normList(await api('/api/admin/integrations')),
  })
  const saveMut = useMutation({
    mutationFn: () => {
      let cred: unknown = form.credentials
      try { cred = JSON.parse(form.credentials) } catch { /* keep as string */ }
      const body = { name: form.name, provider: form.provider, credentials: cred, isEnabled: form.isEnabled }
      return editing
        ? api(`/api/admin/integrations/${editing.id}`, { method: 'PATCH', body: JSON.stringify(body) })
        : api('/api/admin/integrations', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'integrations'] }); close() },
    onError: (e: Error) => setErr(e.message),
  })
  const testMut = useMutation({
    mutationFn: (id: string) => api<TestResult>(`/api/admin/integrations/${id}/test`, { method: 'POST' }),
    onMutate: (id) => setTestResults((p) => ({ ...p, [id]: 'loading' })),
    onSuccess: (res, id) => setTestResults((p) => ({ ...p, [id]: res })),
    onError: (e: Error, id) => setTestResults((p) => ({ ...p, [id]: { success: false, message: e.message } })),
  })
  const delMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/integrations/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'integrations'] }); setDelTarget(null) },
    onError: (e: Error) => setErr(e.message),
  })

  function openCreate() { setEditing(null); setForm(EMPTY); setErr(null); setOpen(true) }
  function openEdit(i: Integration) {
    setEditing(i)
    setForm({ name: i.name, provider: i.provider, credentials: credToString(i.credentials), isEnabled: i.isEnabled })
    setErr(null); setOpen(true)
  }
  function close() { if (saveMut.isPending) return; setOpen(false); setEditing(null); setErr(null) }
  function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null)
    if (!form.name.trim()) { setErr(t('nameRequired')); return }
    saveMut.mutate()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Plug className="h-6 w-6 text-primary" />{t('title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" />{t('create')}</Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('loading')}</div>
      ) : list.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center text-muted-foreground">{t('noData')}</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((i) => {
            const tr = testResults[i.id]
            return (
              <div key={i.id} className="flex flex-col rounded-lg border p-4 transition-colors hover:bg-muted/30">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-sm font-semibold text-primary">
                      {PROVIDER_INITIAL[i.provider] ?? i.provider[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium">{i.name}</div>
                      <div className="text-xs text-muted-foreground">{t(`providers.${i.provider}`)}</div>
                    </div>
                  </div>
                  <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', i.isEnabled ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500' : 'bg-muted text-muted-foreground')}>
                    <span className={cn('h-1.5 w-1.5 rounded-full', i.isEnabled ? 'bg-emerald-500' : 'bg-muted-foreground/50')} />
                    {i.isEnabled ? t('enabled') : t('disabled')}
                  </span>
                </div>
                {tr && tr !== 'loading' && (
                  <div className={cn('mt-3 flex items-start gap-2 rounded-md px-2.5 py-1.5 text-xs', tr.success ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500' : 'bg-red-500/10 text-red-600 dark:text-red-500')}>
                    {tr.success ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <X className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                    <span className="break-all">{tr.message}</span>
                  </div>
                )}
                <div className="mt-4 flex items-center gap-2">
                  <Button size="sm" variant="outline" disabled={testMut.isPending && testResults[i.id] === 'loading'} onClick={() => testMut.mutate(i.id)}>
                    {tr === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}{t('test')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(i)}><Edit className="h-4 w-4" />{t('edit')}</Button>
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => { setErr(null); setDelTarget(i) }}>
                    <Trash2 className="h-4 w-4" />{tc('delete')}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <DialogContent>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editing ? t('editTitle') : t('createTitle')}</DialogTitle>
              <DialogDescription>{t('createDesc')}</DialogDescription>
            </DialogHeader>
            {err && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</div>}
            <div className="space-y-2">
              <Label htmlFor="i-name">{t('fieldName')}</Label>
              <Input id="i-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('namePlaceholder')} autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="i-provider">{t('fieldProvider')}</Label>
              <Select value={form.provider} onValueChange={(v) => setForm({ ...form, provider: v as Provider })}>
  <SelectTrigger className={selectClass}>
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    {PROVIDERS.map((p) => <SelectItem key={p} value={p}>{t(`providers.${p}`)}</SelectItem>)}
  </SelectContent>
</Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="i-cred">{t('fieldCredentials')}</Label>
              <textarea id="i-cred" value={form.credentials} onChange={(e) => setForm({ ...form, credentials: e.target.value })} placeholder={'{\n  "apiKey": "..."\n}'} rows={6} className={textareaClass} />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isEnabled} onChange={(e) => setForm({ ...form, isEnabled: e.target.checked })} className="h-4 w-4 accent-primary" />
              {t('fieldEnabled')}
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close} disabled={saveMut.isPending}>{tc('cancel')}</Button>
              <Button type="submit" disabled={saveMut.isPending}>{saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}{t('save')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!delTarget} onOpenChange={(o) => (!o && !delMut.isPending ? setDelTarget(null) : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteTitle')}</DialogTitle>
            <DialogDescription>{t('deleteConfirm')}</DialogDescription>
          </DialogHeader>
          {delTarget && (
            <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
              <div className="font-medium">{delTarget.name}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{t(`providers.${delTarget.provider}`)}</div>
            </div>
          )}
          {err && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</div>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDelTarget(null)} disabled={delMut.isPending}>{tc('cancel')}</Button>
            <Button type="button" variant="destructive" disabled={delMut.isPending} onClick={() => delMut.mutate(delTarget!.id)}>
              {delMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}{tc('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
