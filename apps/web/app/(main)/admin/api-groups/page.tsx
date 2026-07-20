'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { FolderTree, Plus, Edit, Trash2, Loader2 } from 'lucide-react'

import { fetchApi } from '@/lib/api'
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
import { TruncatedText } from '@/components/common'
import { cn } from '@/lib/utils'

interface ApiGroup {
  id: string
  name: string
  description: string
  apiCount: number
  createdAt: string
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const EMPTY = { name: '', description: '' }
const th = 'px-4 py-2.5 font-medium'
const textareaClass =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export default function ApiGroupsPage() {
  const t = useTranslations('adminTools')
  const tc = useTranslations('common')
  const qc = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<ApiGroup | null>(null)
  const [form, setForm] = React.useState(EMPTY)

  const { data: list, isLoading } = useQuery({
    queryKey: ['admin', 'api-groups'],
    queryFn: async () => {
      const d = await api<{ list?: ApiGroup[] } | ApiGroup[]>('/api/admin/api-groups')
      const arr = Array.isArray(d) ? d : (d.list ?? [])
      return arr
    },
  })

  const saveMut = useMutation({
    mutationFn: () => Promise.resolve(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'api-groups'] })
      close()
      toast.success(t('apiGroups.saveSuccess'))
    },
  })
  const delMut = useMutation({
    mutationFn: (_id: string) => Promise.resolve(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'api-groups'] })
      toast.success(t('apiGroups.deleteSuccess'))
    },
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setOpen(true)
  }
  function openEdit(g: ApiGroup) {
    setEditing(g)
    setForm({ name: g.name, description: g.description })
    setOpen(true)
  }
  function close() {
    if (saveMut.isPending) return
    setOpen(false)
    setEditing(null)
    setForm(EMPTY)
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error(t('apiGroups.nameRequired'))
      return
    }
    saveMut.mutate()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <FolderTree className="h-6 w-6 text-primary" />
            {t('apiGroups.title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('apiGroups.subtitle')}</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {t('apiGroups.create')}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {tc('search')}
        </div>
      ) : !list?.length ? (
        <div className="rounded-lg border border-dashed py-16 text-center text-muted-foreground">
          {t('apiGroups.noData')}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className={th}>{t('apiGroups.colName')}</th>
                <th className={th}>{t('apiGroups.colDescription')}</th>
                <th className={th}>{t('apiGroups.colApiCount')}</th>
                <th className={th}>{t('apiGroups.colCreatedAt')}</th>
                <th className={cn(th, 'text-right')}>{t('apiGroups.colActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {list.map((g) => (
                <tr key={g.id} className="transition-colors hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-medium">{g.name}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    <TruncatedText value={g.description} className="max-w-[280px]" />
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {g.apiCount}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{g.createdAt}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(g)}>
                        <Edit className="h-4 w-4" />
                        {tc('edit')}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        disabled={delMut.isPending}
                        onClick={() => {
                          if (confirm(t('apiGroups.deleteConfirm'))) delMut.mutate(g.id)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                        {tc('delete')}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <DialogContent>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>
                {editing ? t('apiGroups.editTitle') : t('apiGroups.createTitle')}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="ag-name">{t('apiGroups.fieldName')}</Label>
              <Input
                id="ag-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t('apiGroups.namePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ag-desc">{t('apiGroups.fieldDescription')}</Label>
              <textarea
                id="ag-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                className={textareaClass}
                placeholder={t('apiGroups.descriptionPlaceholder')}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close} disabled={saveMut.isPending}>
                {tc('cancel')}
              </Button>
              <Button type="submit" disabled={saveMut.isPending}>
                {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {tc('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
