'use client'

import { useTranslations } from 'next-intl'
import { Award } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/data/Avatar'
import { PointsState } from './PointsState'
import type { LeaderboardUser } from './types'

interface Props {
  isLoading: boolean
  error: unknown
  data: LeaderboardUser[] | undefined
}

export function PointsLeaderboard({ isLoading, error, data }: Props) {
  const t = useTranslations('points')

  if (isLoading) return <PointsState kind="loading" text={t('loading')} />
  if (error) return <PointsState kind="error" text={(error as Error).message} />
  if (!data || data.length === 0) return <PointsState kind="empty" icon={Award} text={t('empty')} />

  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-2 text-left font-medium">{t('rank')}</th>
            <th className="px-4 py-2 text-left font-medium">{t('user')}</th>
            <th className="px-4 py-2 text-right font-medium">{t('pointsLabel')}</th>
            <th className="hidden px-4 py-2 text-right font-medium sm:table-cell">
              {t('levelLabel')}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {data.map((u, i) => (
            <tr
              key={u.userId}
              className={cn('transition-colors hover:bg-accent/50', u.isMe && 'bg-primary/5')}
            >
              <td className="px-4 py-2">
                <span
                  className={cn(
                    'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
                    i < 3
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {i + 1}
                </span>
              </td>
              <td className="px-4 py-2">
                <div className="flex items-center gap-2">
                  <Avatar src={u.avatar ?? undefined} name={u.nickname ?? 'U'} size="xs" />
                  <span className="font-medium">{u.nickname}</span>
                  {u.isMe && <span className="text-xs text-primary">({t('you')})</span>}
                </div>
              </td>
              <td className="px-4 py-2 text-right font-medium">{u.points}</td>
              <td className="hidden px-4 py-2 text-right text-muted-foreground sm:table-cell">
                Lv.{u.level}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
