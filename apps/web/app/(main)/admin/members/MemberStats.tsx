'use client'

import { useQuery } from '@tanstack/react-query'
import { Users, Clock, Ban, Building2 } from 'lucide-react'
import type { useTranslations } from 'next-intl'
import { StatCard } from './StatCard'
import { type MemberStatistics, type CompaniesData, api } from './types'

export function MemberStats({ t }: { t: ReturnType<typeof useTranslations<'admin.members'>> }) {
  const { data: stats } = useQuery({
    queryKey: ['admin', 'members', 'statistics'],
    queryFn: () =>
      api<{ statistics: MemberStatistics }>(`/api/admin/members/statistics`).then(
        (d) => d.statistics,
      ),
  })

  const { data: companiesData } = useQuery({
    queryKey: ['admin', 'members', 'companies', 'count'],
    queryFn: () => api<CompaniesData>(`/api/admin/members/companies?page=1&pageSize=100`),
  })

  const statTotal = stats?.total ?? 0
  const statPending = stats?.pending ?? 0
  const statSealed = stats?.sealed ?? 0
  const statCompany = companiesData?.total ?? 0

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        icon={Users}
        label={t('statTotal')}
        value={statTotal}
        gradient="bg-gradient-to-br from-indigo-500 to-purple-700"
      />
      <StatCard
        icon={Clock}
        label={t('statPending')}
        value={statPending}
        gradient="bg-gradient-to-br from-amber-400 to-orange-400"
      />
      <StatCard
        icon={Ban}
        label={t('statSealed')}
        value={statSealed}
        gradient="bg-gradient-to-br from-rose-500 to-red-500"
      />
      <StatCard
        icon={Building2}
        label={t('statCompany')}
        value={statCompany}
        gradient="bg-gradient-to-br from-sky-500 to-blue-500"
      />
    </div>
  )
}
