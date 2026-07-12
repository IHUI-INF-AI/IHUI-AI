'use client'

import * as React from 'react'
import { UserPlus, UserCheck } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/data'
import { Button } from '@ihui/ui'

interface UserCardProps {
  avatar?: string
  name: string
  bio?: string
  followed?: boolean
  onFollow?: () => void
  stats?: { label: string; value: number | string }[]
  onClick?: () => void
  className?: string
}

function UserCardImpl({
  avatar,
  name,
  bio,
  followed = false,
  onFollow,
  stats,
  onClick,
  className,
}: UserCardProps) {
  const [isFollowed, setIsFollowed] = React.useState(followed)
  const t = useTranslations('common')

  const handleFollow = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsFollowed(!isFollowed)
    onFollow?.()
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.()
        }
      }}
      className={cn(
        'flex items-center gap-3 rounded-xl border bg-card p-4 text-card-foreground shadow',
        onClick && 'cursor-pointer hover:shadow-md',
        className,
      )}
    >
      <Avatar src={avatar} name={name} size="lg" />
      <div className="min-w-0 flex-1">
        <h3 className="break-words font-medium">{name}</h3>
        {bio && <p className="text-sm text-muted-foreground">{bio}</p>}
        {stats && stats.length > 0 && (
          <div className="mt-1 flex gap-4 text-xs">
            {stats.map((s) => (
              <span key={s.label}>
                <span className="font-medium">{s.value}</span>{' '}
                <span className="text-muted-foreground">{s.label}</span>
              </span>
            ))}
          </div>
        )}
      </div>
      {onFollow && (
        <Button variant={isFollowed ? 'outline' : 'default'} size="sm" onClick={handleFollow}>
          {isFollowed ? <UserCheck className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
          {isFollowed ? t('followed') : t('follow')}
        </Button>
      )}
    </div>
  )
}

export const UserCard = React.memo(UserCardImpl)
