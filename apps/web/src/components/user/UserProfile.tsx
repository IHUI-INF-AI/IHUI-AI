'use client'

import * as React from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

export interface UserProfileProps {
  avatar?: string
  name: string
  bio?: string
  stats?: { label: string; value: number | string }[]
  actions?: React.ReactNode
  className?: string
}

export default function UserProfile({
  avatar,
  name,
  bio,
  stats,
  actions,
  className,
}: UserProfileProps): React.JSX.Element {
  return (
    <div className={cn('rounded-2xl border bg-card p-6 text-card-foreground shadow', className)}>
      <div className="flex items-start gap-4">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full bg-muted">
          {avatar ? (
            <Image
              src={avatar}
              alt={name}
              width={80}
              height={80}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-lg font-medium text-muted-foreground">
              {name?.charAt(0)?.toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="break-words text-xl font-semibold">{name}</h2>
          {bio && <p className="mt-1 break-words text-sm text-muted-foreground">{bio}</p>}
          {stats && stats.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              {stats.map((s) => (
                <span key={s.label}>
                  <span className="font-medium">{s.value}</span>{' '}
                  <span className="text-muted-foreground">{s.label}</span>
                </span>
              ))}
            </div>
          )}
        </div>
        {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
      </div>
    </div>
  )
}
