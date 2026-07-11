'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, ChevronLeft, Wand2 } from 'lucide-react'
import { eduApi, selectClass } from '@/lib/edu'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Button,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui'

interface Paper {
  id: string
  title: string
  isPublished: boolean
}
interface Question {
  id: string
  type: string
  title: string
  score: string
  sortOrder: number
}

export default function EduExamPapersManualPage() {
  const qc = useQueryClient()
  const [paperId, setPaperId] = React.useState('')
  const [selected, setSelected] = React.useState<Set<string>>(new Set())

  const { data: papersData } = useQuery({
    queryKey: ['edu', 'exam', 'papers', 'all'],
    queryFn: () => eduApi<{ list: Paper[] }>(`/api/admin/exam/papers?page=1&pageSize=100`),
  })
  const papers = papersData?.list ?? []

  const { data: questions, isLoading } = useQuery({
    queryKey: ['edu', 'exam', 'questions', paperId],
    queryFn: () =>
      eduApi<{ list: Question[] }>(`/api/admin/exam/papers/${paperId}/questions`).then(
        (d) => d.list ?? [],
      ),
    enabled: !!paperId,
  })

  const assembleMut = useMutation({
    mutationFn: () => {
      const ids = Array.from(selected)
      return eduApi(`/api/admin/edu/exam/papers/${paperId}/assemble`, {
        method: 'POST',
        body: JSON.stringify({ questionIds: ids, mode: 'manual' }),
      })
    },
    onSuccess: () => {
      toast.success('手动组卷完成')
      qc.invalidateQueries({ queryKey: ['edu', 'exam', 'questions', paperId] })
      setSelected(new Set())
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function toggle(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">手动组卷</h1>
        <p className="mt-1 text-sm text-muted-foreground">从题库手动挑选题目组成试卷</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/edu/exam">
            <ChevronLeft className="h-4 w-4" />
            返回考试管理
          </Link>
        </Button>
        <div className="w-full max-w-sm">
          <Select
            value={paperId}
            onValueChange={(v) => {
              setPaperId(v)
              setSelected(new Set())
            }}
          >
            <SelectTrigger className={selectClass} aria-label="选择试卷">
              <SelectValue placeholder="选择试卷" />
            </SelectTrigger>
            <SelectContent>
              {papers.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={() => assembleMut.mutate()}
          size="sm"
          className="ml-auto"
          disabled={!paperId || selected.size === 0 || assembleMut.isPending}
        >
          {assembleMut.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Wand2 className="h-4 w-4" />
          )}
          组卷 ({selected.size})
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-4 py-2.5 w-10">选</TableHead>
              <TableHead className="px-4 py-2.5">题型</TableHead>
              <TableHead className="px-4 py-2.5">题干</TableHead>
              <TableHead className="px-4 py-2.5">分值</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {!paperId ? (
              <TableRow>
                <TableCell colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                  请先选择试卷
                </TableCell>
              </TableRow>
            ) : isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  加载中...
                </TableCell>
              </TableRow>
            ) : (questions ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                  暂无题目，请先在题库添加
                </TableCell>
              </TableRow>
            ) : (
              (questions ?? []).map((q) => (
                <TableRow
                  key={q.id}
                  className="hover:bg-muted/30 cursor-pointer"
                  onClick={() => toggle(q.id)}
                >
                  <TableCell className="px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={selected.has(q.id)}
                      onChange={() => toggle(q.id)}
                      className="h-4 w-4"
                    />
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{q.type}</span>
                  </TableCell>
                  <TableCell className="max-w-md break-words px-4 py-2.5">{q.title}</TableCell>
                  <TableCell className="px-4 py-2.5">{Number(q.score)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <div className="text-sm text-muted-foreground">
        提示：手动组卷即从该试卷已有题目中挑选要启用的题目。也可前往
        <Link href="/admin/edu/exam/questions" className="ml-1 text-primary hover:underline">
          题库管理
        </Link>
        添加新题目。
      </div>
    </div>
  )
}
