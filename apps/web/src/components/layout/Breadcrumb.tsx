'use client'

import * as React from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface BreadcrumbItem {
  label: string
  href?: string
  onClick?: () => void
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
  separator?: React.ReactNode
  className?: string
}

export function Breadcrumb({ items, separator, className }: BreadcrumbProps) {
  const sep = separator ?? <ChevronRight className="h-4 w-4" />
  return (
    <nav aria-label="breadcrumb" className={cn('flex items-center text-sm', className)}>
      <ol className="flex items-center gap-1.5">
        {items.map((item, i) => {
          const isLast = i === items.length - 1
          return (
            <li key={i} className="flex items-center gap-1.5">
              {item.href && !isLast ? (
                <a href={item.href} className="text-muted-foreground transition-colors hover:text-foreground">
                  {item.label}
                </a>
              ) : item.onClick && !isLast ? (
                <button onClick={item.onClick} className="text-muted-foreground transition-colors hover:text-foreground">
                  {item.label}
                </button>
              ) : (
                <span className={cn(isLast ? 'font-medium text-foreground' : 'text-muted-foreground')}>
                  {item.label}
                </span>
              )}
              {!isLast && <span className="text-muted-foreground/50">{sep}</span>}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
