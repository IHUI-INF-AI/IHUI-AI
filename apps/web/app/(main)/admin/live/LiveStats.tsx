'use client'

import { useQuery } from '@tanstack/react-query'
import { Radio, CheckCircle2, Eye } from 'lucide-react'
import type { useTranslations } from 'next-intl'
import { StatCard } from './StatCard'
import { type LiveStatistics, api } from './types'

export function LiveStats({ t }: { t: ReturnType<typeof useTranslations<'admin.live'>> }) {
  const { data: stats } = useQuery({
    queryKey: ['live', 'statistics'],
    queryFn: () =>
      api<{ statistics: LiveStatistics }>(`/api/live/statistics`).then((d) => d.statistics),
    retry: 0,
  })

  const channelTotal = stats?.total ?? 0
  const livingTotal = stats?.living ?? 0
  const publishedTotal = stats?.published ?? 0
  const viewSum = stats?.viewSum ?? 0

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        icon={Radio}
        label={t('statChannelTotal')}
        value={channelTotal}
        gradient="bg-gradient-to-br from-indigo-500 to-purple-700"
      />
      <StatCard
        icon={Radio}
        label={t('statLiving')}
        value={livingTotal}
        gradient="bg-gradient-to-br from-rose-500 to-red-500"
      />
      <StatCard
        icon={CheckCircle2}
        label={t('statPublished')}
        value={publishedTotal}
        gradient="bg-gradient-to-br from-emerald-500 to-green-400"
      />
      <StatCard
        icon={Eye}
        label={t('statViewSum')}
        value={viewSum}
        gradient="bg-gradient-to-br from-sky-500 to-blue-500"
      />
    </div>
  )
}
