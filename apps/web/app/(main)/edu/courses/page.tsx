'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { BookOpen, Search, Loader2, ChevronLeft, ChevronRight, PlayCircle } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardContent, Input } from '@ihui/ui'
import { Alert } from '@/components/feedback'
import { cn } from '@/lib/utils'

interface Course {
  id: string
  title: string
  instructor: string
  cover?: string
  category?: string
  progress: number
  status: string
}
interface CoursesData {
  list: Course[]
  total: number
  page: number
  pageSize: number
}

const PAGE_SIZE = 12

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const STATUS_STYLE: Record<string, string> = {
  completed: 'bg-emerald-500/10 text-emerald-600',
  in_progress: 'bg-primary/10 text-primary',
  draft: 'bg-muted text-muted-foreground',
}

export default function EduCoursesPage() {
  const router = useRouter()
  const t = useTranslations('eduCoursesPage')
  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [page, setPage] = React.useState(1)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [search])

  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'courses', debounced, page],
    queryFn: () => {
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      })
      if (debounced) qs.set('search', debounced)
      return api<CoursesData>(`/api/edu/courses?${qs.toString()}`)
    },
  })

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const courses = data?.list ?? []

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <BookOpen className="h-7 w-7 text-primary" />
          {t('title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="h-9 pl-8"
          aria-label={t('searchAriaLabel')}
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      ) : error ? (
        <Alert variant="danger" description={(error as Error).message} />
      ) : courses.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16">
          <PlayCircle className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => (
            <Card
              key={c.id}
              className="flex cursor-pointer flex-col transition-colors hover:bg-accent"
              onClick={() => router.push(`/edu/courses/${c.id}`)}
            >
              <div className="relative flex h-32 items-center justify-center rounded-t-lg bg-gradient-to-br from-primary/15 to-primary/5">
                {c.cover ? (
                  <Image
                    fill
                    src={c.cover}
                    alt={c.title}
                    className="h-full w-full rounded-t-lg object-cover"
                  />
                ) : (
                  <BookOpen className="h-10 w-10 text-primary/40" />
                )}
              </div>
              <CardContent className="flex-1 space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-1 font-medium">{c.title}</p>
                  <span
                    className={cn(
                      'shrink-0 rounded-md px-2 py-0.5 text-xs',
                      STATUS_STYLE[c.status] ?? STATUS_STYLE.draft,
                    )}
                  >
                    {c.status === 'completed'
                      ? t('statusCompleted')
                      : c.status === 'in_progress'
                        ? t('statusInProgress')
                        : t('statusNotStarted')}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{c.instructor}</p>
                <div className="h-1.5 overflow-hidden rounded bg-muted">
                  <div
                    className="h-full rounded-md bg-primary transition-all"
                    style={{ width: `${c.progress}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">{t('progress', { n: c.progress })}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{t('total', { n: total })}</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
