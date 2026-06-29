/**
 * Distribution 邀请管理Composable
 *
 * 负责邀请列表的加载、搜索、筛选和分页
 *
 * @packageDocumentation
 */

import { ref, computed } from 'vue'
import { logger } from '@/utils/logger'
import { useI18n } from 'vue-i18n'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { getSubordinates, type SubordinateUser } from '@/api/distribution'
import { usePagination } from '@/composables/user/usePagination'

/**
 * useDistributionInvites 配置选项
 */
export interface UseDistributionInvitesOptions {
  /** 初始每页数量 */
  initialPageSize?: number
}

/**
 * Distribution 邀请管理Composable
 *
 * @param options - 配置选项
 * @returns 返回邀请列表状态和方法
 */
export function useDistributionInvites(options: UseDistributionInvitesOptions = {}) {
  const { initialPageSize = 20 } = options
  const { t } = useI18n()
  const { showError: showErrorMsg } = useOperationFeedback()

  // 邀请列表
  const allInvites = ref<SubordinateUser[]>([])
  const inviteRanking = ref<SubordinateUser[]>([])
  const recentInvites = ref<SubordinateUser[]>([])

  // 搜索和筛选
  const inviteSearch = ref('')
  const inviteStatusFilter = ref('')
  const inviteDateRange = ref<[string, string] | []>([])

  // 加载状态
  const loadingInvites = ref(false)

  // 分页
  const paginationComposable = usePagination({
    initialPage: 1,
    initialPageSize: initialPageSize,
  })

  /**
   * 加载邀请列表
   */
  const loadInvites = async (): Promise<void> => {
    try {
      loadingInvites.value = true
      const response = await getSubordinates({
        page: paginationComposable.pagination.page,
        quantity: paginationComposable.pagination.pageSize,
      })

      if (response.success && response.data) {
        allInvites.value = response.data.list || []
        paginationComposable.pagination.total =
          (response.data as { pagination?: { total?: number }; total?: number })?.pagination
            ?.total ||
          (response.data as { total?: number })?.total ||
          0

        // 更新最近邀请（取前3个）
        recentInvites.value = allInvites.value.slice(0, 3)

        // 更新邀请排行榜（按邀请数量排序，取前5个）
        inviteRanking.value = [...allInvites.value]
          .sort(
            (a, b) =>
              ((b as { invite_count?: number }).invite_count || 0) -
              ((a as { invite_count?: number }).invite_count || 0)
          )
          .slice(0, 5)
      }
    } catch (error) {
      logger.error('[DistributionInvites] Failed to load invitation list:', error)
      showErrorMsg(t('distribution.loadFailed'))
    } finally {
      loadingInvites.value = false
    }
  }

  /**
   * 处理邀请搜
   */
  const handleInviteSearch = (search: string): void => {
    inviteSearch.value = search
    paginationComposable.pagination.page = 1 // 重置到第一
  }

  /**
   * 处理邀请筛选
   */
  const handleInviteFilter = (status: string, dateRange: [string, string] | []): void => {
    inviteStatusFilter.value = status
    inviteDateRange.value = dateRange
    paginationComposable.pagination.page = 1 // 重置到第一
  }

  // 计算属性：筛选后的邀请列表
  const filteredInvites = computed(() => {
    let result: SubordinateUser[] = allInvites.value

    if (inviteSearch.value) {
      result = result.filter(
        invite =>
          invite.username?.includes(inviteSearch.value) ||
          invite.nickname?.includes(inviteSearch.value)
      )
    }

    return result
  })

  // 计算属性：分页后的邀请列表
  const paginatedInvites = computed(() => {
    const start =
      (paginationComposable.pagination.page - 1) * paginationComposable.pagination.pageSize
    const end = start + paginationComposable.pagination.pageSize
    return filteredInvites.value.slice(start, end)
  })

  // 计算属性：总佣金
  const totalCommission = computed(() => {
    return filteredInvites.value.reduce(
      (sum: number, invite: SubordinateUser) => sum + (invite.total_commission || 0),
      0
    )
  })

  return {
    // 状态
    allInvites,
    inviteRanking,
    recentInvites,
    inviteSearch,
    inviteStatusFilter,
    inviteDateRange,
    loadingInvites,
    pagination: paginationComposable,

    // 计算属性
    filteredInvites,
    paginatedInvites,
    totalCommission,

    // 方法
    loadInvites,
    handleInviteSearch,
    handleInviteFilter,
  }
}
