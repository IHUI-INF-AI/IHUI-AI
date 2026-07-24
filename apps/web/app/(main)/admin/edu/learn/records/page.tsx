'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
import { Loader2, ChevronLeft, ChevronRight, ListOrdered, Search } from 'lucide-react'
import { eduApi, buildQs, selectClass, type PageData } from '@/lib/edu'
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
} from '@ihui/ui-react'

interface LearnRecord {
  id: string
  userId: string
  userName: string | null
  type: string
  title: string
  description: string | null
  occurredAt: string
  hours: number
}
const TYPES = ['study', 'exam', 'live', 'offline', 'other']
const PAGE_SIZE = 10

export default function EduLearnRecordsPage() {
  const t = useTranslations('admin.edu.learn.records')
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [typeFilter, setTypeFilter] = React.useState('all')

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [search])
  React.useEffect(() => {
    setPage(1)
  }, [typeFilter])

  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'learn', 'records', debounced, typeFilter, page],
    queryFn: () =>
      eduApi<PageData<LearnRecord>>(
        `/api/admin/edu/offline-records/list${buildQs({ page, pageSize: PAGE_SIZE, search: debounced, type: typeFilter === 'all' ? '' : typeFilter })}`,
      ),
  })

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rows = data?.list ?? []

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/edu/learn">
            <ChevronLeft className="h-4 w-4" />
            {t('backToLearn')}
          </Link>
        </Button>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="h-9 pl-8"
          />
        </div>
        <div className="w-full max-w-[160px]">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className={selectClass} aria-label={t('type')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allTypes')}</SelectItem>
              {TYPES.map((k) => (
                <SelectItem key={k} value={k}>
                  {t(`type.${k}`)}
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
              <TableHead className="px-4 py-2.5">{t('colStudent')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colType')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colTitle')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colDuration')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colTime')}</TableHead>
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
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  <ListOrdered className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('empty')}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5 font-medium">
                    {r.userName ?? r.userId.slice(0, 8)}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-sky-500/10 text-sky-600 dark:text-sky-400',
                      )}
                    >
                      {TYPES.includes(r.type) ? t(`type.${r.type}`) : r.type}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    <div className="font-medium">{r.title}</div>
                    {r.description && (
                      <div className="max-w-xs break-words text-xs text-muted-foreground">
                        {r.description}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">{t('hours', { count: r.hours })}</TableCell>
                  <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">
                    {r.occurredAt}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{t('totalItems', { count: total })}</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
            {t('prevPage')}
          </Button>
          <span className="text-sm text-muted-foreground">
            {t('pageInfo', { page, totalPages })}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('nextPage')}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
