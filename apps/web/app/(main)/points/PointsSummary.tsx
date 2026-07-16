'use client'

import * as React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { Star, TrendingUp, Coins, Award, Calendar, Loader2 } from 'lucide-react'
import { Button, Card, CardContent } from '@ihui/ui'
import { cn } from '@/lib/utils'
import type { PointsData, LevelData } from './types'

function StatCard({
  icon: Icon,
  label,
  value,
  loading,
  primary,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value?: number | string
  loading?: boolean
  primary?: boolean
}) {
  return (
    <Card className="transition-colors hover:bg-accent">
      <CardContent className="space-y-1.5 p-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icon className={cn('h-3.5 w-3.5', primary && 'text-primary')} />
          {label}
        </div>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <div className="text-2xl font-bold tracking-tight">{value ?? '-'}</div>
        )}
      </CardContent>
    </Card>
  )
}

interface Props {
  points?: PointsData
  level?: LevelData
  pointsLoading: boolean
  levelLoading: boolean
}

export function PointsSummary({ points, level, pointsLoading, levelLoading }: Props) {
  const t = useTranslations('points')
  const progress =
    level && level.nextLevelPoints
      ? Math.min(100, Math.round((level.currentPoints / level.nextLevelPoints) * 100))
      : 100
  const remaining = level?.nextLevelPoints
    ? Math.max(0, level.nextLevelPoints - level.currentPoints)
    : 0

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Image
              src="/images/common/ai-token.svg"
              alt=""
              aria-hidden
              width={24}
              height={24}
              className="h-6 w-6"
              unoptimized
            />
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t('title')}</h1>
          </div>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Link href="/points/sign-in">
          <Button variant="outline" size="sm">
            <Calendar className="h-4 w-4" />
            {t('signInLink')}
          </Button>
        </Link>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={Star}
          label={t('current')}
          value={points?.current}
          loading={pointsLoading}
          primary
        />
        <StatCard
          icon={TrendingUp}
          label={t('totalEarned')}
          value={points?.totalEarned}
          loading={pointsLoading}
        />
        <StatCard
          icon={Coins}
          label={t('totalSpent')}
          value={points?.totalSpent}
          loading={pointsLoading}
        />
        <StatCard
          icon={Award}
          label={t('level')}
          value={level ? `Lv.${level.level}` : undefined}
          loading={levelLoading}
        />
      </div>

      <Card>
        <CardContent className="space-y-2 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{level?.name ?? '-'}</span>
            <span className="text-muted-foreground">
              {level?.nextLevelName
                ? t('nextLevel', { name: level.nextLevelName, points: remaining })
                : t('maxLevel')}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </CardContent>
      </Card>
    </>
  )
}
