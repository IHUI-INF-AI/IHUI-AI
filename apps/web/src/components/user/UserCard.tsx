'use client'

import * as React from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

export interface UserCardProps {
  avatar?: string
  name: string
  bio?: string
  onClick?: () => void
  className?: string
}

export default function UserCard({
  avatar,
  name,
  bio,
  onClick,
  className,
}: UserCardProps): React.JSX.Element {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick?.()}
      className={cn(
        'flex items-center gap-3 rounded-xl border bg-card p-4 text-card-foreground shadow',
        onClick && 'cursor-pointer hover:shadow-md',
        className,
      )}
    >
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
        {avatar ? (
          <Image
            src={avatar}
            alt={name}
            width={48}
            height={48}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm font-medium text-muted-foreground">
            {name?.charAt(0)?.toUpperCase()}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="break-words font-medium">{name}</h3>
        {bio && <p className="truncate text-sm text-muted-foreground">{bio}</p>}
      </div>
    </div>
  )
}
