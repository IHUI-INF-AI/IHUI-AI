'use client'

import * as React from 'react'
import { User, Clock, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ProgressBar } from '@/components/common'

interface CourseCardProps {
  title: string
  cover?: string
  instructor?: string
  price?: number | string
  originalPrice?: number | string
  progress?: number
  rating?: number
  duration?: string
  tags?: string[]
  onClick?: () => void
  className?: string
}

export function CourseCard({
  title,
  cover,
  instructor,
  price,
  originalPrice,
  progress,
  rating,
  duration,
  tags,
  onClick,
  className,
}: CourseCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'group overflow-hidden rounded-xl border bg-card text-card-foreground shadow transition-all hover:shadow-lg',
        onClick && 'cursor-pointer',
        className,
      )}
    >
      <div className="relative aspect-video overflow-hidden bg-muted">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt={title} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <Star className="h-10 w-10" />
          </div>
        )}
        {tags && tags.length > 0 && (
          <div className="absolute top-2 left-2 flex gap-1">
            {tags.map((tag, i) => (
              <span key={i} className="rounded bg-black/60 px-2 py-0.5 text-xs text-white">{tag}</span>
            ))}
          </div>
        )}
      </div>
      <div className="space-y-2 p-4">
        <h3 className="line-clamp-2 font-medium">{title}</h3>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {instructor && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {instructor}
            </span>
          )}
          {duration && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {duration}
            </span>
          )}
          {rating !== undefined && (
            <span className="flex items-center gap-0.5 text-amber-500">
              <Star className="h-3 w-3 fill-current" />
              {rating.toFixed(1)}
            </span>
          )}
        </div>
        {progress !== undefined && (
          <ProgressBar value={progress} showLabel size="sm" />
        )}
        {(price !== undefined || originalPrice !== undefined) && (
          <div className="flex items-baseline gap-2">
            {price !== undefined && (
              <span className="text-lg font-bold text-primary">
                {typeof price === 'number' ? `¥${price}` : price}
              </span>
            )}
            {originalPrice !== undefined && (
              <span className="text-sm text-muted-foreground line-through">
                {typeof originalPrice === 'number' ? `¥${originalPrice}` : originalPrice}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
