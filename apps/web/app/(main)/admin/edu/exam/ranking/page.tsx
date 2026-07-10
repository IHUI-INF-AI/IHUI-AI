'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Loader2, ChevronLeft, Trophy } from 'lucide-react'
import { eduApi, buildQs, selectClass } from '@/lib/edu'
import { cn } from '@/lib/utils'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  Button, Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from '@ihui/ui'

interface Paper { id: string; title: string; isPublished: boolean }
interface Record {
  id: string; paperId: string; userId: string
  score: string; isPassed: boolean; status: string
  submittedAt: string | null
}

const RANK_BADGE = ['bg-amber-500/15 text-amber-600 dark:text-amber-400', 'bg-slate-400/15 text-slate-600 dark:text-slate-300', 'bg-orange-700/15 text-orange-700 dark:text-orange-400']

export default function EduExamRankingPage() {
  const [paperId, setPaperId] = React.useState('')

  const { data: papersData } = useQuery({
    queryKey: ['edu', 'exam', 'papers', 'all'],
    queryFn: () => eduApi<{ list: Paper[] }>(`/api/admin/exam/papers?page=1&pageSize=100`),
  })
  const papers = papersData?.list ?? []

  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'exam', 'records', 'rank', paperId],
    queryFn: () => eduApi<{ list: Record[] }>(`/api/admin/exam/records${buildQs({ page: 1, pageSize: 100, paperId })}`).then((d) => d.list ?? []),
    enabled: !!paperId,
  })

  const ranked = React.useMemo(() => {
    const list = (data ?? []).filter((r) => r.status === 'submitted' || r.status === 'graded')
    return list.sort((a, b) => Number(b.score) - Number(a.score))
  }, [data])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">成绩排名</h1>
        <p className="mt-1 text-sm text-muted-foreground">按试卷查看成绩排名</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm"><Link href="/admin/edu/exam"><ChevronLeft className="h-4 w-4" />返回考试管理</Link></Button>
        <div className="w-full max-w-sm">
          <Select value={paperId} onValueChange={setPaperId}>
            <SelectTrigger className={selectClass} aria-label="选择试卷"><SelectValue placeholder="请选择试卷" /></SelectTrigger>
            <SelectContent>{papers.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-4 py-2.5">排名</TableHead>
              <TableHead className="px-4 py-2.5">用户</TableHead>
              <TableHead className="px-4 py-2.5">分数</TableHead>
              <TableHead className="px-4 py-2.5">是否通过</TableHead>
              <TableHead className="px-4 py-2.5">提交时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {!paperId ? (
              <TableRow><TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground"><Trophy className="mx-auto mb-2 h-8 w-8 opacity-40" />请先选择试卷</TableCell></TableRow>
            ) : isLoading ? (
              <TableRow><TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />加载中...</TableCell></TableRow>
            ) : error ? (
              <TableRow><TableCell colSpan={5} className="px-4 py-10 text-center text-destructive">{(error as Error).message}</TableCell></TableRow>
            ) : ranked.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground"><Trophy className="mx-auto mb-2 h-8 w-8 opacity-40" />暂无成绩</TableCell></TableRow>
            ) : (
              ranked.map((r, idx) => (
                <TableRow key={r.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5">
                    {idx < 3 ? (
                      <span className={cn('inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold', RANK_BADGE[idx])}>{idx + 1}</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">{idx + 1}</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 font-mono text-xs">{r.userId.slice(0, 8)}…</TableCell>
                  <TableCell className="px-4 py-2.5 font-semibold">{Number(r.score)}</TableCell>
                  <TableCell className="px-4 py-2.5">{r.isPassed ? '通过' : '未通过'}</TableCell>
                  <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">{r.submittedAt ?? '-'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
