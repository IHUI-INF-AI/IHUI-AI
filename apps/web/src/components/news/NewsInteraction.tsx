'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Heart, Bookmark } from 'lucide-react'
import { Button } from '@ihui/ui'
import { cn } from '@/lib/utils'

interface NewsInteractionProps {
  likeCount: number
  favoriteCount: number
  initialLiked?: boolean
  initialFavorited?: boolean
  onLike?: (liked: boolean) => void
  onFavorite?: (favorited: boolean) => void
  className?: string
}

export function NewsInteraction({
  likeCount,
  favoriteCount,
  initialLiked = false,
  initialFavorited = false,
  onLike,
  onFavorite,
  className,
}: NewsInteractionProps) {
  const t = useTranslations('news.interaction')
  const [liked, setLiked] = React.useState(initialLiked)
  const [favorited, setFavorited] = React.useState(initialFavorited)
  const [likes, setLikes] = React.useState(likeCount)
  const [favorites, setFavorites] = React.useState(favoriteCount)

  const handleLike = () => {
    const next = !liked
    setLiked(next)
    setLikes((n) => (next ? n + 1 : n - 1))
    onLike?.(next)
  }

  const handleFavorite = () => {
    const next = !favorited
    setFavorited(next)
    setFavorites((n) => (next ? n + 1 : n - 1))
    onFavorite?.(next)
  }

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <Button
        variant={favorited ? 'default' : 'outline'}
        size="sm"
        onClick={handleFavorite}
        className="rounded-md"
      >
        <Bookmark className={cn(favorited && 'fill-current')} />
        {favorited ? t('favorited') : t('favorite')}
        <span className="ml-0.5 tabular-nums">{favorites}</span>
      </Button>
      <Button
        variant={liked ? 'default' : 'outline'}
        size="sm"
        onClick={handleLike}
        className="rounded-md"
      >
        <Heart className={cn(liked && 'fill-current')} />
        {liked ? t('liked') : t('like')}
        <span className="ml-0.5 tabular-nums">{likes}</span>
      </Button>
    </div>
  )
}
