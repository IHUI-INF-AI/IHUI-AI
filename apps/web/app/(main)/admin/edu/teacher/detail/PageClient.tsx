'use client'

import * as React from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Loader2, ChevronLeft, BookOpen, Users, Star } from 'lucide-react'
import { eduApi } from '@/lib/edu'
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
} from '@ihui/ui-react'
import { Avatar } from '@/components/data/Avatar'

interface TeacherDetail {
  id: string
  nickname: string
  phone: string | null
  title: string
  intro: string | null
  courseCount: number
  studentCount: number
  rating: number
  status: number
  createdAt: string
  courses: { id: string; title: string; signupCount: number; rating: number }[]
}

export default function EduTeacherDetailPage() {
  const t = useTranslations('admin.edu.teacher.detail')
  const searchParams = useSearchParams()
  const id = searchParams.get('id') ?? ''

  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'teacher', 'detail', id],
    queryFn: () => eduApi<TeacherDetail>(`/api/admin/users/${id}`),
    enabled: !!id,
    retry: false,
  })

  if (!id)
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/edu/teacher">
            <ChevronLeft className="h-4 w-4" />
            {t('backToTeacherList')}
          </Link>
        </Button>
        <p className="text-sm text-muted-foreground">{t('enterFromList')}</p>
      </div>
    )
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
          <Link href="/admin/edu/teacher">
            <ChevronLeft className="h-4 w-4" />
            {t('backToTeacherList')}
          </Link>
        </Button>
        <p className="text-sm text-destructive">{(error as Error)?.message ?? t('loadFailed')}</p>
      </div>
    )

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link href="/admin/edu/teacher">
          <ChevronLeft className="h-4 w-4" />
          {t('backToTeacherList')}
        </Link>
      </Button>
      <div className="rounded-lg border p-6">
        <div className="flex items-center gap-4">
          <Avatar name={data.nickname} size="xl" />
          <div>
            <h1 className="text-2xl font-bold">{data.nickname}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {data.title} · {data.phone ?? t('noContact')}
            </p>
            {data.intro && <p className="mt-1 text-sm text-muted-foreground">{data.intro}</p>}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <BookOpen className="h-8 w-8 text-sky-500" />
            <div>
              <div className="text-xs text-muted-foreground">{t('courseCount')}</div>
              <div className="text-xl font-semibold">{data.courseCount}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Users className="h-8 w-8 text-emerald-500" />
            <div>
              <div className="text-xs text-muted-foreground">{t('studentCount')}</div>
              <div className="text-xl font-semibold">{data.studentCount}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Star className="h-8 w-8 text-amber-500" />
            <div>
              <div className="text-xs text-muted-foreground">{t('rating')}</div>
              <div className="text-xl font-semibold">{data.rating.toFixed(1)}</div>
            </div>
          </CardContent>
        </Card>
      </div>
      <div>
        <h2 className="mb-3 text-lg font-semibold">{t('courseList')}</h2>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="px-4 py-2.5">{t('colCourse')}</TableHead>
                <TableHead className="px-4 py-2.5">{t('colSignup')}</TableHead>
                <TableHead className="px-4 py-2.5">{t('rating')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y">
              {data.courses?.length ? (
                data.courses.map((c) => (
                  <TableRow key={c.id} className="hover:bg-muted/30">
                    <TableCell className="px-4 py-2.5 font-medium">{c.title}</TableCell>
                    <TableCell className="px-4 py-2.5">{c.signupCount}</TableCell>
                    <TableCell className="px-4 py-2.5 text-amber-600 dark:text-amber-400">
                      <span className="inline-flex items-center gap-1">
                        {c.rating.toFixed(1)}
                        <Star className="h-3 w-3 fill-current" />
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="px-4 py-10 text-center text-muted-foreground">
                    {t('noCourses')}
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
