'use client'

import * as React from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
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

const LEVEL_MAP: Record<number, string> = { 1: '初级', 2: '中级', 3: '高级', 4: '专家' }

export default function EduStudentDetailPage() {
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
            返回学员列表
          </Link>
        </Button>
        <p className="text-sm text-muted-foreground">请从学员列表进入详情</p>
      </div>
    )
  }

  if (isLoading)
    return (
      <div className="py-10 text-center text-muted-foreground">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
        加载中...
      </div>
    )
  if (error || !data)
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/edu/student">
            <ChevronLeft className="h-4 w-4" />
            返回学员列表
          </Link>
        </Button>
        <p className="text-sm text-destructive">{(error as Error)?.message ?? '加载失败'}</p>
      </div>
    )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/edu/student">
            <ChevronLeft className="h-4 w-4" />
            返回学员列表
          </Link>
        </Button>
      </div>
      <div className="rounded-lg border p-6">
        <div className="flex items-center gap-4">
          <Avatar name={data.nickname} size="xl" />
          <div>
            <h1 className="text-2xl font-bold">{data.nickname}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {data.phone ?? '无手机'} · {data.email ?? '无邮箱'} ·{' '}
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs',
                  data.status === 1
                    ? 'bg-emerald-500/10 text-emerald-600'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {data.status === 1 ? '正常' : '禁用'}
              </span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              等级：{LEVEL_MAP[data.level] ?? `L${data.level}`} · 注册：
              {new Date(data.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <BookOpen className="h-8 w-8 text-sky-500" />
            <div>
              <div className="text-xs text-muted-foreground">报名课程</div>
              <div className="text-xl font-semibold">{data.signupCount}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <TrendingUp className="h-8 w-8 text-emerald-500" />
            <div>
              <div className="text-xs text-muted-foreground">学习时长</div>
              <div className="text-xl font-semibold">{data.learnHours}h</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Award className="h-8 w-8 text-amber-500" />
            <div>
              <div className="text-xs text-muted-foreground">考试次数</div>
              <div className="text-xl font-semibold">{data.examCount}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Award className="h-8 w-8 text-purple-500" />
            <div>
              <div className="text-xs text-muted-foreground">获得证书</div>
              <div className="text-xl font-semibold">{data.certCount}</div>
            </div>
          </CardContent>
        </Card>
      </div>
      <div>
        <h2 className="mb-3 text-lg font-semibold">学习课程进度</h2>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="px-4 py-2.5">课程</TableHead>
                <TableHead className="px-4 py-2.5">进度</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y">
              {data.lessons?.length ? (
                data.lessons.map((l) => (
                  <TableRow key={l.id} className="hover:bg-muted/30">
                    <TableCell className="px-4 py-2.5 font-medium">{l.title}</TableCell>
                    <TableCell className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              'h-full rounded-full',
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
                    暂无学习记录
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
