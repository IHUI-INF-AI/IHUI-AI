'use client'

import * as React from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
import { Loader2, ChevronLeft, TrendingUp, BookOpen, Award } from 'lucide-react'
import { eduApi } from '@/lib/edu'
import { cn } from '@/lib/utils'
import {
  Card,
  CardContent,
  Button,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@ihui/ui'
import { Avatar } from '@/components/data/Avatar'

interface Detail {
  id: string
  nickname: string
  phone: string | null
  email: string | null
  level: number
  status: number
  createdAt: string
  signupCount: number
  learnHours: number
  examCount: number
  certCount: number
  lessons: { id: string; title: string; progress: number }[]
}

export default function EduStudentDetailPage() {
  const t = useTranslations('admin.edu.student.detail')
  const searchParams = useSearchParams()
  const id = searchParams.get('id') ?? ''

  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'student', 'detail', id],
    queryFn: () => eduApi<Detail>(`/api/admin/users/${id}`),
    enabled: !!id,
    retry: false,
  })

  if (!id) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/edu/student">
            <ChevronLeft className="h-4 w-4" />
            {t('backToList')}
          </Link>
        </Button>
        <p className="text-sm text-muted-foreground">{t('enterFromList')}</p>
      </div>
    )
  }

  if (isLoading)
    return (
      <div className="py-10 text-center text-muted-foreground">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
        {t('loading')}
      </div>
    )
  if (error || !data)
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/edu/student">
            <ChevronLeft className="h-4 w-4" />
            {t('backToList')}
          </Link>
        </Button>
        <p className="text-sm text-destructive">{(error as Error)?.message ?? t('loadFailed')}</p>
      </div>
    )

  const levelLabel = [1, 2, 3, 4].includes(data.level) ? t(`level.${data.level}`) : `L${data.level}`

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/edu/student">
            <ChevronLeft className="h-4 w-4" />
            {t('backToList')}
          </Link>
        </Button>
      </div>
      <div className="rounded-lg border p-6">
        <div className="flex items-center gap-4">
          <Avatar name={data.nickname} size="xl" />
          <div>
            <h1 className="text-2xl font-bold">{data.nickname}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {data.phone ?? t('noPhone')} · {data.email ?? t('noEmail')} ·{' '}
              <span
                className={cn(
                  'rounded-md px-2 py-0.5 text-xs',
                  data.status === 1
                    ? 'bg-emerald-500/10 text-emerald-600'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {data.status === 1 ? t('statusActive') : t('statusDisabled')}
              </span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('levelLabel', { level: levelLabel })} ·{' '}
              {t('registeredAt', {
                date: new Date(data.createdAt).toLocaleDateString(),
              })}
            </p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <BookOpen className="h-8 w-8 text-sky-500" />
            <div>
              <div className="text-xs text-muted-foreground">{t('signupCourses')}</div>
              <div className="text-xl font-semibold">{data.signupCount}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <TrendingUp className="h-8 w-8 text-emerald-500" />
            <div>
              <div className="text-xs text-muted-foreground">{t('learnHours')}</div>
              <div className="text-xl font-semibold">{data.learnHours}h</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Award className="h-8 w-8 text-amber-500" />
            <div>
              <div className="text-xs text-muted-foreground">{t('examCount')}</div>
              <div className="text-xl font-semibold">{data.examCount}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Award className="h-8 w-8 text-purple-500" />
            <div>
              <div className="text-xs text-muted-foreground">{t('certCount')}</div>
              <div className="text-xl font-semibold">{data.certCount}</div>
            </div>
          </CardContent>
        </Card>
      </div>
      <div>
        <h2 className="mb-3 text-lg font-semibold">{t('lessonProgress')}</h2>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="px-4 py-2.5">{t('colCourse')}</TableHead>
                <TableHead className="px-4 py-2.5">{t('colProgress')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y">
              {data.lessons?.length ? (
                data.lessons.map((l) => (
                  <TableRow key={l.id} className="hover:bg-muted/30">
                    <TableCell className="px-4 py-2.5 font-medium">{l.title}</TableCell>
                    <TableCell className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-32 overflow-hidden rounded-2xl bg-muted">
                          <div
                            className={cn(
                              'h-full rounded-md',
                              l.progress >= 100
                                ? 'bg-emerald-500'
                                : l.progress >= 50
                                  ? 'bg-sky-500'
                                  : 'bg-amber-500',
                            )}
                            style={{ width: `${l.progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">{l.progress}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={2} className="px-4 py-10 text-center text-muted-foreground">
                    {t('noLessons')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
