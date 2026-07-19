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
  /** 保留 prop 以兼容现有调用方;按项目规则"禁止纯圆形/胶囊形状容器样式",
   * 头像外层容器不再使用 rounded-full,统一 rounded-md。 */
  shape?: AvatarShape
  className?: string
}

const sizeMap: Record<AvatarSize, string> = {
  xs: 'h-6 w-6 text-xs',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-xl',
}

export function getInitials(name?: string | null): string {
  if (!name) return '?'
  const trimmed = name.trim()
  if (!trimmed) return '?'
  return trimmed.slice(0, 2).toUpperCase()
}

export function Avatar({ src, fallback, name, size = 'md', className }: AvatarProps) {
  const [error, setError] = React.useState(false)
  const initials = fallback ?? getInitials(name)

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden bg-muted font-medium text-muted-foreground',
        sizeMap[size],
        // 项目规则:头像外层容器禁止 rounded-full,统一 rounded-md
        'rounded-md',
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
