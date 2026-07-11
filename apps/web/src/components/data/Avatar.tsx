'use client'

import * as React from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
type AvatarShape = 'circle' | 'square'

interface AvatarProps {
  src?: string
  fallback?: string
  name?: string
  size?: AvatarSize
  shape?: AvatarShape
  className?: string
}

const sizeMap: Record<AvatarSize, string> = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-xl',
}

export function Avatar({
  src,
  fallback,
  name,
  size = 'md',
  shape = 'circle',
  className,
}: AvatarProps) {
  const [error, setError] = React.useState(false)
  const initials = fallback ?? (name ? name.slice(0, 2) : '?')

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden bg-muted font-medium text-muted-foreground',
        sizeMap[size],
        shape === 'circle' ? 'rounded-full' : 'rounded-lg',
        className,
      )}
    >
      {src && !error ? (
        <Image
          src={src}
          alt={name ?? 'avatar'}
          fill
          className="object-cover"
          onError={() => setError(true)}
        />
      ) : (
        initials
      )}
    </span>
  )
}
