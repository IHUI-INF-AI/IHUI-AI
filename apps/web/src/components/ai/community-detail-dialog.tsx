'use client'

import * as React from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Heart, Share2, MessageCircle } from 'lucide-react'
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@ihui/ui'
import { Badge } from '@/components/data/Badge'
import { cn } from '@/lib/utils'
import type { CommunityItem } from './community-feed-panel'

interface CommunityDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  creation: CommunityItem | null
  onComment?: (creation: CommunityItem) => void
}

// 类型 -> Badge variant
const TYPE_BADGE_VARIANT: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'danger'> = {
  image: 'primary',
  video: 'success',
  audio: 'warning',
  music: 'warning',
  article: 'default',
  code: 'default',
}

/**
 * CommunityDetailDialog - 创作详情对话框
 * 大图预览 + title + author + prompt + model + createdAt + 分享/点赞/评论按钮
 */
export function CommunityDetailDialog({ open, onOpenChange, creation, onComment }: CommunityDetailDialogProps) {
  const t = useTranslations('aiCommunity')
  const tc = useTranslations('community')
  const tCommon = useTranslations('common')
  const [liked, setLiked] = React.useState(false)
  const [likes, setLikes] = React.useState(0)

  React.useEffect(() => {
    if (creation) {
      setLiked(false)
      setLikes(creation.likes)
    }
  }, [creation])

  if (!creation) return null

  const handleLike = () => {
    setLiked((v) => {
      const next = !v
      setLikes((n) => (next ? n + 1 : Math.max(0, n - 1)))
      return next
    })
  }

  const handleShare = () => {
    const url = `${window.location.origin}/ai-community/${creation.id}`
    navigator.clipboard
      .writeText(url)
      .then(() => toast.success(tCommon('copySuccess')))
      .catch(() => toast.error(tCommon('operationFailed')))
  }

  const formatDate = (dateStr: string) =>
    new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(dateStr))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[800px]">
        <DialogHeader>
          <DialogTitle className="text-xl">{creation.title}</DialogTitle>
        </DialogHeader>

        {/* 大图预览 */}
        <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-muted">
          <Image src={creation.cover} alt={creation.title} fill className="object-cover" />
        </div>

        {/* meta 信息 */}
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <div className="mb-3 flex items-center gap-3">
            <Badge variant={TYPE_BADGE_VARIANT[creation.type] ?? 'default'}>
              <span>{t(`filters.${creation.type}`)}</span>
            </Badge>
            <span className="text-sm text-muted-foreground">{creation.author}</span>
          </div>

          <div className="mb-3 flex">
            <span className="w-20 shrink-0 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t('detail.model')}
            </span>
            <span className="flex-1 text-sm">{creation.model}</span>
          </div>

          {creation.prompt && (
            <div className="mb-3 flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t('detail.prompt')}
              </span>
              <div className="rounded-md border border-border bg-background p-3 font-mono text-xs leading-relaxed text-muted-foreground">
                {creation.prompt}
              </div>
            </div>
          )}

          <div className="flex">
            <span className="w-20 shrink-0 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t('detail.createdAt')}
            </span>
            <span className="flex-1 text-sm">{formatDate(creation.createdAt)}</span>
          </div>
        </div>

        {/* action 按钮 */}
        <DialogFooter>
          <Button variant="ghost" onClick={handleShare}>
            <Share2 />
            <span>{t('actions.share')}</span>
          </Button>
          <Button variant="ghost" onClick={() => onComment?.(creation)}>
            <MessageCircle />
            <span>{tc('comment')}</span>
          </Button>
          <Button variant={liked ? 'default' : 'ghost'} onClick={handleLike}>
            <Heart className={cn(liked && 'fill-current')} />
            <span>{likes}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
