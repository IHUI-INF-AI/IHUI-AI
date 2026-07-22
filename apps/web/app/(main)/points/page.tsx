'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'

import { PointsSummary } from './PointsSummary'
import { PointsTransactionList } from './PointsTransactionList'
import { PointsLeaderboard } from './PointsLeaderboard'
import { PointsRedeemList } from './PointsRedeemList'
import { api } from './helpers'
import type { Transaction, LeaderboardUser } from './types'

export default function PointsPage() {
  const t = useTranslations('points')
  const [tab, setTab] = React.useState<'tx' | 'lb' | 'redeem'>('tx')
  const currentUserId = useAuthStore((s) => s.user?.id)

  const pointsQ = useQuery({
    queryKey: ['points'],
    queryFn: () =>
      api<{ points: { points: number; totalEarned: number; totalSpent: number } }>(
        '/api/points',
      ).then((d) => ({
        current: d.points.points,
        totalEarned: d.points.totalEarned,
        totalSpent: d.points.totalSpent,
      })),
  })
  const txQ = useQuery({
    queryKey: ['points', 'tx'],
    queryFn: () =>
      api<{ list: Transaction[] }>('/api/points/transactions').then((d) => d.list ?? []),
  })
  const lbQ = useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => api<{ list: LeaderboardUser[] }>('/api/leaderboard').then((d) => d.list ?? []),
    select: (list) => list.map((u) => ({ ...u, isMe: u.userId === currentUserId })),
  })
  const levelQ = useQuery({
    queryKey: ['levels', 'current'],
    queryFn: () =>
      api<{
        current: { level: number; name: string; minExperience: number }
        next: { level: number; name: string; minExperience: number } | null
        experience: number
        progress: number
      }>('/api/levels/current').then((d) => ({
        level: d.current.level,
        name: d.current.name,
        currentPoints: d.experience,
        nextLevelPoints: d.next?.minExperience,
        nextLevelName: d.next?.name,
      })),
  })

  const points = pointsQ.data
  const level = levelQ.data

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <PointsSummary
        points={points}
        level={level}
        pointsLoading={pointsQ.isLoading}
        levelLoading={levelQ.isLoading}
      />

      <div className="flex gap-1 border-b">
        {(['tx', 'lb', 'redeem'] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cn(
              'border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              tab === k
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t(`tab.${k}`)}
          </button>
        ))}
      </div>

      <div key={tab} className="animate-in fade-in-0 duration-200">
        {tab === 'tx' ? (
          <PointsTransactionList isLoading={txQ.isLoading} error={txQ.error} data={txQ.data} />
        ) : tab === 'lb' ? (
          <PointsLeaderboard isLoading={lbQ.isLoading} error={lbQ.error} data={lbQ.data} />
        ) : (
          <PointsRedeemList />
        )}
      </div>
    </div>
  )
}
