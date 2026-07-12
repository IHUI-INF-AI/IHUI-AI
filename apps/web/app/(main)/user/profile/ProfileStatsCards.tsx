'use client'

import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { UserStats } from './types'

interface Props {
  stats: UserStats | undefined
  isError: boolean
}

export function ProfileStatsCards({ stats, isError }: Props) {
  const t = useTranslations('user.profile')
  const items = [
    { label: t('following'), value: stats?.followingCount, href: '/following?tab=following' },
    { label: t('followers'), value: stats?.followersCount, href: '/following?tab=followers' },
    { label: t('favorites'), value: stats?.favoritesCount, href: '/favorites' },
  ]
  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          className="flex flex-col items-center justify-center rounded-lg border bg-card px-3 py-3 transition-colors hover:bg-accent"
        >
          <span className="text-xl font-bold tabular-nums">
            {isError ? (
              <span className="text-sm text-destructive">--</span>
            ) : item.value === undefined ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              item.value
            )}
          </span>
          <span className="mt-0.5 text-xs text-muted-foreground">{item.label}</span>
        </Link>
      ))}
    </div>
  )
}
