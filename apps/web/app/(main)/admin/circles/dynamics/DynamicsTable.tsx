'use client'

import { useTranslations } from 'next-intl'
import { MessageSquare, Trash2, Loader2, FileText, CheckCircle2, XCircle } from 'lucide-react'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Button } from '@ihui/ui'
import { Avatar } from '@/components/data/Avatar'
import { cn } from '@/lib/utils'
import type { CirclePost, CirclePostStatus } from './types'

const COLSPAN = 7

interface Props {
  list: CirclePost[]
  isLoading: boolean
  deletePending: boolean
  auditPending: boolean
  onComments: (item: CirclePost) => void
  onDelete: (item: CirclePost) => void
  onAudit: (item: CirclePost, status: Exclude<CirclePostStatus, 'deleted'>) => void
}

const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

const STATUS_STYLE: Record<CirclePostStatus, string> = {
  published: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
  pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-500',
  rejected: 'bg-rose-500/10 text-rose-600 dark:text-rose-500',
  deleted: 'bg-muted text-muted-foreground',
}

const STATUS_DOT: Record<CirclePostStatus, string> = {
  published: 'bg-emerald-500',
  pending: 'bg-amber-500',
  rejected: 'bg-rose-500',
  deleted: 'bg-muted-foreground/50',
}

const STATUS_LABEL: Record<CirclePostStatus, string> = {
  published: 'statusPublished',
  pending: 'statusPending',
  rejected: 'statusRejected',
  deleted: 'statusDeleted',
}

export function DynamicsTable({
  list,
  isLoading,
  deletePending,
  auditPending,
  onComments,
  onDelete,
  onAudit,
}: Props) {
  const t = useTranslations('admin.circlesDynamics')

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-4 py-2.5">{t('colContent')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colAuthor')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colCircle')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colCounts')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colStatus')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colCreatedAt')}</TableHead>
            <TableHead className="px-4 py-2.5 text-right">{t('colActions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y">
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={COLSPAN} className="px-4 py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                {t('loading')}
              </TableCell>
            </TableRow>
          ) : list.length === 0 ? (
            <TableRow>
              <TableCell colSpan={COLSPAN} className="px-4 py-10 text-center text-muted-foreground">
                <FileText className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('noData')}
              </TableCell>
            </TableRow>
          ) : (
            list.map((item) => {
              const canAudit = item.status !== 'deleted'
              const canPublish = item.status !== 'published' && item.status !== 'deleted'
              const canReject = item.status !== 'rejected' && item.status !== 'deleted'
              return (
                <TableRow key={item.id} className="hover:bg-muted/30">
                  <TableCell className="max-w-xs px-4 py-2.5">
                    <div className="line-clamp-2 text-sm">{item.content}</div>
                    {item.images.length > 0 && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {t('imageCount', { count: item.images.length })}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <Avatar
                        src={item.author.avatar ?? undefined}
                        name={item.author.nickname}
                        size="xs"
                      />
                      <span className="text-sm">{item.author.nickname || '-'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-sm text-muted-foreground">
                    {item.circle.name || '-'}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <span>
                        {t('view')} {item.viewCount}
                      </span>
                      <span>
                        {t('comment')} {item.commentCount}
                      </span>
                      <span>
                        {t('like')} {item.likeCount}
                      </span>
                      <span>
                        {t('favorite')} {item.favoriteCount}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                        STATUS_STYLE[item.status],
                      )}
                    >
                      <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[item.status])} />
                      {t(STATUS_LABEL[item.status])}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-sm text-muted-foreground">
                    {dateFormatter.format(new Date(item.createdAt))}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {canPublish && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onAudit(item, 'published')}
                          title={t('auditPublish')}
                          disabled={auditPending}
                          className="text-emerald-600 hover:text-emerald-700"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                      )}
                      {canReject && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onAudit(item, 'rejected')}
                          title={t('auditReject')}
                          disabled={auditPending}
                          className="text-rose-600 hover:text-rose-700"
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onComments(item)}
                        title={t('comments')}
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                      {canAudit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(item)}
                          title={t('delete')}
                          className="text-destructive hover:text-destructive"
                          disabled={deletePending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
