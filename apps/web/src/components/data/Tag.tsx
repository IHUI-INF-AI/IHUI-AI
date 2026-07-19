'use client'

import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

type TagSize = 'sm' | 'md' | 'lg'

interface TagProps {
  children: React.ReactNode
  closable?: boolean
  onClose?: () => void
  color?: string
  size?: TagSize
  className?: string
}

const sizeMap: Record<TagSize, string> = {
  sm: 'px-1.5 py-0.5 text-xs',
  md: 'px-2 py-0.5 text-sm',
  lg: 'px-3 py-1 text-sm',
}

export function Tag({
  children,
  closable = false,
  onClose,
  color,
  size = 'md',
  className,
}: TagProps) {
  const style = color
    ? { backgroundColor: `${color}1a`, color, borderColor: `${color}40` }
    : undefined
  return (
    <span
      style={style}
      className={cn(
        'inline-flex items-center gap-1 rounded border',
        !color && 'border-input bg-muted text-muted-foreground',
        sizeMap[size],
        className,
      )}
    >
      {children}
      {closable && (
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭标签"
          className="ml-0.5 inline-flex items-center rounded-sm hover:opacity-70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  )
}
