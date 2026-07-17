'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { ThumbsUp, Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CourseInteractionProps {
  likeCount: number
  favoriteCount: number
  liked?: boolean
  favorited?: boolean
  onLikeChange?: (liked: boolean) => void
  onFavoriteChange?: (favorited: boolean) => void
}

export function CourseInteraction({
  likeCount: initLike,
  favoriteCount: initFav,
  liked: initLiked = false,
  favorited: initFavorited = false,
  onLikeChange,
  onFavoriteChange,
}: CourseInteractionProps) {
  const t = useTranslations('course.interaction')
  const [liked, setLiked] = React.useState(initLiked)
  const [favorited, setFavorited] = React.useState(initFavorited)
  const [likeCount, setLikeCount] = React.useState(initLike)
  const [favCount, setFavCount] = React.useState(initFav)

  const toggleLike = () => {
    const next = !liked
    setLiked(next)
    setLikeCount((c) => (next ? c + 1 : Math.max(0, c - 1)))
    onLikeChange?.(next)
  }

  const toggleFav = () => {
    const next = !favorited
    setFavorited(next)
    setFavCount((c) => (next ? c + 1 : Math.max(0, c - 1)))
    onFavoriteChange?.(next)
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={toggleLike}
        className={cn(
          'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors',
          liked
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
        )}
      >
        <ThumbsUp className={cn('h-4 w-4', liked && 'fill-current')} />
        <span>{t('like')}</span>
        <span className="text-xs">{likeCount}</span>
      </button>
      <button
        type="button"
        onClick={toggleFav}
        className={cn(
          'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors',
          favorited
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
        )}
      >
        <Star className={cn('h-4 w-4', favorited && 'fill-current')} />
        <span>{t('favorite')}</span>
        <span className="text-xs">{favCount}</span>
      </button>
    </div>
  )
}
