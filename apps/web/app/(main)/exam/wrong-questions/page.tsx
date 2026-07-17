'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { toast } from 'sonner'
import {
  FileText,
  ListChecks,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import {
  Button,
  Card,
  CardContent,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@ihui/ui'
import { Badge } from '@/components/data/Badge'

interface WrongQuestion {
  id: string
  questionId: string
  paperId: string
  paperTitle: string | null
  questionTitle: string | null
  wrongCount: number
  isMastered: boolean
  createdAt: string
}

interface WrongQuestionListData {
  list: WrongQuestion[]
  total: number
  page: number
  pageSize: number
}

interface WrongQuestionStats {
  total: number
  unresolved: number
  resolved: number
}

const PAGE_SIZE = 10

async function api<T>(url: string, opts?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, opts)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function WrongQuestionsPage() {
  const t = useTranslations('exam.wrongQuestions')
  const locale = useLocale()
  const qc = useQueryClient()

  const [examId, setExamId] = React.useState('')
  const [filter, setFilter] = React.useState<'all' | 'unresolved' | 'resolved'>('all')
  const [page, setPage] = React.useState(1)

  const dateFmt = React.useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [locale],
  )

  const qs = React.useMemo(() => {
    const q = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
    if (examId.trim()) q.set('examId', examId.trim())
    if (filter === 'unresolved') q.set('isResolved', 'false')
    if (filter === 'resolved') q.set('isResolved', 'true')
    return q.toString()
  }, [examId, filter, page])

  const { data: statsEnvelope } = useQuery({
    queryKey: ['exam', 'wrong-questions', 'stats'],
    queryFn: () => api<{ stats: WrongQuestionStats }>('/api/exam/wrong-questions/stats'),
  })
  const stats = statsEnvelope?.stats

  const { data, isLoading, error } = useQuery({
    queryKey: ['exam', 'wrong-questions', 'list', examId, filter, page],
    queryFn: () => api<WrongQuestionListData>(`/api/exam/wrong-questions?${qs}`),
  })

  const resolveMut = useMutation({
    mutationFn: (questionId: string) =>
      api(`/api/exam/wrong-questions/${questionId}/resolve`, { method: 'PUT' }),
    onSuccess: () => {
      toast.success(t('markSuccess'))
      qc.invalidateQueries({ queryKey: ['exam', 'wrong-questions'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const cards = [
    {
      label: t('statsTotal'),
      value: stats?.total ?? 0,
      Icon: ListChecks,
      tone: 'text-muted-foreground',
    },
    {
      label: t('statsUnresolved'),
      value: stats?.unresolved ?? 0,
      Icon: AlertCircle,
      tone: 'text-amber-500',
    },
    {
      label: t('statsResolved'),
      value: stats?.resolved ?? 0,
      Icon: CheckCircle2,
      tone: 'text-emerald-500',
    },
  ]

  function handleFilterChange(v: string) {
    setFilter(v as 'all' | 'unresolved' | 'resolved')
    setPage(1)
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
          <FileText className="h-7 w-7 text-primary" />
          {t('title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map(({ label, value, Icon, tone }) => (
          <Card key={label} className="transition-colors hover:bg-accent">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-2xl font-bold">{value}</p>
              </div>
              <Icon className={`h-8 w-8 ${tone}`} />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={examId}
          onChange={(e) => {
            setExamId(e.target.value)
            setPage(1)
          }}
          placeholder={t('examIdPlaceholder')}
          className="h-9 w-64"
        />
        <Select value={filter} onValueChange={handleFilterChange}>
          <SelectTrigger className="h-9 w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filterAll')}</SelectItem>
            <SelectItem value="unresolved">{t('filterUnresolved')}</SelectItem>
            <SelectItem value="resolved">{t('filterResolved')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[240px]">{t('colQuestion')}</TableHead>
              <TableHead>{t('colSource')}</TableHead>
              <TableHead>{t('colTime')}</TableHead>
              <TableHead>{t('colStatus')}</TableHead>
              <TableHead className="text-right">{t('colActions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  {t('loading')}
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-destructive">
                  {(error as Error).message}
                </TableCell>
              </TableRow>
            ) : list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  <FileText className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('empty')}
                </TableCell>
              </TableRow>
            ) : (
              list.map((wq) => (
                <TableRow key={wq.id}>
                  <TableCell className="max-w-[280px] truncate">
                    {wq.questionTitle || wq.questionId.slice(0, 8)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{wq.paperTitle ?? '-'}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {dateFmt.format(new Date(wq.createdAt))}
                  </TableCell>
                  <TableCell>
                    {wq.isMastered ? (
                      <Badge variant="success">{t('filterResolved')}</Badge>
                    ) : (
                      <Badge variant="warning">{t('filterUnresolved')}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {!wq.isMastered && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={resolveMut.isPending}
                        onClick={() => resolveMut.mutate(wq.questionId)}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {t('markAsResolved')}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {t('total', { total })} · {t('pageInfo', { page, totalPages })}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
              {t('prev')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              {t('next')}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
