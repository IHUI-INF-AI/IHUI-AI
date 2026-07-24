'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Loader2, ChevronLeft, ChevronRight, TrendingUp, Search } from 'lucide-react'
import { eduApi, buildQs, type PageData } from '@/lib/edu'
import { isNotFound } from '@/lib/api-error'
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
  Card,
  CardContent,
} from '@ihui/ui-react'

interface Progress {
  id: string
  userId: string
  userName: string | null
  lessonTitle: string | null
  progress: number
  lastStudyAt: string
  totalHours: number
}
const PAGE_SIZE = 10

export default function EduLearnProgressPage() {
  const t = useTranslations('admin.edu.learn.progress')
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [search])

  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'learn', 'progress', debounced, page],
    queryFn: () =>
      eduApi<PageData<Progress>>(
        `/api/learn/reports/lesson${buildQs({ page, pageSize: PAGE_SIZE, search: debounced })}`,
      ),
    retry: false,
  })

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rows = data?.list ?? []
  const avgProgress =
    rows.length > 0 ? Math.round(rows.reduce((a, r) => a + r.progress, 0) / rows.length) : 0
  const completed = rows.filter((r) => r.progress >= 100).length
  const noEndpoint = isNotFound(error)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <div className="text-sm text-muted-foreground">{t('statCurrentPageStudents')}</div>
            <div className="mt-1 text-2xl font-semibold">{rows.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-sm text-muted-foreground">{t('statAvgProgress')}</div>
            <div className="mt-1 text-2xl font-semibold">{avgProgress}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-sm text-muted-foreground">{t('statCompleted')}</div>
            <div className="mt-1 text-2xl font-semibold">{completed}</div>
          </CardContent>
        </Card>
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
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-4 py-2.5">{t('colStudent')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colLesson')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colProgress')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colHours')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colLastStudy')}</TableHead>
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
            ) : noEndpoint ? (
              <TableRow>
                <TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  <TrendingUp className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('noEndpoint')}
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  <TrendingUp className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('noProgress')}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5 font-medium">
                    {r.userName ?? r.userId.slice(0, 8)}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">{r.lessonTitle ?? '-'}</TableCell>
                  <TableCell className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-2xl bg-muted">
                        <div
                          className={cn(
                            'h-full rounded-md',
                            r.progress >= 100
                              ? 'bg-emerald-500'
                              : r.progress >= 50
                                ? 'bg-sky-500'
                                : 'bg-amber-500',
                          )}
                          style={{ width: `${r.progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">{r.progress}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    {t('hours', { hours: r.totalHours })}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">
                    {r.lastStudyAt}
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
