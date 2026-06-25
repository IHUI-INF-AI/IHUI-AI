 
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import type { UserInfoData } from '@/api/user/user'
import { getAgentBuyList } from '@/api/agent/agent/agent-buy'
import { logger } from '@/utils/logger'
import { formatTime } from '@/shared'
import { useDebounceFn } from '@vueuse/core'
import { usePagination } from './usePagination'
import { useStatusFormatter } from './useStatusFormatter'

/**
 * 购买记录接口
 */
export interface PurchaseRecord {
  id: string
  agent_name: string
  order_no: string
  real_price: number
  discount: number
  count: number
  bug_time: string
  expiration_date?: string
  status?: string
  settlement?: string
}

/**
 * 用户购买记录相关功能的 Composable
 * 提供购买记录列表的加载、搜索和状态处理功能
 *
 * @returns {Object} 返回购买记录相关的状态和方法
 * @returns {Ref<PurchaseRecord[]>} returns.purchaseRecordsList - 购买记录列表
 * @returns {Ref<boolean>} returns.purchaseRecordsLoading - 加载状态
 * @returns {Ref<string>} returns.purchaseRecordsSearch - 搜索关键词
 * @returns {Reactive<Object>} returns.purchaseRecordsPagination - 分页信息
 * @returns {Function} returns.loadPurchaseRecords - 加载购买记录（防抖）
 * @returns {Function} returns.getOrderStatusText - 获取订单状态文本
 * @returns {Function} returns.getOrderStatusType - 获取订单状态标签类型
 * @returns {Function} returns.isExpired - 判断是否过期（来自 useStatusFormatter）
 * @returns {Function} returns.formatTime - 格式化时间（来自工具函数）
 */
export function useUserPurchaseRecords() {
  const authStore = useAuthStore()
  const { isExpired } = useStatusFormatter()

  const purchaseRecordsList = ref<PurchaseRecord[]>([])
  const purchaseRecordsLoading = ref(false)
  const purchaseRecordsSearch = ref('')

  // 加载购买记录
  const loadPurchaseRecords = async (): Promise<void> => {
    const user = authStore.user as UserInfoData | null
    if (!user?.uuid) return
    purchaseRecordsLoading.value = true
    try {
      const response = await getAgentBuyList({
        page: purchaseRecordsPagination.page,
        pageSize: purchaseRecordsPagination.pageSize,
        buy_uuid: user.uuid,
        // ⚠️ 注意：getAgentBuyList 的参数中没有 agent_name，可能需要使用其他字段或后端支持
        // 暂时移除 agent_name 参数
      })
      if (response.code === 200 || response.success) {
        purchaseRecordsList.value = (response.data?.list || []) as any
        purchaseRecordsPagination.total = response.data?.pagination?.total || 0
      }
    } catch (error) {
      logger.error('Failed to load purchase records:', error)
    } finally {
      purchaseRecordsLoading.value = false
    }
  }

  // 防抖加载（使用 VueUse 的 useDebounceFn）
  const debouncedLoadPurchaseRecords = useDebounceFn(loadPurchaseRecords, 300)

  // 使用公共分页 composable（需要在 loadPurchaseRecords 定义后）
  const {
    pagination: purchaseRecordsPagination,
    handlePageChange,
    handlePageSizeChange,
  } = usePagination({
    onPageChange: () => loadPurchaseRecords(),
    onPageSizeChange: () => loadPurchaseRecords(),
  })

  // 使用公共状态格式化 composable
  const { getStatusText, getStatusType } = useStatusFormatter()

  // 订单状态映射
  const orderStatusMap: Record<string, string> = {
    '0': '待支付',
    '1': '已支付',
    '2': '已取消',
  }

  const orderStatusTypeMap: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
    '0': 'warning',
    '1': 'success',
    '2': 'info',
  }

  // 获取订单状态文本
  const getOrderStatusText = (status?: string): string => {
    return getStatusText(status, orderStatusMap)
  }

  // 获取订单状态标签类型
  const getOrderStatusType = (status?: string): string => {
    return getStatusType(status, orderStatusTypeMap)
  }

  return {
    purchaseRecordsList,
    purchaseRecordsLoading,
    purchaseRecordsSearch,
    purchaseRecordsPagination,
    loadPurchaseRecords,
    debouncedLoadPurchaseRecords,
    getOrderStatusText,
    getOrderStatusType,
    isExpired,
    handlePageChange,
    handlePageSizeChange,
    formatTime,
  }
}
