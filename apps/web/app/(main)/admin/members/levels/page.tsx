'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  Plus,
  Edit,
  Trash2,
  Loader2,
  Crown,
  ArrowLeft,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
  Card,
  CardContent,
} from '@ihui/ui'

interface MemberLevel {
  id: string
  name: string
  growthValue: number
  discount: string
  sort: number
  createdAt: string
}

const DISCOUNT_RE = /^\d+(\.\d{1,2})?$/

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

interface LevelForm {
  name: string
  growthValue: string
  discount: string
  sort: string
}

const EMPTY_FORM: LevelForm = {
  name: '',
  growthValue: '0',
  discount: '1.00',
  sort: '0',
}

export default function AdminMemberLevelsPage() {
  const t = useTranslations('admin.members')
  const qc = useQueryClient()

  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<MemberLevel | null>(null)
  const [form, setForm] = React.useState<LevelForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'members', 'levels', 'all'],
    queryFn: () => api<{ list: MemberLevel[] }>(`/api/admin/members/levels`).then((d) => d.list ?? []),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name.trim(),
        growthValue: Number(form.growthValue) || 0,
        discount: form.discount,
        sort: Number(form.sort) || 0,
      }
      if (editing) {
        return api<{ id: string }>(`/api/admin/members/levels`, {
          method: 'PUT',
          body: JSON.stringify({ id: editing.id, ...body }),
        })
      }
      return api<{ id: string }>(`/api/admin/members/levels`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      toast.success(editing ? t('updateSuccess') : t('createSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'members', 'levels'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      api(`/api/admin/members/levels?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'members', 'levels'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErr(null)
    setOpen(true)
  }

  function openEdit(level: MemberLevel) {
    setEditing(level)
    setForm({
      name: level.name,
      growthValue: String(level.growthValue),
      discount: level.discount,
      sort: String(level.sort),
    })
    setErr(null)
    setOpen(true)
  }

  function closeDialog() {
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
    if (!DISCOUNT_RE.test(form.discount)) {
      setErr(t('discountInvalid'))
      return
    }
    saveMut.mutate()
  }

  function handleDelete(level: MemberLevel) {
    if (!window.confirm(t('deleteConfirm'))) return
    deleteMut.mutate(level.id)
  }

  const levels = data ?? []
  const total = levels.length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('levelsTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('levelsSubtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/members">
              <ArrowLeft className="h-4 w-4" />
              {t('back')}
            </Link>
          </Button>
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4" />
            {t('create')}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="flex items-center gap-4 p-5">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 text-white">
            <Crown className="h-7 w-7" />
          </div>
          <div>
            <div className="text-sm text-muted-foreground">{t('statTotal')}</div>
            <div className="mt-1 text-2xl font-semibold tracking-tight">{total}</div>
          </div>
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-4 py-2.5">{t('colName')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colMinPoints')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colDiscount')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colSort')}</TableHead>
              <TableHead className="px-4 py-2.5 text-right">{t('colActions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  {t('loading')}
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={5} className="px-4 py-10 text-center text-destructive">
                  {(error as Error).message}
                </TableCell>
              </TableRow>
            ) : levels.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  <Crown className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('noData')}
                </TableCell>
              </TableRow>
            ) : (
              levels.map((level) => (
                <TableRow key={level.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5">
                    <span className="inline-flex items-center rounded-full bg-violet-500/10 px-2 py-0.5 text-xs font-medium text-violet-600 dark:text-violet-400">
                      {level.name}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-2.5">{level.growthValue}</TableCell>
                  <TableCell className="px-4 py-2.5">{level.discount}</TableCell>
                  <TableCell className="px-4 py-2.5">{level.sort}</TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(level)}
                        title={t('edit')}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(level)}
                        title={t('delete')}
                        className="text-destructive hover:text-destructive"
                        disabled={deleteMut.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{t('total', { total })}</span>
      </div>

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : closeDialog())}>
        <DialogContent>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editing ? t('editTitle') : t('createTitle')}</DialogTitle>
            </DialogHeader>
            {err && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="level-name">{t('fieldName')}</Label>
              <Input
                id="level-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t('namePlaceholder')}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="level-points">{t('fieldMinPoints')}</Label>
                <Input
                  id="level-points"
                  type="number"
                  min="0"
                  value={form.growthValue}
                  onChange={(e) => setForm({ ...form, growthValue: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="level-discount">{t('fieldDiscount')}</Label>
                <Input
                  id="level-discount"
                  value={form.discount}
                  onChange={(e) => setForm({ ...form, discount: e.target.value })}
                  placeholder="0.90"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="level-sort">{t('fieldSort')}</Label>
                <Input
                  id="level-sort"
                  type="number"
                  min="0"
                  value={form.sort}
                  onChange={(e) => setForm({ ...form, sort: e.target.value })}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{t('discountHint')}</p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog} disabled={saveMut.isPending}>
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
