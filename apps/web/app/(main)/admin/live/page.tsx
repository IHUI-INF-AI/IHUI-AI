'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import {
  Plus,
  Edit,
  Trash2,
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Radio,
  CheckCircle2,
  FolderTree,
  Users,
  Eye,
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
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  Switch,
  Card,
  CardContent,
} from '@ihui/ui'

interface Channel {
  id: string
  title: string
  coverImage: string | null
  intro: string | null
  categoryId: string | null
  categoryName: string | null
  lecturerId: string | null
  lecturerName: string | null
  pushUrl: string | null
  playUrl: string | null
  startTime: string | null
  endTime: string | null
  isLive: boolean
  isPublished: boolean
  sort: number
  status: number
  viewCount: number
  createdAt: string
  updatedAt: string
}

interface Category {
  id: string
  name: string
  sort: number
  status: number
}

interface Lecturer {
  id: string
  name: string
  title: string | null
  sort: number
  status: number
}

interface ChannelsData {
  list: Channel[]
  total: number
  page: number
  pageSize: number
}

interface LiveStatistics {
  total: number
  living: number
  published: number
  viewSum: number
}

const PAGE_SIZE = 10

const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

function fetchChannels(params: {
  page: number
  search: string
  categoryId: string
  lecturerId: string
}): Promise<ChannelsData> {
  const qs = new URLSearchParams({ page: String(params.page), pageSize: String(PAGE_SIZE) })
  if (params.search) qs.set('search', params.search)
  if (params.categoryId && params.categoryId !== 'all') qs.set('categoryId', params.categoryId)
  if (params.lecturerId && params.lecturerId !== 'all') qs.set('lecturerId', params.lecturerId)
  return api<ChannelsData>(`/api/admin/live/channels?${qs.toString()}`)
}

interface ChannelForm {
  title: string
  categoryId: string
  lecturerId: string
  lecturerName: string
  intro: string
  coverImage: string
  pushUrl: string
  playUrl: string
  startTime: string
  endTime: string
  isLive: boolean
  isPublished: boolean
  sort: string
}

const EMPTY_FORM: ChannelForm = {
  title: '',
  categoryId: '',
  lecturerId: '',
  lecturerName: '',
  intro: '',
  coverImage: '',
  pushUrl: '',
  playUrl: '',
  startTime: '',
  endTime: '',
  isLive: false,
  isPublished: false,
  sort: '0',
}

function toLocalInput(v: string | null): string {
  if (!v) return ''
  // 兼容 ISO 字符串，截到分钟
  return v.replace('T', 'T').slice(0, 16)
}

function StatCard({
  icon: Icon,
  label,
  value,
  gradient,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  gradient: string
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div
          className={cn(
            'flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-white',
            gradient,
          )}
        >
          <Icon className="h-7 w-7" />
        </div>
        <div className="min-w-0">
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function AdminLivePage() {
  const t = useTranslations('admin.live')
  const qc = useQueryClient()

  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [categoryId, setCategoryId] = React.useState('all')
  const [lecturerId, setLecturerId] = React.useState('all')
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

  React.useEffect(() => {
    setPage(1)
  }, [categoryId, lecturerId])

  const { data: stats } = useQuery({
    queryKey: ['live', 'statistics'],
    queryFn: () =>
      api<{ statistics: LiveStatistics }>(`/api/live/statistics`).then((d) => d.statistics),
    retry: 0,
  })

  const { data: categoriesData } = useQuery({
    queryKey: ['admin', 'live', 'categories', 'all'],
    queryFn: () => api<{ list: Category[] }>(`/api/admin/live/categories`).then((d) => d.list ?? []),
  })
  const categories = categoriesData ?? []

  const { data: lecturersData } = useQuery({
    queryKey: ['admin', 'live', 'lecturers', 'all'],
    queryFn: () =>
      api<{ list: Lecturer[] }>(`/api/admin/live/lecturers?page=1&pageSize=100`).then(
        (d) => d.list ?? [],
      ),
  })
  const lecturers = lecturersData ?? []

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'live', 'channels', debounced, categoryId, lecturerId, page],
    queryFn: () => fetchChannels({ page, search: debounced, categoryId, lecturerId }),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        title: form.title.trim(),
        categoryId: form.categoryId || null,
        lecturerId: form.lecturerId || null,
        lecturerName: form.lecturerName.trim() || null,
        intro: form.intro.trim() || null,
        coverImage: form.coverImage.trim() || null,
        pushUrl: form.pushUrl.trim() || null,
        playUrl: form.playUrl.trim() || null,
        startTime: form.startTime ? new Date(form.startTime).toISOString() : null,
        endTime: form.endTime ? new Date(form.endTime).toISOString() : null,
        isLive: form.isLive,
        isPublished: form.isPublished,
        sort: Number(form.sort) || 0,
      }
      if (editing) {
        return api<{ channel: Channel }>(`/api/admin/live/channels/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
      }
      return api<{ channel: Channel }>(`/api/admin/live/channels`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      toast.success(editing ? t('updateSuccess') : t('createSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'live', 'channels'] })
      qc.invalidateQueries({ queryKey: ['live', 'statistics'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/live/channels/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'live', 'channels'] })
      qc.invalidateQueries({ queryKey: ['live', 'statistics'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErr(null)
    setOpen(true)
  }

  function openEdit(ch: Channel) {
    setEditing(ch)
    setForm({
      title: ch.title,
      categoryId: ch.categoryId ?? '',
      lecturerId: ch.lecturerId ?? '',
      lecturerName: ch.lecturerName ?? '',
      intro: ch.intro ?? '',
      coverImage: ch.coverImage ?? '',
      pushUrl: ch.pushUrl ?? '',
      playUrl: ch.playUrl ?? '',
      startTime: toLocalInput(ch.startTime),
      endTime: toLocalInput(ch.endTime),
      isLive: ch.isLive,
      isPublished: ch.isPublished,
      sort: String(ch.sort),
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
    if (!form.title.trim()) {
      setErr(t('titleRequired'))
      return
    }
    saveMut.mutate()
  }

  function handleDelete(ch: Channel) {
    if (!window.confirm(t('deleteConfirm'))) return
    deleteMut.mutate(ch.id)
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const channels = data?.list ?? []

  const channelTotal = stats?.total ?? 0
  const livingTotal = stats?.living ?? 0
  const publishedTotal = stats?.published ?? 0
  const viewSum = stats?.viewSum ?? 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/live/categories">
              <FolderTree className="h-4 w-4" />
              {t('categories')}
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/live/lecturers">
              <Users className="h-4 w-4" />
              {t('lecturers')}
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Radio}
          label={t('statChannelTotal')}
          value={channelTotal}
          gradient="bg-gradient-to-br from-indigo-500 to-purple-700"
        />
        <StatCard
          icon={Radio}
          label={t('statLiving')}
          value={livingTotal}
          gradient="bg-gradient-to-br from-rose-500 to-red-500"
        />
        <StatCard
          icon={CheckCircle2}
          label={t('statPublished')}
          value={publishedTotal}
          gradient="bg-gradient-to-br from-emerald-500 to-green-400"
        />
        <StatCard
          icon={Eye}
          label={t('statViewSum')}
          value={viewSum}
          gradient="bg-gradient-to-br from-sky-500 to-blue-500"
        />
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
        <div className="w-full max-w-[180px]">
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className={selectClass} aria-label={t('allCategories')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allCategories')}</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full max-w-[180px]">
          <Select value={lecturerId} onValueChange={setLecturerId}>
            <SelectTrigger className={selectClass} aria-label={t('allLecturers')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allLecturers')}</SelectItem>
              {lecturers.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
              <TableHead className="px-4 py-2.5">{t('colTitle')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colCategory')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colLecturer')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colStatus')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colSort')}</TableHead>
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
                  <Radio className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('noData')}
                </TableCell>
              </TableRow>
            ) : (
              channels.map((ch) => {
                const published = ch.isPublished
                const live = ch.isLive
                return (
                  <TableRow key={ch.id} className="hover:bg-muted/30">
                    <TableCell className="px-4 py-2.5">
                      <div className="font-medium">{ch.title}</div>
                      {ch.intro ? (
                        <div className="max-w-xs truncate text-xs text-muted-foreground">
                          {ch.intro}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      {ch.categoryName ?? (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      {ch.lecturerName ?? (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      <div className="flex flex-col gap-1">
                        {live ? (
                          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-600 dark:text-rose-500">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                            {t('liveNow')}
                          </span>
                        ) : null}
                        <span
                          className={cn(
                            'inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                            published
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
                              : 'bg-muted text-muted-foreground',
                          )}
                        >
                          <span
                            className={cn(
                              'h-1.5 w-1.5 rounded-full',
                              published ? 'bg-emerald-500' : 'bg-muted-foreground',
                            )}
                          />
                          {published ? t('published') : t('unpublished')}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-2.5">{ch.sort}</TableCell>
                    <TableCell className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(ch)}
                          title={t('edit')}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(ch)}
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
        <DialogContent className="max-w-2xl">
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
              <Label htmlFor="ch-title">{t('fieldTitle')}</Label>
              <Input
                id="ch-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder={t('titlePlaceholder')}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="ch-category">{t('fieldCategory')}</Label>
                <Select
                  value={form.categoryId || 'none'}
                  onValueChange={(v) => setForm({ ...form, categoryId: v === 'none' ? '' : v })}
                >
                  <SelectTrigger className={selectClass} id="ch-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('noCategory')}</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ch-lecturer">{t('fieldLecturer')}</Label>
                <Select
                  value={form.lecturerId || 'none'}
                  onValueChange={(v) => setForm({ ...form, lecturerId: v === 'none' ? '' : v })}
                >
                  <SelectTrigger className={selectClass} id="ch-lecturer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('noLecturer')}</SelectItem>
                    {lecturers.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="ch-intro">{t('fieldIntro')}</Label>
              <Input
                id="ch-intro"
                value={form.intro}
                onChange={(e) => setForm({ ...form, intro: e.target.value })}
                placeholder={t('introPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ch-cover">{t('fieldCoverImage')}</Label>
              <Input
                id="ch-cover"
                value={form.coverImage}
                onChange={(e) => setForm({ ...form, coverImage: e.target.value })}
                placeholder={t('coverPlaceholder')}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="ch-push">{t('fieldPushUrl')}</Label>
                <Input
                  id="ch-push"
                  value={form.pushUrl}
                  onChange={(e) => setForm({ ...form, pushUrl: e.target.value })}
                  placeholder={t('pushUrlPlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ch-play">{t('fieldPlayUrl')}</Label>
                <Input
                  id="ch-play"
                  value={form.playUrl}
                  onChange={(e) => setForm({ ...form, playUrl: e.target.value })}
                  placeholder={t('playUrlPlaceholder')}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="ch-start">{t('fieldStartTime')}</Label>
                <Input
                  id="ch-start"
                  type="datetime-local"
                  value={form.startTime}
                  onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                  placeholder={t('timePlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ch-end">{t('fieldEndTime')}</Label>
                <Input
                  id="ch-end"
                  type="datetime-local"
                  value={form.endTime}
                  onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                  placeholder={t('timePlaceholder')}
                />
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  id="ch-live"
                  checked={form.isLive}
                  onCheckedChange={(v) => setForm({ ...form, isLive: v })}
                />
                <Label htmlFor="ch-live">{t('fieldIsLive')}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="ch-published"
                  checked={form.isPublished}
                  onCheckedChange={(v) => setForm({ ...form, isPublished: v })}
                />
                <Label htmlFor="ch-published">{t('fieldPublished')}</Label>
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
