'use client'
import Link from 'next/link'
import { Edit, Trash2, Loader2, FileText, ListChecks } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Button } from '@ihui/ui'
import type { Paper } from './types'

interface Props {
  rows: Paper[]
  isLoading: boolean
  error: Error | null
  onEdit: (p: Paper) => void
  onDelete: (p: Paper) => void
  deletePending: boolean
}

const COLSPAN = 6

export function ExamTable({ rows, isLoading, error, onEdit, onDelete, deletePending }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-4 py-2.5">标题</TableHead>
            <TableHead className="px-4 py-2.5">总分</TableHead>
            <TableHead className="px-4 py-2.5">及格分</TableHead>
            <TableHead className="px-4 py-2.5">时长</TableHead>
            <TableHead className="px-4 py-2.5">状态</TableHead>
            <TableHead className="px-4 py-2.5 text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y">
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={COLSPAN} className="px-4 py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                加载中...
              </TableCell>
            </TableRow>
          ) : error ? (
            <TableRow>
              <TableCell colSpan={COLSPAN} className="px-4 py-10 text-center text-destructive">
                {error.message}
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={COLSPAN} className="px-4 py-10 text-center text-muted-foreground">
                <FileText className="mx-auto mb-2 h-8 w-8 opacity-40" />
                暂无试卷
              </TableCell>
            </TableRow>
          ) : (
            rows.map((p) => (
              <TableRow key={p.id} className="hover:bg-muted/30">
                <TableCell className="px-4 py-2.5">
                  <div className="font-medium">{p.title}</div>
                  {p.description ? (
                    <div className="max-w-xs break-words text-xs text-muted-foreground">
                      {p.description}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell className="px-4 py-2.5">{Number(p.totalScore)}</TableCell>
                <TableCell className="px-4 py-2.5">{Number(p.passScore)}</TableCell>
                <TableCell className="px-4 py-2.5">{p.duration}分钟</TableCell>
                <TableCell className="px-4 py-2.5">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                      p.isPublished
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    <span
                      className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        p.isPublished ? 'bg-emerald-500' : 'bg-muted-foreground',
                      )}
                    />
                    {p.isPublished ? '已发布' : '未发布'}
                  </span>
                </TableCell>
                <TableCell className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button asChild variant="ghost" size="sm" title="题目">
                      <Link href={`/admin/edu/exam/questions?paperId=${p.id}`}>
                        <ListChecks className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => onEdit(p)} title="编辑">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(p)}
                      title="删除"
                      className="text-destructive hover:text-destructive"
                      disabled={deletePending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
