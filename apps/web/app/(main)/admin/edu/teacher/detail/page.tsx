'use client'

import * as React from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Loader2, ChevronLeft, BookOpen, Users, Star } from 'lucide-react'
import { eduApi } from '@/lib/edu'
import { Card, CardContent, Button, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@ihui/ui'

interface TeacherDetail {
  id: string; nickname: string; phone: string | null; title: string
  intro: string | null; courseCount: number; studentCount: number
  rating: number; status: number; createdAt: string
  courses: { id: string; title: string; signupCount: number; rating: number }[]
}

export default function EduTeacherDetailPage() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id') ?? ''

  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'teacher', 'detail', id],
    queryFn: () => eduApi<TeacherDetail>(`/api/admin/users/${id}`),
    enabled: !!id,
    retry: false,
  })

  if (!id) return <div className="space-y-4"><Button asChild variant="ghost" size="sm"><Link href="/admin/edu/teacher"><ChevronLeft className="h-4 w-4" />返回讲师列表</Link></Button><p className="text-sm text-muted-foreground">请从讲师列表进入详情</p></div>
  if (isLoading) return <div className="py-10 text-center text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />加载中...</div>
  if (error || !data) return <div className="space-y-4"><Button asChild variant="ghost" size="sm"><Link href="/admin/edu/teacher"><ChevronLeft className="h-4 w-4" />返回讲师列表</Link></Button><p className="text-sm text-destructive">{(error as Error)?.message ?? '加载失败'}</p></div>

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm"><Link href="/admin/edu/teacher"><ChevronLeft className="h-4 w-4" />返回讲师列表</Link></Button>
      <div className="rounded-lg border p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary">{data.nickname.charAt(0).toUpperCase()}</div>
          <div>
            <h1 className="text-2xl font-bold">{data.nickname}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{data.title} · {data.phone ?? '无联系方式'}</p>
            {data.intro && <p className="mt-1 text-sm text-muted-foreground">{data.intro}</p>}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="flex items-center gap-3 p-4"><BookOpen className="h-8 w-8 text-sky-500" /><div><div className="text-xs text-muted-foreground">课程数</div><div className="text-xl font-semibold">{data.courseCount}</div></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><Users className="h-8 w-8 text-emerald-500" /><div><div className="text-xs text-muted-foreground">学生数</div><div className="text-xl font-semibold">{data.studentCount}</div></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><Star className="h-8 w-8 text-amber-500" /><div><div className="text-xs text-muted-foreground">评分</div><div className="text-xl font-semibold">{data.rating.toFixed(1)}</div></div></CardContent></Card>
      </div>
      <div>
        <h2 className="mb-3 text-lg font-semibold">授课列表</h2>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader className="bg-muted/50"><TableRow><TableHead className="px-4 py-2.5">课程</TableHead><TableHead className="px-4 py-2.5">报名数</TableHead><TableHead className="px-4 py-2.5">评分</TableHead></TableRow></TableHeader>
            <TableBody className="divide-y">
              {data.courses?.length ? data.courses.map((c) => (
                <TableRow key={c.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5 font-medium">{c.title}</TableCell>
                  <TableCell className="px-4 py-2.5">{c.signupCount}</TableCell>
                  <TableCell className="px-4 py-2.5 text-amber-600 dark:text-amber-400">★ {c.rating.toFixed(1)}</TableCell>
                </TableRow>
              )) : <TableRow><TableCell colSpan={3} className="px-4 py-10 text-center text-muted-foreground">暂无授课记录</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
