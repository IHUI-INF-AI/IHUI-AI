'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface UserInfoField {
  label: string
  value: React.ReactNode
}

export interface UserInfoCardProps {
  title?: string
  fields: UserInfoField[]
  className?: string
}

export default function UserInfoCard({
  title,
  fields,
  className,
}: UserInfoCardProps): React.JSX.Element {
  return (
    <div className={cn('rounded-xl border bg-card p-5 text-card-foreground shadow', className)}>
      {title && <h3 className="mb-3 text-base font-medium">{title}</h3>}
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.label} className="flex flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground">{f.label}</dt>
            <dd className="break-words text-sm">{f.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
