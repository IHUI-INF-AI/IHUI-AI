'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Phone, Plus, Edit, Trash2, Loader2, Download, Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { fetchApi } from '@/lib/api'
import { exportFromApi, type ExportColumn } from '@/lib/export-utils'
import { HasPermi } from '@/components/auth/HasPermi'
import {
  Button,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@ihui/ui'
import { RichTextEditor } from '@/components/editor/RichTextEditor'

interface ContactItem {
  id: string
  introduction: string
  corporateCulture: string
}

interface ContactList {
  list: ContactItem[]
  total: number
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const RESOURCE = '/api/admin/contact'
const PERM = 'system:contact'
const EMPTY: ContactItem = { id: '', introduction: '', corporateCulture: '' }
const th = 'px-4 py-2.5 font-medium'
const FIELDS: {
  key: keyof Pick<ContactItem, 'introduction' | 'corporateCulture'>
  label: string
}[] = [
  { key: 'introduction', label: 'fieldIntroduction' },
  { key: 'corporateCulture', label: 'fieldCorporateCulture' },
]

export default function ContactPage() {
  const t = useTranslations('adminContact')
  const qc = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<ContactItem | null>(null)
  const [form, setForm] = React.useState<ContactItem>(EMPTY)
  const [search, setSearch] = React.useState<Record<string, string>>({
    introduction: '',
    corporateCulture: '',
  })
  const [page, setPage] = React.useState(1)
  const pageSize = 10

  const params = React.useMemo(() => {
    const p: Record<string, string> = { page: String(page), pageSize: String(pageSize) }
    FIELDS.forEach((f) => {
      const v = (search[f.key] || '').trim()
      if (v) p[f.key] = v
    })
    return p
  }, [search, page])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'contact', params],
    queryFn: () => api<ContactList>(`${RESOURCE}?${new URLSearchParams(params)}`),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = JSON.stringify({
        introduction: form.introduction,
        corporateCulture: form.corporateCulture,
      })
      return editing?.id
        ? api(`${RESOURCE}/${editing.id}`, { method: 'PUT', body })
        : api(RESOURCE, { method: 'POST', body })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'contact'] })
      close()
    },
  })
  const delMut = useMutation({
    mutationFn: (id: string) => api(`${RESOURCE}/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'contact'] }),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setOpen(true)
  }
  function openEdit(item: ContactItem) {
    setEditing(item)
    setForm(item)
    setOpen(true)
  }
  function close() {
    if (saveMut.isPending) return
    setOpen(false)
    setEditing(null)
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    saveMut.mutate()
  }
  function handleReset() {
    setSearch({ introduction: '', corporateCulture: '' })
    setPage(1)
  }
  async function handleExport() {
    const EXPORT_COLS: ExportColumn[] = [
      { key: 'id', title: 'ID' },
      ...FIELDS.map((f) => ({ key: f.key, title: t(f.label) })),
    ]
    const ok = await exportFromApi(
      `${RESOURCE}?${new URLSearchParams(params)}`,
      t('exportName'),
      EXPORT_COLS,
    )
    if (!ok) alert(t('exportFailed'))
  }

  const list = data?.list ?? []
  const total = data?.total ?? 0
  const stripHtml = (s: string) => s.replace(/<[^>]+>/g, '').slice(0, 50) || '-'

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Phone className="h-6 w-6 text-primary" />
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <HasPermi code={`${PERM}:export`}>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4" />
              {t('export')}
            </Button>
          </HasPermi>
          <HasPermi code={`${PERM}:add`}>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              {t('add')}
            </Button>
          </HasPermi>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
        {FIELDS.map((f) => (
          <div key={f.key} className="space-y-1">
            <Label className="text-xs">{t(f.label)}</Label>
            <Input
              className="h-9 w-48"
              value={search[f.key]}
              onChange={(e) => setSearch({ ...search, [f.key]: e.target.value })}
              placeholder={t('searchPlaceholder', { label: t(f.label) })}
            />
          </div>
        ))}
        <Button size="sm" onClick={() => setPage(1)}>
          <Search className="h-4 w-4" />
          {t('search')}
        </Button>
        <Button variant="outline" size="sm" onClick={handleReset}>
          {t('reset')}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className={th}>{t('colId')}</th>
              <th className={th}>{t('colIntroduction')}</th>
              <th className={th}>{t('colCorporateCulture')}</th>
              <th className={`${th} text-right`}>{t('colActions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  {t('loading')}
                </td>
              </tr>
            ) : list.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                  {t('noData')}
                </td>
              </tr>
            ) : (
              list.map((item) => (
                <tr key={item.id} className="transition-colors hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-medium">{item.id}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {stripHtml(item.introduction)}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {stripHtml(item.corporateCulture)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      <HasPermi code={`${PERM}:edit`}>
                        <Button size="sm" variant="ghost" onClick={() => openEdit(item)}>
                          <Edit className="h-4 w-4" />
                          {t('edit')}
                        </Button>
                      </HasPermi>
                      <HasPermi code={`${PERM}:remove`}>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          disabled={delMut.isPending}
                          onClick={() => confirm(t('confirmDelete')) && delMut.mutate(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          {t('delete')}
                        </Button>
                      </HasPermi>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {total > pageSize && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t('total', { total })}</span>
          <div className="flex gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="rounded border px-2 py-1 disabled:opacity-50"
            >
              {t('prevPage')}
            </button>
            <button
              disabled={page * pageSize >= total}
              onClick={() => setPage(page + 1)}
              className="rounded border px-2 py-1 disabled:opacity-50"
            >
              {t('nextPage')}
            </button>
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <DialogContent className="max-w-2xl">
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editing ? t('editTitle') : t('createTitle')}</DialogTitle>
            </DialogHeader>
            {FIELDS.map((f) => (
              <div key={f.key} className="space-y-2">
                <Label>{t(f.label)}</Label>
                <RichTextEditor
                  value={form[f.key]}
                  onChange={(html) => setForm({ ...form, [f.key]: html })}
                  placeholder={t('inputPlaceholder', { label: t(f.label) })}
                />
              </div>
            ))}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close} disabled={saveMut.isPending}>
                {t('cancel')}
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
