'use client'

import * as React from 'react'

import {
  getOverview,
  getRanking,
  type CommissionOverview,
  type CommissionRanking,
} from '@/lib/distribution-api'

export interface UseDistributionStatsReturn {
  overview: CommissionOverview | null
  ranking: CommissionRanking[]
  loading: boolean
  fetchStats: () => Promise<void>
}

/** 分销统计 Hook，汇总总览与排行榜数据 */
export function useDistributionStats(): UseDistributionStatsReturn {
  const [overview, setOverview] = React.useState<CommissionOverview | null>(null)
  const [ranking, setRanking] = React.useState<CommissionRanking[]>([])
  const [loading, setLoading] = React.useState(false)

  const fetchStats = React.useCallback(async () => {
    setLoading(true)
    try {
      const [overviewRes, rankingRes] = await Promise.all([
        getOverview(),
        getRanking({ limit: 10 }),
      ])
      if (overviewRes.success) setOverview(overviewRes.data)
      if (rankingRes.success) setRanking(rankingRes.data)
    } finally {
      setLoading(false)
    }
  }, [])

  return { overview, ranking, loading, fetchStats }
}
