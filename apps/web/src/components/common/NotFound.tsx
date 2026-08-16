import * as React from 'react'
import { cn } from '@/lib/utils'

interface NotFoundProps {
  title?: string
  description?: string
  action?: React.ReactNode
  code?: number | string
  className?: string
}

export function NotFound({
  title = '页面未找到',
  description = '您访问的页面不存在或已被移动',
  action,
  code = 404,
  className,
}: NotFoundProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 py-12 min-[640px]:py-20 text-center',
        className,
      )}
    >
      <div className="text-6xl font-bold text-muted-foreground/30 min-[640px]:text-7xl">{code}</div>
      <h1 className="text-xl font-semibold min-[640px]:text-2xl">{title}</h1>
      <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
