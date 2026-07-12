'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import {
  RotateCcw,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Search,
} from 'lucide-react'
import { eduApi, buildQs, type PageData } from '@/lib/edu'
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
} from '@ihui/ui'

interface Course {
  id: string
  title: string
  intro: string | null
  categoryName: string | null
  lecturerName: string | null
  price: string
  isFree: boolean
  deletedAt: string | null
}

const PAGE_SIZE = 10

export default function EduCourseTrashPage() {
  const t = useTranslations('admin.edu.course.trash')
  const qc = useQueryClient()
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
    queryKey: ['edu', 'course', 'trash', debounced, page],
    queryFn: () =>
      eduApi<PageData<Course>>(
        `/api/admin/courses${buildQs({ page, pageSize: PAGE_SIZE, status: 'trash', search: debounced })}`,
      ),
  })

  const restoreMut = useMutation({
    mutationFn: (id: string) => eduApi(`/api/admin/courses/${id}/restore`, { method: 'POST' }),
    onSuccess: () => {
      toast.success(t('restoreSuccess'))
      qc.invalidateQueries({ queryKey: ['edu', 'course', 'trash'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const destroyMut = useMutation({
    mutationFn: (id: string) => eduApi(`/api/admin/courses/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('destroySuccess'))
      qc.invalidateQueries({ queryKey: ['edu', 'course', 'trash'] })
    },
    onError: (e: Error) => toast.error(e.message),
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
          <Link href="/admin/edu/course">
            <ChevronLeft className="h-4 w-4" />
            {t('backToCourse')}
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
              <TableHead className="px-4 py-2.5">{t('colTitle')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colCategory')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colLecturer')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colPrice')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colDeletedAt')}</TableHead>
              <TableHead className="px-4 py-2.5 text-right">{t('colAction')}</TableHead>
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
                  <BookOpen className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('empty')}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((c) => (
                <TableRow key={c.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5">
                    <div className="font-medium">{c.title}</div>
                    {c.intro && (
                      <div className="max-w-xs break-words text-xs text-muted-foreground">
                        {c.intro}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">{c.categoryName ?? '-'}</TableCell>
                  <TableCell className="px-4 py-2.5">{c.lecturerName ?? '-'}</TableCell>
                  <TableCell className="px-4 py-2.5">
                    <span
                      className={cn(
                        'text-xs font-medium',
                        c.isFree
                          ? 'text-sky-600 dark:text-sky-400'
                          : 'text-amber-600 dark:text-amber-400',
                      )}
                    >
                      {c.isFree ? t('free') : c.price}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">
                    {c.deletedAt ? new Date(c.deletedAt).toLocaleDateString() : '-'}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => restoreMut.mutate(c.id)}
                        title={t('restore')}
                        disabled={restoreMut.isPending}
                      >
                        <RotateCcw className="h-4 w-4" />
                        {t('restore')}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (window.confirm(t('confirmDestroy'))) destroyMut.mutate(c.id)
                        }}
                        title={t('destroy')}
                        className="text-destructive hover:text-destructive"
                        disabled={destroyMut.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                        {t('destroy')}
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
