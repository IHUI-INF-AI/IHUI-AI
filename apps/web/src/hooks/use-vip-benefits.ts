'use client'

import * as React from 'react'

import { getVipBenefits, type VipBenefit } from '@/lib/vip-api'

export interface UseVipBenefitsReturn {
  benefits: VipBenefit[]
  loading: boolean
  fetchBenefits: (level?: number) => Promise<void>
}

/** VIP 权益 Hook，按等级获取权益列表 */
export function useVipBenefits(): UseVipBenefitsReturn {
  const [benefits, setBenefits] = React.useState<VipBenefit[]>([])
  const [loading, setLoading] = React.useState(false)

  const fetchBenefits = React.useCallback(async (level?: number) => {
    setLoading(true)
    try {
      const res = await getVipBenefits(level !== undefined ? { level } : {})
      if (res.success) setBenefits(res.data)
    } finally {
      setLoading(false)
    }
  }, [])

  return { benefits, loading, fetchBenefits }
}
