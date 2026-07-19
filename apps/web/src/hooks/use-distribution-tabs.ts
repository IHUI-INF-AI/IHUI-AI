'use client'

import * as React from 'react'

export type DistributionTab = 'overview' | 'invites' | 'commission' | 'withdraw' | 'ranking'

export interface UseDistributionTabsReturn {
  activeTab: DistributionTab
  setActiveTab: (tab: DistributionTab) => void
  tabs: { key: DistributionTab; label: string }[]
}

const TABS: { key: DistributionTab; label: string }[] = [
  { key: 'overview', label: '概览' },
  { key: 'invites', label: '邀请记录' },
  { key: 'commission', label: '佣金明细' },
  { key: 'withdraw', label: '提现记录' },
  { key: 'ranking', label: '排行榜' },
]

/** 分销标签页 Hook，管理分销页面 tab 切换 */
export function useDistributionTabs(
  initial: DistributionTab = 'overview',
): UseDistributionTabsReturn {
  const [activeTab, setActiveTab] = React.useState<DistributionTab>(initial)

  return { activeTab, setActiveTab, tabs: TABS }
}
