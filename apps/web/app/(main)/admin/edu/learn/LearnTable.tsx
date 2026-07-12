'use client'

import Link from 'next/link'
import { Edit, Trash2, Loader2, BookOpen, ListOrdered } from 'lucide-react'
import { Button, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@ihui/ui'
import { cn } from '@/lib/utils'
import type { Lesson } from './types'

const COLSPAN = 6

interface Props {
  rows: Lesson[]
  isLoading: boolean
  error: Error | null
  onEdit: (l: Lesson) => void
  onDelete: (l: Lesson) => void
  deletePending: boolean
}

export function LearnTable({ rows, isLoading, error, onEdit, onDelete, deletePending }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-4 py-2.5">标题</TableHead>
            <TableHead className="px-4 py-2.5">分类</TableHead>
            <TableHead className="px-4 py-2.5">讲师</TableHead>
            <TableHead className="px-4 py-2.5">报名</TableHead>
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
                <BookOpen className="mx-auto mb-2 h-8 w-8 opacity-40" />
                暂无课程
              </TableCell>
            </TableRow>
          ) : (
            rows.map((l) => (
              <TableRow key={l.id} className="hover:bg-muted/30">
                <TableCell className="px-4 py-2.5">
                  <div className="font-medium">{l.title}</div>
                  {l.intro ? (
                    <div className="max-w-xs break-words text-xs text-muted-foreground">
                      {l.intro}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell className="px-4 py-2.5">
                  {l.categoryName ?? <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="px-4 py-2.5">{l.lecturerName ?? '-'}</TableCell>
                <TableCell className="px-4 py-2.5">{l.signupCount}</TableCell>
                <TableCell className="px-4 py-2.5">
                  <div className="flex flex-col gap-1">
                    <span
                      className={cn(
                        'inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                        l.isPublished
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          l.isPublished ? 'bg-emerald-500' : 'bg-muted-foreground',
                        )}
                      />
                      {l.isPublished ? '已上架' : '未上架'}
                    </span>
                    <span
                      className={cn(
                        'inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium',
                        l.isFree
                          ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
                      )}
                    >
                      {l.isFree ? '免费' : '付费'}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button asChild variant="ghost" size="sm" title="章节">
                      <Link href={`/admin/learn/chapters?lessonId=${l.id}`}>
                        <ListOrdered className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => onEdit(l)} title="编辑">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(l)}
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
