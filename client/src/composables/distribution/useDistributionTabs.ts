/**
 * Distribution 标签页管理 Composable
 *
 * 负责分销页面的标签页切换和图表周期管理
 *
 * @packageDocumentation
 */

import { ref } from 'vue'

/**
 * 标签页类型
 */
export type DistributionTab = 'overview' | 'invites' | 'records' | 'withdrawals' | 'rules'

/**
 * 图表周期类型
 */
export type ChartPeriod = '7d' | '30d' | '90d'

/**
 * useDistributionTabs 配置选项
 */
export interface UseDistributionTabsOptions {
  /** 初始标签页 */
  initialTab?: DistributionTab
  /** 初始图表周期 */
  initialChartPeriod?: ChartPeriod
}

/**
 * Distribution 标签页管理 Composable
 *
 * @param options - 配置选项
 * @returns 返回标签页状态和方法
 */
export function useDistributionTabs(options: UseDistributionTabsOptions = {}) {
  const { initialTab = 'overview', initialChartPeriod = '30d' } = options

  // 当前激活的标签页
  const activeTab = ref<DistributionTab>(initialTab)

  // 图表周期
  const chartPeriod = ref<ChartPeriod>(initialChartPeriod)

  /**
   * 设置激活的标签页
   */
  const setActiveTab = (tab: DistributionTab): void => {
    activeTab.value = tab
  }

  /**
   * 设置图表周期
   */
  const setChartPeriod = (period: ChartPeriod): void => {
    chartPeriod.value = period
  }

  return {
    // 状态
    activeTab,
    chartPeriod,

    // 方法
    setActiveTab,
    setChartPeriod,
  }
}
