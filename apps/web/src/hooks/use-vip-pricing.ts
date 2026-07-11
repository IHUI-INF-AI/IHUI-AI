'use client'

import * as React from 'react'

import { getVipLevels, type VipLevel } from '@/lib/vip-api'

export interface UseVipPricingReturn {
  levels: VipLevel[]
  selectedId: string | null
  selected: VipLevel | null
  loading: boolean
  fetchLevels: () => Promise<void>
  select: (id: string) => void
}

/** VIP 定价 Hook，获取会员等级套餐并管理选中态 */
export function useVipPricing(): UseVipPricingReturn {
  const [levels, setLevels] = React.useState<VipLevel[]>([])
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)

  const fetchLevels = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await getVipLevels()
      if (res.success) {
        setLevels(res.data)
        const popular = res.data.find((l) => l.isPopular)
        setSelectedId(popular?.id ?? res.data[0]?.id ?? null)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const select = React.useCallback((id: string) => setSelectedId(id), [])

  const selected = React.useMemo(
    () => levels.find((l) => l.id === selectedId) ?? null,
    [levels, selectedId],
  )

  return { levels, selectedId, selected, loading, fetchLevels, select }
}
