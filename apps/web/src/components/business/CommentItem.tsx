'use client'

import * as React from 'react'
import { ThumbsUp, MessageCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/data'

interface Reply {
  name: string
  avatar?: string
  content: string
  time: string
}

interface CommentItemProps {
  avatar?: string
  name: string
  content: string
  time: string
  likes?: number
  liked?: boolean
  replies?: Reply[]
  onLike?: () => void
  onReply?: () => void
  className?: string
}

function CommentItemImpl({
  avatar,
  name,
  content,
  time,
  likes = 0,
  liked = false,
  replies,
  onLike,
  onReply,
  className,
}: CommentItemProps) {
  const [isLiked, setIsLiked] = React.useState(liked)
  const [likeCount, setLikeCount] = React.useState(likes)
  const t = useTranslations('common')

  const handleLike = () => {
    setIsLiked(!isLiked)
    setLikeCount(isLiked ? likeCount - 1 : likeCount + 1)
    onLike?.()
  }

  return (
    <div className={cn('flex gap-3', className)}>
      <Avatar src={avatar} name={name} size="md" />
      <div className="min-w-0 flex-1">
        <div className="rounded-lg bg-muted p-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{name}</span>
            <span className="text-xs text-muted-foreground">{time}</span>
          </div>
          <p className="mt-1 text-sm">{content}</p>
        </div>
        <div className="mt-1.5 flex items-center gap-4 text-xs text-muted-foreground">
          <button
            onClick={handleLike}
            className={cn(
              'flex items-center gap-1 hover:text-foreground',
              isLiked && 'text-primary',
            )}
          >
            <ThumbsUp className={cn('h-3.5 w-3.5', isLiked && 'fill-current')} />
            {likeCount > 0 && likeCount}
          </button>
          <button onClick={onReply} className="flex items-center gap-1 hover:text-foreground">
            <MessageCircle className="h-3.5 w-3.5" />
            {t('reply')}
          </button>
        </div>
        {replies && replies.length > 0 && (
          <div className="mt-3 space-y-3 border-l-2 pl-3">
            {replies.map((reply, i) => (
              <div key={`reply-${i}`} className="flex gap-2">
                <Avatar src={reply.avatar} name={reply.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="rounded-lg bg-muted p-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">{reply.name}</span>
                      <span className="text-xs text-muted-foreground">{reply.time}</span>
                    </div>
                    <p className="mt-0.5 text-sm">{reply.content}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export const CommentItem = React.memo(CommentItemImpl)
