'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Search, Loader2, ChevronLeft, ChevronRight, ClipboardList } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Button,
  Input,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui'

interface SignupRow {
  id: string
  lessonId: string
  userId: string
  status: number
  createdAt: string
  lessonTitle?: string
  nickname?: string
  phone?: string
}

interface SignupsData {
  list: SignupRow[]
  total: number
  page: number
  pageSize: number
}

const PAGE_SIZE = 20

const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const STATUS_OPTIONS: { value: string; key: string }[] = [
  { value: '0', key: 'statusPending' },
  { value: '1', key: 'statusApproved' },
  { value: '2', key: 'statusRejected' },
  { value: '3', key: 'statusCompleted' },
]

function statusBadgeClass(status: number): string {
  switch (status) {
    case 1:
      return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
    case 2:
      return 'bg-rose-500/10 text-rose-600 dark:text-rose-500'
    case 3:
      return 'bg-primary/10 text-primary'
    default:
      return 'bg-amber-500/10 text-amber-600 dark:text-amber-500'
  }
}

function statusDotClass(status: number): string {
  switch (status) {
    case 1:
      return 'bg-emerald-500'
    case 2:
      return 'bg-rose-500'
    case 3:
      return 'bg-primary'
    default:
      return 'bg-amber-500'
  }
}

export default function AdminLearnSignupsPage() {
  const t = useTranslations('admin.learn')
  const qc = useQueryClient()

  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<string>('all')
  const [page, setPage] = React.useState(1)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [search])

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'learn', 'signups', debounced, statusFilter, page],
    queryFn: () => {
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      })
      if (debounced) qs.set('search', debounced)
      if (statusFilter !== 'all') qs.set('status', statusFilter)
      return api<SignupsData>(`/api/admin/learn/signups?${qs.toString()}`)
    },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: number }) =>
      api<{ signup: SignupRow }>(`/api/admin/learn/signups/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      toast.success(t('signupsUpdateSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'learn', 'signups'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rows = data?.list ?? []

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('signupsTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('signupsSubtitle')}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/learn">
            <ChevronLeft className="h-4 w-4" />
            {t('backToLearnSignups')}
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('signupsSearchPlaceholder')}
            className="h-9 pl-8"
          />
        </div>
        <div className="w-40">
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v)
              setPage(1)
            }}
          >
            <SelectTrigger className={selectClass}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allStatus')}</SelectItem>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {t(opt.key)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-4 py-2.5">{t('colLesson')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colUser')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colPhone')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colSignupStatus')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colCreatedAt')}</TableHead>
              <TableHead className="px-4 py-2.5 text-right">{t('updateStatus')}</TableHead>
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
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  <ClipboardList className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('signupsNoData')}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const status = row.status
                return (
                  <TableRow key={row.id} className="hover:bg-muted/30">
                    <TableCell className="px-4 py-2.5 font-medium">
                      {row.lessonTitle ?? row.lessonId}
                    </TableCell>
                    <TableCell className="px-4 py-2.5">{row.nickname ?? row.userId}</TableCell>
                    <TableCell className="px-4 py-2.5">{row.phone ?? '—'}</TableCell>
                    <TableCell className="px-4 py-2.5">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                          statusBadgeClass(status),
                        )}
                      >
                        <span className={cn('h-1.5 w-1.5 rounded-full', statusDotClass(status))} />
                        {t(
                          STATUS_OPTIONS.find((o) => Number(o.value) === status)?.key ??
                            'statusPending',
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-muted-foreground">
                      {new Date(row.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-right">
                      <Select
                        value={String(status)}
                        onValueChange={(v) => updateMut.mutate({ id: row.id, status: Number(v) })}
                      >
                        <SelectTrigger
                          className={cn(selectClass, 'ml-auto w-32 text-left')}
                          disabled={updateMut.isPending}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {t(opt.key)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{t('signupsTotal', { total })}</span>
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
    </div>
  )
}
