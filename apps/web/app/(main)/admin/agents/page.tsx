'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Search, Loader2, ChevronLeft, ChevronRight, Bot } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/data/Avatar'
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
} from '@ihui/ui'

interface Agent {
  agentId: string
  name: string
  description: string | null
  avatar: string | null
  cover: string | null
  categoryId: string | null
  status: string
  price: number
  isFree: boolean
  sort: number
  remark: string | null
  createdAt: string
  updatedAt: string
}

interface Category {
  categoryId: string
  name: string
}

interface AgentsData {
  list: Agent[]
  total: number
  page: number
  pageSize: number
}

interface CategoriesData {
  list: Category[]
  total: number
  page: number
  pageSize: number
}

const PAGE_SIZE = 20
const STATUS_OPTIONS = ['pending', 'published', 'rejected', 'offline']

const STATUS_CLASS: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-500',
  published: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
  rejected: 'bg-destructive/10 text-destructive',
  offline: 'bg-muted text-muted-foreground',
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

function fetchAgents(params: {
  page: number
  keyword: string
  status: string
}): Promise<AgentsData> {
  const qs = new URLSearchParams({ page: String(params.page), pageSize: String(PAGE_SIZE) })
  if (params.keyword) qs.set('keyword', params.keyword)
  if (params.status !== 'all') qs.set('status', params.status)
  return api<AgentsData>(`/api/agents/list?${qs.toString()}`)
}

interface AgentForm {
  name: string
  description: string
  avatar: string
  cover: string
  categoryId: string
  status: string
  price: string
  isFree: boolean
  sort: string
  remark: string
}

const EMPTY_FORM: AgentForm = {
  name: '',
  description: '',
  avatar: '',
  cover: '',
  categoryId: '',
  status: 'pending',
  price: '0',
  isFree: true,
  sort: '0',
  remark: '',
}

const selectClass =
  'h-8 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
const selectClassLg =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export default function AdminAgentsPage() {
  const t = useTranslations('admin.agents')
  const tc = useTranslations('common')
  const locale = useLocale()
  const qc = useQueryClient()

  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [status, setStatus] = React.useState('all')
  const [page, setPage] = React.useState(1)

  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Agent | null>(null)
  const [form, setForm] = React.useState<AgentForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [search])

  const { data: catData } = useQuery({
    queryKey: ['agents', 'categories'],
    queryFn: () => api<CategoriesData>(`/api/categories/list?page=1&pageSize=100`),
  })

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'agents', debounced, status, page],
    queryFn: () => fetchAgents({ page, keyword: debounced, status }),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        avatar: form.avatar.trim() || undefined,
        cover: form.cover.trim() || undefined,
        categoryId: form.categoryId || undefined,
        status: form.status,
        price: Number(form.price) || 0,
        isFree: form.isFree,
        sort: Number(form.sort) || 0,
        remark: form.remark.trim() || undefined,
      }
      return api<Agent>(`/api/agents/${editing!.agentId}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      toast.success(t('updateSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'agents'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/api/agents/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'agents'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openEdit(agent: Agent) {
    setEditing(agent)
    setForm({
      name: agent.name,
      description: agent.description ?? '',
      avatar: agent.avatar ?? '',
      cover: agent.cover ?? '',
      categoryId: agent.categoryId ?? '',
      status: agent.status,
      price: String(agent.price),
      isFree: agent.isFree,
      sort: String(agent.sort),
      remark: agent.remark ?? '',
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

  function handleDelete(agent: Agent) {
    if (!window.confirm(t('deleteConfirm'))) return
    deleteMut.mutate(agent.agentId)
  }

  const categories = catData?.list ?? []
  const agents = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const priceFmt = new Intl.NumberFormat(locale, { style: 'currency', currency: 'CNY' })

  const catName = (id: string | null) =>
    id ? (categories.find((c) => c.categoryId === id)?.name ?? '-') : '-'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Bot className="h-6 w-6 text-primary" />
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button asChild size="sm">
          <Link href="/agents/create">
            <Plus className="h-4 w-4" />
            {tc('create')}
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="h-9 pl-8"
            aria-label={tc('search')}
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v)
            setPage(1)
          }}
        >
          <SelectTrigger className={selectClass} aria-label={t('fieldStatus')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allStatus')}</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`status${s.charAt(0).toUpperCase()}${s.slice(1)}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-4 py-2.5">{t('colName')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colCategory')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colPrice')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colStatus')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colSort')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colCreatedAt')}</TableHead>
              <TableHead className="px-4 py-2.5 text-right">{t('colActions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  {t('loading')}
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={7} className="px-4 py-10 text-center text-destructive">
                  {(error as Error).message}
                </TableCell>
              </TableRow>
            ) : agents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  <Bot className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('empty')}
                </TableCell>
              </TableRow>
            ) : (
              agents.map((a) => (
                <TableRow key={a.agentId} className="transition-colors hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <Avatar src={a.avatar ?? undefined} name={a.name ?? 'A'} size="sm" />
                      <span className="font-medium">{a.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-muted-foreground">
                    {catName(a.categoryId)}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    {a.isFree ? (
                      <span className="text-emerald-600 dark:text-emerald-500">{t('free')}</span>
                    ) : (
                      priceFmt.format(a.price)
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                        STATUS_CLASS[a.status] ?? STATUS_CLASS.pending,
                      )}
                    >
                      {t(`status${a.status.charAt(0).toUpperCase()}${a.status.slice(1)}`)}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-muted-foreground">{a.sort}</TableCell>
                  <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">
                    {dateFmt.format(new Date(a.createdAt))}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEdit(a)}
                        title={tc('edit')}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(a)}
                        disabled={deleteMut.isPending}
                        title={tc('delete')}
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

      <Dialog open={open} onOpenChange={(v) => !v && closeDialog()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('editTitle')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ed-name">
                {t('fieldName')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="ed-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ed-desc">{t('fieldDescription')}</Label>
              <textarea
                id="ed-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ed-avatar">{t('fieldAvatar')}</Label>
                <Input
                  id="ed-avatar"
                  value={form.avatar}
                  onChange={(e) => setForm((f) => ({ ...f, avatar: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ed-cover">{t('fieldCover')}</Label>
                <Input
                  id="ed-cover"
                  value={form.cover}
                  onChange={(e) => setForm((f) => ({ ...f, cover: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ed-cat">{t('fieldCategory')}</Label>
                <Select
                  value={form.categoryId}
                  onValueChange={(v) => setForm((f) => ({ ...f, categoryId: v }))}
                >
                  <SelectTrigger className={selectClassLg} id="ed-cat">
                    <SelectValue placeholder={t('fieldCategoryPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.categoryId} value={c.categoryId}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ed-status">{t('fieldStatus')}</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
                >
                  <SelectTrigger className={selectClassLg} id="ed-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {t(`status${s.charAt(0).toUpperCase()}${s.slice(1)}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="ed-price">{t('fieldPrice')}</Label>
                <Input
                  id="ed-price"
                  type="number"
                  min={0}
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  disabled={form.isFree}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ed-sort">{t('fieldSort')}</Label>
                <Input
                  id="ed-sort"
                  type="number"
                  min={0}
                  value={form.sort}
                  onChange={(e) => setForm((f) => ({ ...f, sort: e.target.value }))}
                />
              </div>
              <div className="flex items-end">
                <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                  <Switch
                    id="ed-free"
                    checked={form.isFree}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, isFree: v }))}
                  />
                  <Label htmlFor="ed-free" className="cursor-pointer">
                    {t('fieldIsFree')}
                  </Label>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ed-remark">{tc('remark')}</Label>
              <textarea
                id="ed-remark"
                value={form.remark}
                onChange={(e) => setForm((f) => ({ ...f, remark: e.target.value }))}
                rows={2}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            {err && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeDialog}
                disabled={saveMut.isPending}
              >
                {tc('cancel')}
              </Button>
              <Button type="submit" disabled={saveMut.isPending}>
                {saveMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {tc('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
