'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { School, Plus, Edit, Trash2, Loader2 } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Input, Label, Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@ihui/ui'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@ihui/ui'
import { cn } from '@/lib/utils'

type CfgType = 'string' | 'number' | 'boolean' | 'json'

interface EduSetting {
  id: string
  group: string
  key: string
  value?: string | null
  type: CfgType
  isPublic: boolean
  sort: number
  status: number
  description?: string | null
  credentials?: Record<string, unknown>
  updatedAt?: string
}

const TYPES: CfgType[] = ['string', 'number', 'boolean', 'json']
const EMPTY = {
  group: 'site',
  key: '',
  value: '',
  type: 'string' as CfgType,
  credentialsJson: '{}',
  isPublic: false,
  sort: 0,
  status: 1,
  description: '',
}
const selectClass = 'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
const th = 'px-4 py-2.5 font-medium'
const tabBase = 'rounded-md px-3 py-1.5 text-sm font-medium transition-colors'
const textareaClass = 'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono'

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}
function normList(d: unknown): EduSetting[] {
  return Array.isArray(d) ? (d as EduSetting[]) : ((d as { list?: EduSetting[] })?.list ?? [])
}
function parseJson(s: string): Record<string, unknown> {
  try { return JSON.parse(s || '{}') } catch { return {} }
}

export default function AdminEduSettingsPage() {
  const t = useTranslations('admin.eduSettings')
  const tc = useTranslations('common')
  const qc = useQueryClient()
  const [group, setGroup] = React.useState<'all' | string>('all')
  const [groupInput, setGroupInput] = React.useState('')
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<EduSetting | null>(null)
  const [form, setForm] = React.useState(EMPTY)
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
        ? api(`/api/admin/edu-settings/${editing.id}`, { method: 'PATCH', body: JSON.stringify(body) })
        : api('/api/admin/edu-settings', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'edu-settings'] }); close() },
    onError: (e: Error) => setErr(e.message),
  })
  const delMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/edu-settings/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'edu-settings'] }),
  })

  // 动态收集出现过的 group
  const groups = React.useMemo(() => {
    const set = new Set<string>()
    list.forEach((c) => set.add(c.group))
    return Array.from(set)
  }, [list])

  function openCreate() { setEditing(null); setForm({ ...EMPTY, group: group === 'all' ? 'site' : group }); setErr(null); setOpen(true) }
  function openEdit(c: EduSetting) {
    setEditing(c)
    setForm({
      group: c.group,
      key: c.key,
      value: c.value ?? '',
      type: c.type,
      credentialsJson: JSON.stringify(c.credentials ?? {}, null, 2),
      isPublic: c.isPublic,
      sort: c.sort,
      status: c.status,
      description: c.description ?? '',
    })
    setErr(null); setOpen(true)
  }
  function close() { if (saveMut.isPending) return; setOpen(false); setEditing(null); setErr(null) }
  function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null)
    if (!form.key.trim()) { setErr(t('keyRequired')); return }
    saveMut.mutate()
  }

  const filtered = group === 'all' ? list : list.filter((c) => c.group === group)
  const tabCls = (active: boolean) => cn(tabBase, active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <School className="h-6 w-6 text-primary" />{t('title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" />{t('create')}</Button>
      </div>

      <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-muted/30 p-1">
        <button onClick={() => setGroup('all')} className={tabCls(group === 'all')}>{t('allGroups')}</button>
        {groups.map((g) => (
          <button key={g} onClick={() => setGroup(g)} className={tabCls(group === g)}>{g}</button>
        ))}
        <div className="ml-auto flex items-center gap-1 px-2">
          <input
            value={groupInput}
            onChange={(e) => setGroupInput(e.target.value)}
            placeholder={t('addGroupPlaceholder')}
            className="h-7 w-32 rounded border border-input bg-transparent px-2 text-xs"
          />
          <Button size="sm" variant="outline" onClick={() => { if (groupInput.trim()) { setGroup(groupInput.trim()); setGroupInput('') } }}>{t('filter')}</Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className={th}>{t('colGroup')}</th>
              <th className={th}>{t('colKey')}</th>
              <th className={th}>{t('colValue')}</th>
              <th className={th}>{t('colType')}</th>
              <th className={th}>{t('colPublic')}</th>
              <th className={cn(th, 'text-right')}>{t('colActions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />{t('loading')}</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">{t('noData')}</td></tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} className="transition-colors hover:bg-muted/30">
                  <td className="px-4 py-2.5"><span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{c.group}</span></td>
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{c.key}</div>
                    {c.description && <div className="text-xs text-muted-foreground">{c.description}</div>}
                  </td>
                  <td className="max-w-[240px] truncate px-4 py-2.5 font-mono text-xs text-muted-foreground" title={c.value ?? ''}>{c.value || '-'}</td>
                  <td className="px-4 py-2.5"><span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{c.type}</span></td>
                  <td className="px-4 py-2.5">
                    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', c.isPublic ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500' : 'bg-muted text-muted-foreground')}>
                      <span className={cn('h-1.5 w-1.5 rounded-full', c.isPublic ? 'bg-emerald-500' : 'bg-muted-foreground/50')} />
                      {c.isPublic ? t('public') : t('private')}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(c)}><Edit className="h-4 w-4" />{t('edit')}</Button>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" disabled={delMut.isPending} onClick={() => { if (confirm(t('deleteConfirm'))) delMut.mutate(c.id) }}>
                        <Trash2 className="h-4 w-4" />{t('delete')}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <DialogContent>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editing ? t('editTitle') : t('createTitle')}</DialogTitle>
              <DialogDescription>{t('createDesc')}</DialogDescription>
            </DialogHeader>
            {err && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</div>}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="s-group">{t('fieldGroup')}</Label>
                <Input id="s-group" value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })} placeholder="site / seo / watermark" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="s-key">{t('fieldKey')}</Label>
                <Input id="s-key" value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} placeholder="site_name" autoFocus />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-value">{t('fieldValue')}</Label>
              <textarea id="s-value" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder={t('valuePlaceholder')} rows={3} className={textareaClass} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="s-type">{t('fieldType')}</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as CfgType })}>
  <SelectTrigger className={selectClass}>
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    {TYPES.map((tp) => <SelectItem key={tp} value={tp}>{tp}</SelectItem>)}
  </SelectContent>
</Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="s-sort">{t('fieldSort')}</Label>
                <Input id="s-sort" type="number" value={form.sort} onChange={(e) => setForm({ ...form, sort: Number(e.target.value) })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-cred">{t('fieldCredentials')}</Label>
              <textarea id="s-cred" value={form.credentialsJson} onChange={(e) => setForm({ ...form, credentialsJson: e.target.value })} rows={3} className={textareaClass} placeholder='{"apiKey":"","secret":""}' />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-desc">{t('fieldDescription')}</Label>
              <Input id="s-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={t('descriptionPlaceholder')} />
            </div>
            <div className="flex gap-6">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={form.isPublic} onChange={(e) => setForm({ ...form, isPublic: e.target.checked })} className="h-4 w-4 accent-primary" />
                {t('fieldPublic')}
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={form.status === 1} onChange={(e) => setForm({ ...form, status: e.target.checked ? 1 : 0 })} className="h-4 w-4 accent-primary" />
                {t('fieldEnabled')}
              </label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close} disabled={saveMut.isPending}>{tc('cancel')}</Button>
              <Button type="submit" disabled={saveMut.isPending}>{saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}{t('save')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
