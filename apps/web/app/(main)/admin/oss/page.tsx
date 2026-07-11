'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { HardDrive, Plus, Edit, Trash2, Loader2, Star } from 'lucide-react'

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
import { cn } from '@/lib/utils'

type Driver = 'local' | 'aliyun-oss' | 'tencent-cos' | 'qiniu' | 's3' | 'minio'

interface OssDriver {
  id: string
  name: string
  driver: Driver
  isEnabled: boolean
  isDefault: boolean
  sort: number
  description?: string | null
  config?: Record<string, unknown>
  credentials?: Record<string, unknown>
  updatedAt?: string
}

const DRIVERS: Driver[] = ['local', 'aliyun-oss', 'tencent-cos', 'qiniu', 's3', 'minio']
const EMPTY = {
  name: '',
  driver: 'local' as Driver,
  isEnabled: false,
  isDefault: false,
  sort: 0,
  description: '',
  credentialsJson: '{}',
  configJson: '{}',
}
const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
const th = 'px-4 py-2.5 font-medium'
const textareaClass =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono'

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}
function normList(d: unknown): OssDriver[] {
  return Array.isArray(d) ? (d as OssDriver[]) : ((d as { list?: OssDriver[] })?.list ?? [])
}
function parseJson(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s || '{}')
  } catch {
    return {}
  }
}

export default function AdminOssPage() {
  const t = useTranslations('admin.oss')
  const tc = useTranslations('common')
  const qc = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<OssDriver | null>(null)
  const [form, setForm] = React.useState(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  const { data: list = [], isLoading } = useQuery({
    queryKey: ['admin', 'oss', 'drivers'],
    queryFn: async () => normList(await api('/api/admin/oss/drivers')),
  })
  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name,
        driver: form.driver,
        isEnabled: form.isEnabled,
        isDefault: form.isDefault,
        sort: form.sort,
        description: form.description || undefined,
        credentials: parseJson(form.credentialsJson),
        config: parseJson(form.configJson),
      }
      return editing
        ? api(`/api/admin/oss/drivers/${editing.id}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
          })
        : api('/api/admin/oss/drivers', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'oss', 'drivers'] })
      close()
    },
    onError: (e: Error) => setErr(e.message),
  })
  const delMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/oss/drivers/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'oss', 'drivers'] }),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setErr(null)
    setOpen(true)
  }
  function openEdit(c: OssDriver) {
    setEditing(c)
    setForm({
      name: c.name,
      driver: c.driver,
      isEnabled: c.isEnabled,
      isDefault: c.isDefault,
      sort: c.sort,
      description: c.description ?? '',
      credentialsJson: JSON.stringify(c.credentials ?? {}, null, 2),
      configJson: JSON.stringify(c.config ?? {}, null, 2),
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
    if (!form.name.trim()) {
      setErr(t('nameRequired'))
      return
    }
    saveMut.mutate()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <HardDrive className="h-6 w-6 text-primary" />
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {t('create')}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className={th}>{t('colName')}</th>
              <th className={th}>{t('colDriver')}</th>
              <th className={th}>{t('colEnabled')}</th>
              <th className={th}>{t('colDefault')}</th>
              <th className={th}>{t('colSort')}</th>
              <th className={cn(th, 'text-right')}>{t('colActions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  {t('loading')}
                </td>
              </tr>
            ) : list.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  {t('noData')}
                </td>
              </tr>
            ) : (
              list.map((c) => (
                <tr key={c.id} className="transition-colors hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{c.name}</div>
                    {c.description && (
                      <div className="text-xs text-muted-foreground">{c.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                      {c.driver}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                        c.isEnabled
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          c.isEnabled ? 'bg-emerald-500' : 'bg-muted-foreground/50',
                        )}
                      />
                      {c.isEnabled ? t('enabled') : t('disabled')}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {c.isDefault && <Star className="h-4 w-4 fill-amber-400 text-amber-400" />}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{c.sort}</td>
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
              <Label htmlFor="o-name">{t('fieldName')}</Label>
              <Input
                id="o-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t('namePlaceholder')}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="o-driver">{t('fieldDriver')}</Label>
                <Select
                  value={form.driver}
                  onValueChange={(v) => setForm({ ...form, driver: v as Driver })}
                >
                  <SelectTrigger className={selectClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DRIVERS.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="o-sort">{t('fieldSort')}</Label>
                <Input
                  id="o-sort"
                  type="number"
                  value={form.sort}
                  onChange={(e) => setForm({ ...form, sort: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="o-desc">{t('fieldDescription')}</Label>
              <Input
                id="o-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder={t('descriptionPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="o-cred">{t('fieldCredentials')}</Label>
              <textarea
                id="o-cred"
                value={form.credentialsJson}
                onChange={(e) => setForm({ ...form, credentialsJson: e.target.value })}
                rows={4}
                className={textareaClass}
                placeholder='{"accessKey":"","secretKey":"","bucket":"","region":""}'
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="o-cfg">{t('fieldConfig')}</Label>
              <textarea
                id="o-cfg"
                value={form.configJson}
                onChange={(e) => setForm({ ...form, configJson: e.target.value })}
                rows={3}
                className={textareaClass}
                placeholder='{"endpoint":"","cdn":""}'
              />
            </div>
            <div className="flex gap-6">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isEnabled}
                  onChange={(e) => setForm({ ...form, isEnabled: e.target.checked })}
                  className="h-4 w-4 accent-primary"
                />
                {t('fieldEnabled')}
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                  className="h-4 w-4 accent-primary"
                />
                {t('fieldDefault')}
              </label>
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
