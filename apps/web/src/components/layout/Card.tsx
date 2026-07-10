import * as React from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode
  description?: React.ReactNode
  footer?: React.ReactNode
  actions?: React.ReactNode
  hover?: boolean
}

export function Card({
  title,
  description,
  footer,
  actions,
  hover = false,
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border bg-card text-card-foreground shadow',
        hover && 'transition-shadow hover:shadow-lg',
        className,
      )}
      {...props}
    >
      {(title || actions) && (
        <div className="flex items-start justify-between gap-2 p-6 pb-0">
          <div className="space-y-1">
            {title && <h3 className="font-semibold leading-none tracking-tight">{title}</h3>}
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>
      )}
      {children && <div className="p-6">{children}</div>}
      {footer && <div className="flex items-center p-6 pt-0">{footer}</div>}
    </div>
  )
}
