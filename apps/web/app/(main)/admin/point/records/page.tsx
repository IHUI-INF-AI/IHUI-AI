'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import {
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  History,
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
  Button,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui'

interface PointRecord {
  id: string
  memberId: string
  pointId: string | null
  channelId: string | null
  type: number
  point: number
  createdAt: string
}

interface RecordsData {
  list: PointRecord[]
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

function fetchRecords(params: {
  page: number
  memberId: string
  type: string
}): Promise<RecordsData> {
  const qs = new URLSearchParams({ page: String(params.page), pageSize: String(PAGE_SIZE) })
  if (params.memberId) qs.set('memberId', params.memberId)
  if (params.type) qs.set('type', params.type)
  return api<RecordsData>(`/api/admin/edu-points/records?${qs.toString()}`)
}

export default function AdminPointRecordsPage() {
  const t = useTranslations('admin.point')

  const [memberId, setMemberId] = React.useState('')
  const [debouncedMember, setDebouncedMember] = React.useState('')
  const [type, setType] = React.useState('')
  const [page, setPage] = React.useState(1)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebouncedMember(memberId)
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [memberId])

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'point', 'records', debouncedMember, type, page],
    queryFn: () => fetchRecords({ page, memberId: debouncedMember, type }),
  })

  function typeLabel(ty: number) {
    if (ty === 1) return t('enabled')
    return t('disabled')
  }

  function typeBadgeClass(ty: number) {
    if (ty === 1) return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
    return 'bg-muted text-muted-foreground'
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const records = data?.list ?? []

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('recordsTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('recordsSubtitle')}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/point">
            <ChevronLeft className="h-4 w-4" />
            {t('backToChannels')}
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="h-9 pl-8"
            aria-label={t('search')}
          />
        </div>
        <div className="w-[160px]">
          <Label htmlFor="rec-type" className="sr-only">
            {t('colType')}
          </Label>
          <Select
            value={type || 'all'}
            onValueChange={(v) => {
              setType(v === 'all' ? '' : v)
              setPage(1)
            }}
          >
            <SelectTrigger className={selectClass} id="rec-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('colType')}</SelectItem>
              <SelectItem value="1">{t('enabled')}</SelectItem>
              <SelectItem value="0">{t('disabled')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-4 py-2.5">{t('colName')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colType')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colPoint')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colCreatedAt')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  {t('loading')}
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={4} className="px-4 py-10 text-center text-destructive">
                  {(error as Error).message}
                </TableCell>
              </TableRow>
            ) : records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                  <History className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('noData')}
                </TableCell>
              </TableRow>
            ) : (
              records.map((rec) => (
                <TableRow key={rec.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5 font-medium">{rec.memberId}</TableCell>
                  <TableCell className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                        typeBadgeClass(rec.type),
                      )}
                    >
                      {typeLabel(rec.type)}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-2.5">{rec.point}</TableCell>
                  <TableCell className="px-4 py-2.5 text-muted-foreground">
                    {rec.createdAt}
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
    </div>
  )
}
