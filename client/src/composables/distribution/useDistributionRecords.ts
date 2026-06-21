/**
 * Distribution 收益记录管理 Composable
 *
 * 负责收益记录的加载、筛选和分页
 *
 * @packageDocumentation
 */

import { ref, computed } from 'vue'
import { logger } from '@/utils/logger'
import { useI18n } from 'vue-i18n'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { getCommissionFlow, type CommissionFlow } from '@/api/distribution'
import { usePagination } from '@/composables/user/usePagination'

/**
 * useDistributionRecords 配置选项
 */
export interface UseDistributionRecordsOptions {
  /** 初始每页数量 */
  initialPageSize?: number
}

/**
 * Distribution 收益记录管理 Composable
 *
 * @param options - 配置选项
 * @returns 返回收益记录状态和方法
 */
export function useDistributionRecords(options: UseDistributionRecordsOptions = {}) {
  const { initialPageSize = 20 } = options
  const { t } = useI18n()
  const { showError: showErrorMsg } = useOperationFeedback()

  // 收益记录列表
  const allRecords = ref<CommissionFlow[]>([])

  // 筛选
  const recordTypeFilter = ref('')
  const recordDateRange = ref<[string, string] | []>([])

  // 加载状态
  const loadingRecords = ref(false)

  // 分页
  const paginationComposable = usePagination({
    initialPage: 1,
    initialPageSize: initialPageSize,
  })

  /**
   * 加载佣金流水
   */
  const loadRecords = async (): Promise<void> => {
    try {
      loadingRecords.value = true
      const response = await getCommissionFlow({
        page: paginationComposable.pagination.page,
        page_size: paginationComposable.pagination.pageSize,
        status: recordTypeFilter.value ? Number(recordTypeFilter.value) : undefined,
        // 注意：getCommissionFlow API目前不支持startDate和endDate参数，需要后端支付
      })

      if (response.success && response.data) {
        allRecords.value = response.data.list || []
        paginationComposable.pagination.total =
          (response.data as { pagination?: { total?: number }; total?: number })?.pagination
            ?.total ||
          (response.data as { total?: number })?.total ||
          0
      }
    } catch (error) {
      logger.error('[DistributionRecords] Failed to load commission records:', error)
      showErrorMsg(t('distribution.loadFailed'))
    } finally {
      loadingRecords.value = false
    }
  }

  /**
   * 处理记录筛选
   */
  const handleRecordFilter = (type: string, dateRange: [string, string] | []): void => {
    recordTypeFilter.value = type
    recordDateRange.value = dateRange
    paginationComposable.pagination.page = 1 // 重置到第一
  }

  // 计算属性：筛选后的记录列表
  const filteredRecords = computed(() => {
    let result: CommissionFlow[] = allRecords.value

    if (recordTypeFilter.value) {
      result = result.filter(record => {
        const recordType = record.order_type?.toString() || record.commission_type?.toString()
        return recordType === recordTypeFilter.value
      })
    }

    return result
  })

  // 计算属性：分页后的记录列表
  const paginatedRecords = computed(() => {
    const start =
      (paginationComposable.pagination.page - 1) * paginationComposable.pagination.pageSize
    const end = start + paginationComposable.pagination.pageSize
    return filteredRecords.value.slice(start, end)
  })

  return {
    // 状态
    allRecords,
    recordTypeFilter,
    recordDateRange,
    loadingRecords,
    pagination: paginationComposable,

    // 计算属性
    filteredRecords,
    paginatedRecords,

    // 方法
    loadRecords,
    handleRecordFilter,
  }
}
