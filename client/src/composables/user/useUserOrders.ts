import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { getOrders, type Order } from '@/api/payment/orders'
import { useApiError } from '@/composables/useApiError'
import { formatTime } from '@/shared'
import { usePagination } from './usePagination'
import { useStatusFormatter } from './useStatusFormatter'

/**
 * 用户订单相关功能的 Composable
 * 提供订单列表的加载、查看详情和状态处理功能
 *
 * @returns {Object} 返回订单相关的状态和方法
 * @returns {Ref<Order[]>} returns.ordersList - 订单列表（别名：orders）
 * @returns {Ref<boolean>} returns.ordersLoading - 加载状态
 * @returns {Ref<string>} returns.ordersSearch - 搜索关键词
 * @returns {Reactive<Object>} returns.ordersPagination - 分页信息
 * @returns {Function} returns.loadOrders - 加载订单列表
 * @returns {Function} returns.handleViewOrder - 查看订单详情
 * @returns {Function} returns.getOrderTypeText - 获取订单类型文本
 * @returns {Function} returns.getOrderStatusText - 获取订单状态文本
 * @returns {Function} returns.getOrderStatusType - 获取订单状态标签类型
 */
export function useUserOrders() {
  const { t } = useI18n()
  const router = useRouter()
  const { handleError } = useApiError()
  const { getStatusText, getStatusType } = useStatusFormatter()

  const orders = ref<Order[]>([])
  const ordersLoading = ref(false)

  // 加载订单
  const loadOrders = async (): Promise<void> => {
    ordersLoading.value = true
    try {
      const response = await getOrders({
        page: ordersPagination.page,
        pageSize: ordersPagination.pageSize,
      })
      if (response.code === 200 || response.success) {
        orders.value = response.data?.items || []
        ordersPagination.total = response.data?.total || 0
      }
    } catch (error) {
      // 静默失败，不显示错误消息
      handleError(error, { showMessage: false })
    } finally {
      ordersLoading.value = false
    }
  }

  // 使用公共分页 composable（需要在 loadOrders 定义后）
  const {
    pagination: ordersPagination,
    handlePageChange,
    handlePageSizeChange,
  } = usePagination({
    onPageChange: () => loadOrders(),
    onPageSizeChange: () => loadOrders(),
  })

  // 查看订单详情
  const handleViewOrder = (orderId: string): void => {
    void router.push(`/orders/${orderId}`)
  }

  // 订单类型映射
  const orderTypeMap: Record<string, string> = {
    recharge: t('user.messages.orderType.recharge'),
    consumption: t('user.messages.orderType.consumption'),
    refund: t('user.messages.orderType.refund'),
    withdraw: t('user.messages.orderType.withdraw'),
  }

  // 订单状态映射
  const orderStatusMap: Record<string, string> = {
    pending: t('user.messages.orderStatus.pending'),
    processing: t('user.messages.orderStatus.processing'),
    completed: t('user.messages.orderStatus.completed'),
    failed: t('user.messages.orderStatus.failed'),
    cancelled: t('user.messages.orderStatus.cancelled'),
  }

  const orderStatusTypeMap: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
    pending: 'warning',
    processing: 'info',
    completed: 'success',
    failed: 'danger',
    cancelled: 'info',
  }

  // 订单类型文本
  const getOrderTypeText = (type: string): string => {
    return orderTypeMap[type] || type
  }

  // 订单状态文本
  const getOrderStatusText = (status: string): string => {
    return getStatusText(status, orderStatusMap) || status
  }

  // 订单状态类型
  const getOrderStatusType = (status: string): string => {
    return getStatusType(status, orderStatusTypeMap)
  }

  return {
    orders,
    ordersLoading,
    ordersPagination,
    loadOrders,
    handleViewOrder,
    getOrderTypeText,
    getOrderStatusText,
    getOrderStatusType,
    handlePageChange,
    handlePageSizeChange,
    formatTime,
  }
}
