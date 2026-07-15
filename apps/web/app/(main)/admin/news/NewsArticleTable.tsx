'use client'

import {
  Search,
  Download,
  Plus,
  Edit,
  Trash2,
  Loader2,
  Newspaper,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useTranslations } from 'next-intl'

import { exportToExcel } from '@/lib/export-utils'
import { HasPermi } from '@/components/auth/HasPermi'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Button,
  Input,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui'
import { cn } from '@/lib/utils'

import { selectClass } from './types'
import type { useNewsArticles } from './useNewsArticles'
import { formatDate } from '@/lib/date-utils'

type Props = ReturnType<typeof useNewsArticles>

export function NewsArticleTable(props: Props) {
  const t = useTranslations('admin.news')
  const {
    search,
    setSearch,
    categoryId,
    setCategoryId,
    status,
    setStatus,
    page,
    setPage,
    total,
    totalPages,
    articles,
    isLoading,
    error,
    categories,
    openCreate,
    openEdit,
    handleDelete,
    deleteMut,
  } = props

  function handleExport() {
    const list = (articles as unknown as Record<string, unknown>[]).map((r) => ({
      ...r,
      published: (r as { isPublished?: boolean }).isPublished ? '已发布' : '未发布',
    }))
    exportToExcel(
      '新闻文章',
      [
        { key: 'id', title: 'ID' },
        { key: 'title', title: '标题' },
        { key: 'categoryName', title: '分类' },
        { key: 'authorName', title: '作者' },
        { key: 'viewCount', title: '浏览量' },
        { key: 'published', title: '状态' },
        { key: 'createdAt', title: '创建时间' },
      ],
      list,
    )
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="h-9 pl-8"
            aria-label={t('search')}
          />
        </div>
        <div className="w-full max-w-[180px]">
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className={selectClass} aria-label={t('allCategories')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allCategories')}</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full max-w-[160px]">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className={selectClass} aria-label={t('allStatus')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allStatus')}</SelectItem>
              <SelectItem value="1">{t('published')}</SelectItem>
              <SelectItem value="0">{t('unpublished')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <HasPermi code="system:news:export">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4" />
            导出
          </Button>
        </HasPermi>
        <HasPermi code="system:news:add">
          <Button onClick={openCreate} size="sm" className="ml-auto">
            <Plus className="h-4 w-4" />
            {t('create')}
          </Button>
        </HasPermi>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-4 py-2.5">{t('colTitle')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colCategory')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colAuthor')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colViewCount')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colStatus')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colCreatedAt')}</TableHead>
              <TableHead className="px-4 py-2.5 text-right">{t('colActions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  {t('loading')}
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={7} className="px-4 py-10 text-center text-destructive">
                  {(error as Error).message}
                </TableCell>
              </TableRow>
            ) : articles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  <Newspaper className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('noData')}
                </TableCell>
              </TableRow>
            ) : (
              articles.map((article) => {
                const published = article.isPublished
                return (
                  <TableRow key={article.id} className="hover:bg-muted/30">
                    <TableCell className="px-4 py-2.5">
                      <div className="flex items-center gap-2 font-medium">
                        {article.isPinned ? (
                          <span className="inline-flex items-center rounded-full bg-amber-500/10 px-1.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-500">
                            {t('pinned')}
                          </span>
                        ) : null}
                        <span className="max-w-xs break-words">{article.title}</span>
                      </div>
                      {article.summary ? (
                        <div className="max-w-xs break-words text-xs text-muted-foreground">
                          {article.summary}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      {article.categoryName ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      {article.authorName ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="px-4 py-2.5">{article.viewCount}</TableCell>
                    <TableCell className="px-4 py-2.5">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                          published
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        <span
                          className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            published ? 'bg-emerald-500' : 'bg-muted-foreground',
                          )}
                        />
                        {published ? t('published') : t('unpublished')}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-muted-foreground">
                      {formatDate(article.createdAt)}
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <HasPermi code="system:news:edit">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(article)}
                            title={t('edit')}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </HasPermi>
                        <HasPermi code="system:news:remove">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(article)}
                            title={t('delete')}
                            className="text-destructive hover:text-destructive"
                            disabled={deleteMut.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </HasPermi>
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
        <span className="text-sm text-muted-foreground">{t('total', { total })}</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
            {t('prev')}
          </Button>
          <span className="text-sm text-muted-foreground">
            {t('page', { page, total: totalPages })}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('next')}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  )
}
