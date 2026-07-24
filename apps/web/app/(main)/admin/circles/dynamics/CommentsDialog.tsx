'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
} from '@ihui/ui-react'
import { Avatar } from '@/components/data/Avatar'
import { fetchDynamicComments, PAGE_SIZE } from './helpers'
import type { CirclePost } from './types'

interface Props {
  post: CirclePost | null
  onClose: () => void
}

const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

export function CommentsDialog({ post, onClose }: Props) {
  const t = useTranslations('admin.circlesDynamics')
  const [page, setPage] = React.useState(1)

  const postId = post?.id
  React.useEffect(() => {
    if (postId) setPage(1)
  }, [postId])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'circlesDynamics', 'comments', post?.id, page],
    queryFn: () => fetchDynamicComments(post!.id, page, PAGE_SIZE),
    enabled: !!post,
    retry: false,
  })

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const list = data?.list ?? []

  return (
    <Dialog open={post !== null} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('commentsTitle')}</DialogTitle>
          <DialogDescription className="line-clamp-2">{post?.content ?? ''}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-2 overflow-y-auto">
          {isLoading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
              {t('loading')}
            </div>
          ) : list.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">{t('noComments')}</div>
          ) : (
            list.map((c) => (
              <div key={c.id} className="rounded-md border p-3">
                <div className="flex items-center gap-2">
                  <Avatar src={c.author.avatar ?? undefined} name={c.author.nickname} size="xs" />
                  <span className="text-sm font-medium">{c.author.nickname || '-'}</span>
                  <span className="text-xs text-muted-foreground">
                    {dateFormatter.format(new Date(c.createdAt))}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {t('like')} {c.likeCount}
                  </span>
                </div>
                <div className="mt-1.5 text-sm">{c.content}</div>
              </div>
            ))
          )}
        </div>
        {total > 0 && (
          <div className="flex items-center justify-between pt-2">
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
                {t('pageOf', { page, totalPages })}
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
        )}
      </DialogContent>
    </Dialog>
  )
}
