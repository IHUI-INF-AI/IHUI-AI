/**
 * API消费账单管理Composable
 */
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import {
  getBillingRecords,
  getBillingStats,
  getBillingTrend,
  exportBilling,
  type BillingRecord,
  type BillingStats,
  type BillingTrend,
} from '@/api/billing'
import { logger } from '@/utils/logger'

export function useBilling() {
  const { t } = useI18n()

  const records = ref<BillingRecord[]>([])
  const stats = ref<Partial<BillingStats>>({})
  const trend = ref<BillingTrend[]>([])
  const loading = ref(false)
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(20)

  // 筛选条件
  const filters = ref({
    startDate: '',
    endDate: '',
    appId: '',
    apiKeyId: '',
    model: '',
    status: '',
  })

  /**
   * 加载消费记录列表
   */
  const loadRecords = async () => {
    loading.value = true
    try {
      const response = await getBillingRecords({
        page: page.value,
        pageSize: pageSize.value,
        ...filters.value,
      })

      if (response.success && response.data) {
        records.value = response.data.list || []
        total.value = response.data.total || 0
      } else {
        ElMessage.error(response.message || t('common.loadFailed'))
      }
    } catch (error) {
      logger.error('Failed to load consumption records:', error)
      ElMessage.error(t('common.loadFailed'))
    } finally {
      loading.value = false
    }
  }

  /**
   * 加载费用统计
   */
  const loadStats = async () => {
    try {
      const response = await getBillingStats({
        startDate: filters.value.startDate,
        endDate: filters.value.endDate,
        appId: filters.value.appId || undefined,
      })

      if (response.success && response.data) {
        stats.value = response.data
      } else {
        logger.error('Failed to load fee statistics:', response.message)
      }
    } catch (error) {
      logger.error('Failed to load fee statistics:', error)
    }
  }

  /**
   * 加载消费趋势
   */
  const loadTrend = async (granularity: 'day' | 'week' | 'month' = 'day') => {
    try {
      const response = await getBillingTrend({
        startDate: filters.value.startDate,
        endDate: filters.value.endDate,
        granularity,
        appId: filters.value.appId || undefined,
      })

      if (response.success && response.data) {
        trend.value = response.data.list || []
      } else {
        logger.error('Failed to load consumption trend:', response.message)
      }
    } catch (error) {
      logger.error('Failed to load consumption trend:', error)
    }
  }

  /**
   * 导出账单
   */
  const handleExport = async (format: 'excel' | 'csv' = 'excel') => {
    try {
      const blob = await exportBilling({
        ...filters.value,
        format,
      })

      // 创建下载链接
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `api-billing-${new Date().toISOString().split('T')[0]}.${format === 'excel' ? 'xlsx' : 'csv'}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      ElMessage.success(t('apiService.billing.exportSuccess'))
    } catch (error) {
      logger.error('Failed to export bill:', error)
      ElMessage.error(t('apiService.billing.exportFailed'))
    }
  }

  /**
   * 分页变化处理
   */
  const handlePageChange = (newPage: number) => {
    page.value = newPage
    void loadRecords()
  }

  /**
   * 每页数量变化处理
   */
  const handlePageSizeChange = (newPageSize: number) => {
    pageSize.value = newPageSize
    page.value = 1
    void loadRecords()
  }

  /**
   * 筛选条件变化处理
   */
  const handleFilterChange = () => {
    page.value = 1
    void loadRecords()
    void loadStats()
    void loadTrend('day')
  }

  /**
   * 计算属性
   */
  const totalCost = computed(() => stats.value.totalCost || 0)
  const todayCost = computed(() => stats.value.todayCost || 0)
  const monthCost = computed(() => stats.value.monthCost || 0)

  return {
    records,
    stats,
    trend,
    loading,
    total,
    page,
    pageSize,
    filters,
    totalCost,
    todayCost,
    monthCost,
    loadRecords,
    loadStats,
    loadTrend,
    handleExport,
    handlePageChange,
    handlePageSizeChange,
    handleFilterChange,
  }
}
