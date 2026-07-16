'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2, MessageSquare, Eye, Trash2, X } from 'lucide-react'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@ihui/ui'
import { cn } from '@/lib/utils'
import { fetchCommentDetail, deleteComment, formatTime, initials } from './helpers'
import type { CommentItem } from './types'

const COLSPAN = 7

interface Props {
  list: CommentItem[]
  isLoading: boolean
  onOpenDetail: (id: string) => void
  onDelete: (item: CommentItem) => void
  deletePending: boolean
}

export function CommentsTable({ list, isLoading, onOpenDetail, onDelete, deletePending }: Props) {
  const t = useTranslations('admin.comments')
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-4 py-2.5">{t('colContent')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colTopicType')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colUser')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colResourceId')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colStatus')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colTime')}</TableHead>
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
                <MessageSquare className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('noData')}
              </TableCell>
            </TableRow>
          ) : (
            list.map((item) => {
              const name = item.userNickname ?? '-'
              return (
                <TableRow key={item.id} className="hover:bg-muted/30">
                  <TableCell className="max-w-xs truncate px-4 py-2.5">
                    {item.isDeleted ? (
                      <span className="italic text-muted-foreground">{t('deletedContent')}</span>
                    ) : (
                      <span className="truncate">{item.content}</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                      {item.resourceType}
                    </code>
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
                        {initials(name)}
                      </span>
                      <span className="text-sm">{name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[120px] truncate px-4 py-2.5 text-xs text-muted-foreground">
                    {item.resourceId}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                        item.isDeleted
                          ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                          : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
                      )}
                    >
                      {item.isDeleted ? t('statusDeleted') : t('statusNormal')}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">
                    {formatTime(item.createdAt)}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onOpenDetail(item.id)}
                        title={t('viewDetail')}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(item)}
                        title={t('delete')}
                        className="text-destructive hover:text-destructive"
                        disabled={deletePending || item.isDeleted}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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

interface DrawerProps {
  open: boolean
  commentId: string | null
  onClose: () => void
}

export function CommentDrawer({ open, commentId, onClose }: DrawerProps) {
  const t = useTranslations('admin.comments')
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'comment-detail', commentId],
    queryFn: () => fetchCommentDetail(commentId!),
    enabled: !!commentId && open,
    retry: false,
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteComment(id),
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'comments'] })
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const comment = data?.comment
  const replies = data?.replies ?? []
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            {t('detailTitle')}
          </DialogTitle>
          <DialogDescription>{t('detailDesc')}</DialogDescription>
        </DialogHeader>
        {isLoading || !comment ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t('loading')}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/30 p-3">
              <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  <code className="rounded bg-muted px-1.5 py-0.5">{comment.resourceType}</code>
                  <span className="ml-2">resourceId: {comment.resourceId}</span>
                </span>
                <span>{formatTime(comment.createdAt)}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium">
                  {initials(comment.userNickname)}
                </span>
                <div className="flex-1">
                  <div className="text-sm font-medium">{comment.userNickname ?? '-'}</div>
                  <div className="mt-1 text-sm">
                    {comment.isDeleted ? (
                      <span className="italic text-muted-foreground">{t('deletedContent')}</span>
                    ) : (
                      comment.content
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-sm font-medium">{t('repliesTitle')}</h4>
                <span className="text-xs text-muted-foreground">
                  {t('repliesCount', { count: replies.length })}
                </span>
              </div>
              {replies.length === 0 ? (
                <div className="rounded-md border border-dashed py-6 text-center text-xs text-muted-foreground">
                  {t('noReplies')}
                </div>
              ) : (
                <div className="max-h-64 space-y-2 overflow-auto">
                  {replies.map((r) => (
                    <div key={r.id} className="rounded-md border bg-card p-2 text-sm">
                      <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{r.userNickname ?? '-'}</span>
                        <span>{formatTime(r.createdAt)}</span>
                      </div>
                      {r.isDeleted ? (
                        <span className="italic text-muted-foreground">{t('deletedContent')}</span>
                      ) : (
                        r.content
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between border-t pt-3">
              <Button variant="outline" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
                {t('close')}
              </Button>
              {!comment.isDeleted && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteMut.mutate(comment.id)}
                  disabled={deleteMut.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                  {t('delete')}
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
