'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Loader2, ChevronLeft, ClipboardList, CheckCircle2, Circle } from 'lucide-react'
import { eduApi, buildQs } from '@/lib/edu'
import { cn } from '@/lib/utils'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  Button, Input,
} from '@ihui/ui'
import { useRouter, useSearchParams } from 'next/navigation'

interface AnswerRecord {
  id: string
  paperId: string
  score: string
  isPassed: boolean
  status: string
  startedAt: string
  submittedAt: string | null
  duration: number
}
interface PageData<T> { list: T[]; total: number }

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  pending: { label: '答题中', cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  submitted: { label: '已提交', cls: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  graded: { label: '已评分', cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
}

const PAGE_SIZE = 10

function CardContent2() {
  const router = useRouter()
  const sp = useSearchParams()
  const search = sp.get('search') ?? ''
  const [page, setPage] = React.useState(1)

  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'answer', 'card', 'records', page, search],
    queryFn: () => eduApi<PageData<AnswerRecord>>(`/api/exam/records${buildQs({ page, pageSize: PAGE_SIZE })}`),
  })

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const records = data?.list ?? []

  function onSearch(v: string) {
    const p = new URLSearchParams(sp.toString())
    if (v) p.set('search', v); else p.delete('search')
    setPage(1)
    router.replace(`/admin/edu/answer/card?${p.toString()}`)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">答题卡 / 交卷记录</h1>
          <p className="mt-1 text-sm text-muted-foreground">查看答题进度与交卷状态</p>
        </div>
        <Button asChild variant="ghost" size="sm"><Link href="/admin/edu"><ChevronLeft className="h-4 w-4" />返回</Link></Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border p-4">
          <div className="text-xs text-muted-foreground">总记录</div>
          <div className="mt-1 text-2xl font-semibold">{total}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-xs text-muted-foreground">已提交</div>
          <div className="mt-1 text-2xl font-semibold text-blue-600">{records.filter((r) => r.status !== 'pending').length}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-xs text-muted-foreground">已评分</div>
          <div className="mt-1 text-2xl font-semibold text-emerald-600">{records.filter((r) => r.status === 'graded').length}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-xs text-muted-foreground">通过</div>
          <div className="mt-1 text-2xl font-semibold text-emerald-600">{records.filter((r) => r.isPassed).length}</div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-4 py-2.5">记录</TableHead>
              <TableHead className="px-4 py-2.5">状态</TableHead>
              <TableHead className="px-4 py-2.5">分数</TableHead>
              <TableHead className="px-4 py-2.5">是否通过</TableHead>
              <TableHead className="px-4 py-2.5">开始时间</TableHead>
              <TableHead className="px-4 py-2.5">提交时间</TableHead>
              <TableHead className="px-4 py-2.5">用时</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="px-4 py-10 text-center text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />加载中...</TableCell></TableRow>
            ) : error ? (
              <TableRow><TableCell colSpan={7} className="px-4 py-10 text-center text-destructive">{(error as Error).message}</TableCell></TableRow>
            ) : records.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="px-4 py-10 text-center text-muted-foreground"><ClipboardList className="mx-auto mb-2 h-8 w-8 opacity-40" />暂无答题记录</TableCell></TableRow>
            ) : (
              records.map((r) => {
                const st = STATUS_MAP[r.status] ?? { label: r.status, cls: 'bg-muted text-muted-foreground' }
                const submitted = r.status !== 'pending'
                return (
                  <TableRow key={r.id} className="hover:bg-muted/30">
                    <TableCell className="px-4 py-2.5 font-mono text-xs">{r.id.slice(0, 8)}…</TableCell>
                    <TableCell className="px-4 py-2.5">
                      <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', st.cls)}>
                        {submitted ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
                        {st.label}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-2.5 font-medium">{Number(r.score)}</TableCell>
                    <TableCell className="px-4 py-2.5">{r.isPassed ? '通过' : '-'}</TableCell>
                    <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">{r.startedAt}</TableCell>
                    <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">{r.submittedAt ?? '-'}</TableCell>
                    <TableCell className="px-4 py-2.5 text-xs">{Math.floor(r.duration / 60)}分{r.duration % 60}秒</TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">共 {total} 条</span>
        <div className="flex items-center gap-2">
          <Input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="搜索" className="h-9 w-48" />
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>上一页</Button>
          <span className="text-sm text-muted-foreground">第 {page} / {totalPages} 页</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>下一页</Button>
        </div>
      </div>
    </div>
  )
}

export default function EduAnswerCardPage() {
  return (
    <React.Suspense fallback={<div className="flex items-center justify-center py-20 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />加载中...</div>}>
      <CardContent2 />
    </React.Suspense>
  )
}
