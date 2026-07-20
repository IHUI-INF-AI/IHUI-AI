'use client'

import {
  Loader2,
  Plus,
  Edit,
  Trash2,
  Search,
  FileText,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useLocale } from 'next-intl'

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
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/feedback'

import { PAGE_SIZE, type Article, type ArticleStatus } from './types'

export interface ArticleTableProps {
  search: string
  setSearch: (v: string) => void
  status: 'all' | ArticleStatus
  setStatus: (v: 'all' | ArticleStatus) => void
  page: number
  setPage: (v: number | ((p: number) => number)) => void
  total: number
  articles: Article[]
  isLoading: boolean
  error: Error | null
  togglePending: boolean
  deletePending: boolean
  onToggle: (a: Article) => void
  onDelete: (a: Article) => void
  onEdit: (a: Article) => void
  onCreate: () => void
}

export function ArticleTable(props: ArticleTableProps) {
  const locale = useLocale()
  const {
    search,
    setSearch,
    status,
    setStatus,
    page,
    setPage,
    total,
    articles,
    isLoading,
    error,
    togglePending,
    deletePending,
    onToggle,
    onDelete,
    onEdit,
    onCreate,
  } = props

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索文章标题"
            className="h-9 pl-8"
          />
        </div>
        <div className="flex gap-1 rounded-lg border bg-muted/30 p-1">
          {(['all', 'draft', 'published'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                status === s
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {s === 'all' ? '全部' : s === 'draft' ? '草稿' : '已发布'}
            </button>
          ))}
        </div>
        <Button onClick={onCreate} size="sm" className="ml-auto">
          <Plus className="h-4 w-4" />
          新建文章
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-4 py-2.5">标题</TableHead>
              <TableHead className="px-4 py-2.5">作者</TableHead>
              <TableHead className="px-4 py-2.5">分类</TableHead>
              <TableHead className="px-4 py-2.5">浏览</TableHead>
              <TableHead className="px-4 py-2.5">状态</TableHead>
              <TableHead className="px-4 py-2.5">创建时间</TableHead>
              <TableHead className="px-4 py-2.5 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  加载中...
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={7} className="px-4 py-10 text-center text-destructive">
                  {error.message}
                </TableCell>
              </TableRow>
            ) : articles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  <FileText className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  暂无文章
                </TableCell>
              </TableRow>
            ) : (
              articles.map((a) => {
                const published = a.status === 'published'
                return (
                  <TableRow key={a.id} className="hover:bg-muted/30">
                    <TableCell className="px-4 py-2.5 font-medium">{a.title}</TableCell>
                    <TableCell className="px-4 py-2.5 text-muted-foreground">
                      {a.authorName ?? '—'}
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-muted-foreground">
                      {a.categoryName ?? '—'}
                    </TableCell>
                    <TableCell className="px-4 py-2.5">{a.viewCount}</TableCell>
                    <TableCell className="px-4 py-2.5">
                      <button
                        onClick={() => onToggle(a)}
                        disabled={togglePending}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium transition-colors',
                          published
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 hover:bg-emerald-500/20'
                            : 'bg-muted text-muted-foreground hover:bg-muted/70',
                        )}
                      >
                        <span
                          className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            published ? 'bg-emerald-500' : 'bg-muted-foreground',
                          )}
                        />
                        {published ? '已发布' : '草稿'}
                      </button>
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">
                      {dateFmt.format(new Date(a.createdAt))}
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Tooltip content="编辑">
                          <Button variant="ghost" size="sm" onClick={() => onEdit(a)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Tooltip>
                        <Tooltip content="删除">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDelete(a)}
                            className="text-destructive hover:text-destructive"
                            disabled={deletePending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </Tooltip>
                      </div>
                    </TableCell>
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
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  )
}
