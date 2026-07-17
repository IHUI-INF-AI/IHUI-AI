'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
import { Loader2, ChevronLeft, ChevronRight, Trophy, Medal, Award } from 'lucide-react'
import { eduApi, buildQs, selectClass, type PageData } from '@/lib/edu'
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
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  Card,
  CardContent,
} from '@ihui/ui'

interface Rank {
  id: string
  userId: string
  userName: string | null
  avatar: string | null
  totalHours: number
  lessonCount: number
  examCount: number
  score: number
  rank: number
}

const PAGE_SIZE = 20
const PERIODS = ['week', 'month', 'total']

export default function EduLearnRankingPage() {
  const t = useTranslations('admin.edu.learn.ranking')
  const [page, setPage] = React.useState(1)
  const [period, setPeriod] = React.useState('total')

  React.useEffect(() => {
    setPage(1)
  }, [period])

  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'learn', 'ranking', period, page],
    queryFn: () =>
      eduApi<PageData<Rank>>(
        `/api/learn/reports/member${buildQs({ page, pageSize: PAGE_SIZE, period })}`,
      ),
    retry: false,
  })

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rows = data?.list ?? []
  const noEndpoint = isNotFound(error)
  const top3 = rows.slice(0, 3)

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
        <div className="w-full max-w-[140px]">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className={selectClass} aria-label={t('period')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map((k) => (
                <SelectItem key={k} value={k}>
                  {t(`period.${k}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!noEndpoint && top3.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {top3.map((r, i) => {
            const icon = i === 0 ? Trophy : i === 1 ? Medal : Award
            const Icon = icon
            const cls =
              i === 0
                ? 'from-amber-400 to-yellow-500'
                : i === 1
                  ? 'from-slate-300 to-slate-400'
                  : 'from-orange-400 to-amber-600'
            return (
              <Card key={r.id}>
                <CardContent className="flex items-center gap-4 p-5">
                  <div
                    className={cn(
                      'flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br text-white',
                      cls,
                    )}
                  >
                    <Icon className="h-7 w-7" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="break-words font-semibold">
                        {r.userName ?? r.userId.slice(0, 8)}
                      </span>
                      <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        {t('rankLabel', { rank: i + 1 })}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {t('studyInfo', { hours: r.totalHours, lessons: r.lessonCount })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-4 py-2.5">{t('colRank')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colStudent')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colHours')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colLessons')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colExams')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colScore')}</TableHead>
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
            ) : noEndpoint ? (
              <TableRow>
                <TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  <Trophy className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('endpointNotConfigured')}
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  <Trophy className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('empty')}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r, i) => {
                const rank = r.rank ?? (page - 1) * PAGE_SIZE + i + 1
                const isTop3 = rank <= 3
                return (
                  <TableRow key={r.id} className="hover:bg-muted/30">
                    <TableCell className="px-4 py-2.5">
                      <span
                        className={cn(
                          'inline-flex h-7 w-7 items-center justify-center rounded-md text-sm font-bold',
                          isTop3 ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {rank}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-2.5 font-medium">
                      {r.userName ?? r.userId.slice(0, 8)}
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      {t('hours', { count: r.totalHours })}
                    </TableCell>
                    <TableCell className="px-4 py-2.5">{r.lessonCount}</TableCell>
                    <TableCell className="px-4 py-2.5">{r.examCount}</TableCell>
                    <TableCell className="px-4 py-2.5 font-semibold text-primary">
                      {r.score}
                    </TableCell>
                  </TableRow>
                )
              })
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
