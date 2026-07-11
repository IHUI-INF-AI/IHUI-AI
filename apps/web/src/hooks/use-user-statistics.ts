'use client'

import * as React from 'react'

import { useUserStore } from '@/stores/user'
import { getUserStatistics, type UserStatistics } from '@/lib/user-api'

export interface UseUserStatisticsReturn {
  statistics: UserStatistics | null
  loading: boolean
  fetchStatistics: () => Promise<void>
}

/** 用户统计 Hook，从 user store 读取并支持主动拉取统计数据 */
export function useUserStatistics(): UseUserStatisticsReturn {
  const statistics = useUserStore((s) => s.statistics)
  const setStatistics = useUserStore((s) => s.setStatistics)
  const [loading, setLoading] = React.useState(false)

  const fetchStatistics = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await getUserStatistics()
      if (res.success) setStatistics(res.data)
    } finally {
      setLoading(false)
    }
  }, [setStatistics])

  return { statistics, loading, fetchStatistics }
}
