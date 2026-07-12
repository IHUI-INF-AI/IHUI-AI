'use client'

import { useTranslations } from 'next-intl'
import { Users, Folder, FileText, ShoppingCart } from 'lucide-react'
import { StatCard } from '@/components/data'
import type { DetailedStats } from './types'

interface Props {
  stats: DetailedStats
  isLoading: boolean
  numFmt: Intl.NumberFormat
}

export function AdminStatCards({ stats, isLoading, numFmt }: Props) {
  const t = useTranslations('dashboard.admin')
  const cards = [
    {
      title: t('totalUsers'),
      value: stats.totals.users,
      icon: Users,
      trend: stats.totals.usersChange,
    },
    {
      title: t('totalProjects'),
      value: stats.totals.projects,
      icon: Folder,
      trend: stats.totals.projectsChange,
    },
    {
      title: t('totalFiles'),
      value: stats.totals.files,
      icon: FileText,
      trend: stats.totals.filesChange,
    },
    {
      title: t('totalOrders'),
      value: stats.totals.orders,
      icon: ShoppingCart,
      trend: stats.totals.ordersChange,
    },
  ]
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <StatCard
          key={c.title}
          title={c.title}
          value={numFmt.format(c.value)}
          icon={c.icon}
          trend={c.trend}
          loading={isLoading}
        />
      ))}
    </div>
  )
}
