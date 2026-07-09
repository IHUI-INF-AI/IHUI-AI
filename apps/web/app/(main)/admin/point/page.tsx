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
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Coins,
  History,
  ListChecks,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'
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
  Switch,
} from '@ihui/ui'

interface Channel {
  id: string
  name: string
  code: string | null
  description: string | null
  sort: number
  status: number
  createdAt: string
}

interface ChannelsData {
  list: Channel[]
  total: number
  page: number
  pageSize: number
}

const PAGE_SIZE = 20

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

function fetchChannels(params: { page: number; search: string }): Promise<ChannelsData> {
  const qs = new URLSearchParams({ page: String(params.page), pageSize: String(PAGE_SIZE) })
  if (params.search) qs.set('name', params.search)
  return api<ChannelsData>(`/api/admin/edu-points/channels?${qs.toString()}`)
}

interface ChannelForm {
  name: string
  code: string
  description: string
  sort: string
  status: boolean
}

const EMPTY_FORM: ChannelForm = {
  name: '',
  code: '',
  description: '',
  sort: '0',
  status: true,
}

export default function AdminPointPage() {
  const t = useTranslations('admin.point')
  const qc = useQueryClient()

  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [page, setPage] = React.useState(1)

  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Channel | null>(null)
  const [form, setForm] = React.useState<ChannelForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [search])

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'point', 'channels', debounced, page],
    queryFn: () => fetchChannels({ page, search: debounced }),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name.trim(),
        code: form.code.trim() || undefined,
        description: form.description.trim() || undefined,
        sort: Number(form.sort) || 0,
        status: form.status ? 1 : 0,
      }
      if (editing) {
        return api<{ channel: Channel }>(`/api/admin/edu-points/channels/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
      }
      return api<{ channel: Channel }>(`/api/admin/edu-points/channels`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      toast.success(editing ? t('updateSuccess') : t('createSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'point', 'channels'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      api(`/api/admin/edu-points/channels/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'point', 'channels'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErr(null)
    setOpen(true)
  }

  function openEdit(channel: Channel) {
    setEditing(channel)
    setForm({
      name: channel.name,
      code: channel.code ?? '',
      description: channel.description ?? '',
      sort: String(channel.sort),
      status: channel.status === 1,
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
    saveMut.mutate()
  }

  function handleDelete(channel: Channel) {
    if (!window.confirm(t('deleteConfirm'))) return
    deleteMut.mutate(channel.id)
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const channels = data?.list ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('channelsTitle')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('channelsSubtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/point/rules">
              <ListChecks className="h-4 w-4" />
              {t('rulesTitle')}
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/point/records">
              <History className="h-4 w-4" />
              {t('recordsTitle')}
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="h-9 pl-8"
            aria-label={t('search')}
          />
        </div>
        <Button onClick={openCreate} size="sm" className="ml-auto">
          <Plus className="h-4 w-4" />
          {t('create')}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-4 py-2.5">{t('colName')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colCode')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colDescription')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colSort')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colStatus')}</TableHead>
              <TableHead className="px-4 py-2.5 text-right">{t('colActions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  {t('loading')}
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={6} className="px-4 py-10 text-center text-destructive">
                  {(error as Error).message}
                </TableCell>
              </TableRow>
            ) : channels.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  <Coins className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('noData')}
                </TableCell>
              </TableRow>
            ) : (
              channels.map((channel) => {
                const enabled = channel.status === 1
                return (
                  <TableRow key={channel.id} className="hover:bg-muted/30">
                    <TableCell className="px-4 py-2.5 font-medium">{channel.name}</TableCell>
                    <TableCell className="px-4 py-2.5">
                      {channel.code ? (
                        <span className="inline-flex items-center rounded-full bg-sky-500/10 px-2 py-0.5 text-xs font-medium text-sky-600 dark:text-sky-400">
                          {channel.code}
                        </span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-2.5">{channel.description ?? '—'}</TableCell>
                    <TableCell className="px-4 py-2.5">{channel.sort}</TableCell>
                    <TableCell className="px-4 py-2.5">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                          enabled
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        <span
                          className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            enabled ? 'bg-emerald-500' : 'bg-muted-foreground',
                          )}
                        />
                        {enabled ? t('enabled') : t('disabled')}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(channel)}
                          title={t('edit')}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(channel)}
                          title={t('delete')}
                          className="text-destructive hover:text-destructive"
                          disabled={deleteMut.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{t('total', { total })}</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
            {t('prev')}
          </Button>
          <span className="text-sm text-muted-foreground">
            {t('page', { page, total: totalPages })}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('next')}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
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
              <Label htmlFor="ch-name">{t('fieldName')}</Label>
              <Input
                id="ch-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t('namePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ch-code">{t('fieldCode')}</Label>
              <Input
                id="ch-code"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder={t('codePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ch-desc">{t('fieldDescription')}</Label>
              <Input
                id="ch-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder={t('descriptionPlaceholder')}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="ch-sort">{t('fieldSort')}</Label>
                <Input
                  id="ch-sort"
                  type="number"
                  min="0"
                  value={form.sort}
                  onChange={(e) => setForm({ ...form, sort: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ch-status">{t('fieldStatus')}</Label>
                <div className="flex h-9 items-center gap-2">
                  <Switch
                    id="ch-status"
                    checked={form.status}
                    onCheckedChange={(v) => setForm({ ...form, status: v })}
                  />
                  <span className="text-sm text-muted-foreground">
                    {form.status ? t('enabled') : t('disabled')}
                  </span>
                </div>
              </div>
            </div>
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
