'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Settings, Plus, Edit, Trash2, Loader2 } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import {
  Button,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@ihui/ui'
import { Radio, Switch, Textarea } from '@/components/form'
import { cn } from '@/lib/utils'

type Category = 'general' | 'mail' | 'storage' | 'security' | 'payment' | 'ai'
type CfgType = 'string' | 'number' | 'boolean' | 'json'

interface Config {
  id: string
  key: string
  value: string
  type: CfgType
  category: Category
  isPublic: boolean
  description?: string
  updatedAt?: string
}

const CATEGORIES: Category[] = ['general', 'mail', 'storage', 'security', 'payment', 'ai']
const TYPES: CfgType[] = ['string', 'number', 'boolean', 'json']
const EMPTY = {
  key: '',
  value: '',
  type: 'string' as CfgType,
  category: 'general' as Category,
  isPublic: false,
  description: '',
}
const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
const th = 'px-4 py-2.5 font-medium'
const tabBase = 'rounded-md px-3 py-1.5 text-sm font-medium transition-colors'

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}
function normList(d: unknown): Config[] {
  return Array.isArray(d) ? (d as Config[]) : ((d as { list?: Config[] })?.list ?? [])
}

export default function AdminConfigsPage() {
  const t = useTranslations('admin.configs')
  const tc = useTranslations('common')
  const qc = useQueryClient()
  const [category, setCategory] = React.useState<'all' | Category>('all')
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Config | null>(null)
  const [form, setForm] = React.useState(EMPTY)
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
        ? api(`/api/admin/configs/${editing.id}`, { method: 'PATCH', body: JSON.stringify(body) })
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
    setForm(EMPTY)
    setErr(null)
    setOpen(true)
  }
  function openEdit(c: Config) {
    setEditing(c)
    setForm({
      key: c.key,
      value: c.value,
      type: c.type,
      category: c.category,
      isPublic: c.isPublic,
      description: c.description ?? '',
    })
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

  const filtered = category === 'all' ? list : list.filter((c) => c.category === category)
  const tabCls = (active: boolean) =>
    cn(
      tabBase,
      active
        ? 'bg-background text-foreground shadow-sm'
        : 'text-muted-foreground hover:text-foreground',
    )

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

      <div className="flex flex-wrap gap-1 rounded-lg border bg-muted/30 p-1">
        <button onClick={() => setCategory('all')} className={tabCls(category === 'all')}>
          {t('allCategories')}
        </button>
        {CATEGORIES.map((c) => (
          <button key={c} onClick={() => setCategory(c)} className={tabCls(category === c)}>
            {t(`categories.${c}`)}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className={th}>{t('colKey')}</th>
              <th className={th}>{t('colValue')}</th>
              <th className={th}>{t('colType')}</th>
              <th className={th}>{t('colCategory')}</th>
              <th className={th}>{t('colPublic')}</th>
              <th className={cn(th, 'text-right')}>{t('colActions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isError ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-destructive">
                  {t('noData')}
                </td>
              </tr>
            ) : isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  {t('loading')}
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  {t('noData')}
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} className="transition-colors hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{c.key}</div>
                    {c.description && (
                      <div className="text-xs text-muted-foreground">{c.description}</div>
                    )}
                  </td>
                  <td
                    className="max-w-[240px] break-words px-4 py-2.5 font-mono text-xs text-muted-foreground"
                    title={c.value}
                  >
                    {c.value || '-'}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                      {c.type}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {t(`categories.${c.category}`)}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                        c.isPublic
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          c.isPublic ? 'bg-emerald-500' : 'bg-muted-foreground/50',
                        )}
                      />
                      {c.isPublic ? t('public') : t('private')}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(c)}>
                        <Edit className="h-4 w-4" />
                        {t('edit')}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        disabled={delMut.isPending}
                        onClick={() => {
                          if (confirm(t('deleteConfirm'))) delMut.mutate(c.id)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                        {t('delete')}
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
            {err && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="c-key">{t('fieldKey')}</Label>
              <Input
                id="c-key"
                value={form.key}
                onChange={(e) => setForm({ ...form, key: e.target.value })}
                placeholder={t('keyPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-value">{t('fieldValue')}</Label>
              <Textarea
                id="c-value"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                placeholder={t('valuePlaceholder')}
                rows={4}
                className="font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="c-type">{t('fieldType')}</Label>
                <Radio
                  inline
                  options={TYPES.map((tp) => ({ label: tp, value: tp }))}
                  value={form.type}
                  onChange={(v) => setForm({ ...form, type: v as CfgType })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-cat">{t('fieldCategory')}</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm({ ...form, category: v as Category })}
                >
                  <SelectTrigger className={selectClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {t(`categories.${c}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-desc">{t('fieldDescription')}</Label>
              <Input
                id="c-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder={t('descriptionPlaceholder')}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.isPublic} onChange={(v) => setForm({ ...form, isPublic: v })} />
              <span className="text-sm">{t('fieldPublic')}</span>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close} disabled={saveMut.isPending}>
                {tc('cancel')}
              </Button>
              <Button type="submit" disabled={saveMut.isPending}>
                {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
