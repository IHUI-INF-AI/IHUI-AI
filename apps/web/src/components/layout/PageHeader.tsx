import * as React from 'react'
import { cn } from '@/lib/utils'
import { Breadcrumb, type BreadcrumbItem } from './Breadcrumb'

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  breadcrumb?: BreadcrumbItem[]
  className?: string
}

export function PageHeader({ title, subtitle, actions, breadcrumb, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {breadcrumb && <Breadcrumb items={breadcrumb} />}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}
