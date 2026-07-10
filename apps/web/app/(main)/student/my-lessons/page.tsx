'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { BookOpen, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button, Card, CardContent } from '@ihui/ui'

interface MyLesson {
  id: string
  lessonId: string
  title: string
  coverImage: string | null
  progress: number
  status: number
}

interface LessonsData {
  list: MyLesson[]
  total: number
  page: number
  pageSize: number
}

const PAGE_SIZE = 20

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const STATUS_STYLE: Record<number, string> = {
  1: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  2: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  3: 'bg-muted text-muted-foreground',
}

export default function MyLessonsPage() {
  const t = useTranslations('student')
  const [page, setPage] = React.useState(1)

  const { data, isLoading, error } = useQuery({
    queryKey: ['student', 'my-lessons', page],
    queryFn: () =>
      api<LessonsData>(
        `/api/edu/my-lessons?page=${page}&pageSize=${PAGE_SIZE}`,
      ),
  })

  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
          <BookOpen className="h-7 w-7 text-primary" />
          {t('myLessonsTitle')}
        </h1>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16">
          <BookOpen className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((item) => {
              const statusKey =
                item.status === 2
                  ? 'statusCompleted'
                  : item.status === 3
                    ? 'statusRefunded'
                    : 'statusInProgress'
              const progress = Math.max(0, Math.min(100, item.progress ?? 0))
              return (
                <Link key={item.id} href={`/learn/${item.lessonId}`}>
                  <Card className="overflow-hidden transition-colors hover:border-primary/40">
                    <div className="aspect-video w-full overflow-hidden bg-muted">
                      {item.coverImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.coverImage}
                          alt={item.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <BookOpen className="h-8 w-8 text-muted-foreground/40" />
                        </div>
                      )}
                    </div>
                    <CardContent className="space-y-3 p-4">
                      <h3 className="line-clamp-1 font-medium">{item.title}</h3>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{t('progress', { value: progress })}</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                          STATUS_STYLE[item.status] ?? STATUS_STYLE[1],
                        )}
                      >
                        {t(statusKey)}
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
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
          )}
        </>
      )}
    </div>
  )
}
