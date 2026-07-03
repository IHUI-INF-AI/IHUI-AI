/**
 * Distribution 统计数据管理 Composable
 *
 * 负责分销统计数据的加载和管理
 *
 * @packageDocumentation
 */

import { ref } from 'vue'
import { logger } from '@/utils/logger'
import { useI18n } from 'vue-i18n'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { getInviteCode, getDistributionStatistics } from '@/api/distribution'

/**
 * 分销统计数据接口
 */
export interface DistributionStats {
  totalEarnings: number
  totalInvites: number
  monthlyEarnings: number
  pendingWithdraw: number
}

/**
 * useDistributionStats 配置选项
 */
export interface UseDistributionStatsOptions {
  /** 加载成功后回调*/
  onLoadSuccess?: (stats: DistributionStats, inviteLink: string) => void
}

/**
 * Distribution 统计数据管理 Composable
 *
 * @param options - 配置选项
 * @returns 返回统计数据状态和方法
 */
export function useDistributionStats(options: UseDistributionStatsOptions = {}) {
  const { onLoadSuccess } = options
  const { t } = useI18n()
  const { showError: showErrorMsg } = useOperationFeedback()

  // 统计数据
  const distributionStats = ref<DistributionStats>({
    totalEarnings: 0,
    totalInvites: 0,
    monthlyEarnings: 0,
    pendingWithdraw: 0,
  })

  // 邀请链接
  const inviteLink = ref('')

  // 加载状态
  const loading = ref(false)

  /**
   * 加载分销统计数据
   */
  const loadStats = async (): Promise<void> => {
    try {
      loading.value = true
      const [inviteCodeRes, statsRes] = await Promise.all([
        getInviteCode(),
        getDistributionStatistics(),
      ])

      if (inviteCodeRes.success && inviteCodeRes.data) {
        const code = inviteCodeRes.data.invite_code
        inviteLink.value = `https://ihui-agi-inf.com/invite?code=${code}`
      }

      if (statsRes.success && statsRes.data) {
        distributionStats.value = {
          totalEarnings: statsRes.data.totalEarnings || 0,
          totalInvites: statsRes.data.totalInvites || 0,
          monthlyEarnings: statsRes.data.monthlyEarnings || 0,
          pendingWithdraw: statsRes.data.pendingWithdraw || 0,
        }

        // 调用成功回调
        if (onLoadSuccess) {
          onLoadSuccess(distributionStats.value, inviteLink.value)
        }
      }
    } catch (error) {
      logger.error('[DistributionStats] Failed to load distribution statistics:', error)
      showErrorMsg(t('distribution.loadFailed'))
    } finally {
      loading.value = false
    }
  }

  return {
    // 状态
    distributionStats,
    inviteLink,
    loading,

    // 方法
    loadStats,
  }
}
