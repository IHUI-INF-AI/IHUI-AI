/**
 * 套餐管理Composable
 */
import { ref, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useI18n } from 'vue-i18n'
import {
  getPackages,
  getPackage,
  getPackageUsage,
  upgradePackage,
  downgradePackage,
  type Package,
} from '@/api/packages'
import { logger } from '@/utils/logger'

export function usePackages() {
  const { t } = useI18n()

  const packages = ref<Package[]>([])
  const loading = ref(false)
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(10)
  const statusFilter = ref<string>('')

  /**
   * 加载套餐列表
   */
  const loadPackages = async () => {
    loading.value = true
    try {
      const response = await getPackages({
        page: page.value,
        pageSize: pageSize.value,
        status: statusFilter.value || undefined,
      })

      if (response.success && response.data) {
        // 后端返回格式: { list: [], total: number }
        packages.value = response.data.list || []
        total.value = response.data.total || 0
      } else {
        ElMessage.error(response.message || t('common.loadFailed'))
      }
    } catch (error) {
      logger.error('Failed to load package list:', error)
      ElMessage.error(t('common.loadFailed'))
    } finally {
      loading.value = false
    }
  }

  /**
   * 获取套餐详情
   */
  const loadPackageDetail = async (id: string) => {
    try {
      const response = await getPackage(id)
      if (response.success && response.data) {
        return response.data
      } else {
        ElMessage.error(response.message || t('common.loadFailed'))
        return null
      }
    } catch (error) {
      logger.error('Failed to load package detail:', error)
      ElMessage.error(t('common.loadFailed'))
      return null
    }
  }

  /**
   * 获取套餐使用情况
   */
  const loadPackageUsageData = async (
    id: string,
    params?: {
      startDate?: string
      endDate?: string
    }
  ) => {
    try {
      const response = await getPackageUsage(id, params)
      if (response.success && response.data) {
        return response.data
      } else {
        ElMessage.error(response.message || t('common.loadFailed'))
        return null
      }
    } catch (error) {
      logger.error('Failed to load package usage:', error)
      ElMessage.error(t('common.loadFailed'))
      return null
    }
  }

  /**
   * 升级套餐
   */
  const handleUpgradePackage = async (
    packageId: string,
    targetPackageId: string
  ) => {
    try {
      const response = await upgradePackage(packageId, targetPackageId)
      if (response.success && response.data) {
        ElMessage.success(t('apiService.packages.upgradeSuccess'))
        await loadPackages()
        return response.data
      } else {
        ElMessage.error(response.message || t('apiService.packages.upgradeFailed'))
        return null
      }
    } catch (error) {
      logger.error('Failed to upgrade package:', error)
      ElMessage.error(t('apiService.packages.upgradeFailed'))
      return null
    }
  }

  /**
   * 降级套餐
   */
  const handleDowngradePackage = async (
    packageId: string,
    targetPackageId: string
  ) => {
    try {
      await ElMessageBox.confirm(
        t('apiService.packages.downgradeConfirm'),
        t('common.confirm'),
        {
          confirmButtonText: t('common.confirm'),
          cancelButtonText: t('common.cancel'),
          type: 'warning',
        }
      )

      const response = await downgradePackage(packageId, targetPackageId)
      if (response.success && response.data) {
        ElMessage.success(t('apiService.packages.downgradeSuccess'))
        await loadPackages()
        return response.data
      } else {
        ElMessage.error(response.message || t('apiService.packages.downgradeFailed'))
        return null
      }
    } catch (error) {
      if (error !== 'cancel') {
        logger.error('Failed to downgrade package:', error)
        ElMessage.error(t('apiService.packages.downgradeFailed'))
      }
      return null
    }
  }

  /**
   * 分页变化处理
   */
  const handlePageChange = (newPage: number) => {
    page.value = newPage
    void loadPackages()
  }

  /**
   * 每页数量变化处理
   */
  const handlePageSizeChange = (newPageSize: number) => {
    pageSize.value = newPageSize
    page.value = 1
    void loadPackages()
  }

  /**
   * 状态筛选变化处理
   */
  const handleStatusFilterChange = (newStatus: string) => {
    statusFilter.value = newStatus
    page.value = 1
    void loadPackages()
  }

  /**
   * 计算属性
   */
  const activePackagesCount = computed(() => {
    return packages.value.filter(pkg => pkg.status === 'active').length
  })

  const totalQuota = computed(() => {
    return packages.value.reduce((sum, pkg) => sum + pkg.quota, 0)
  })

  const totalUsedQuota = computed(() => {
    return packages.value.reduce((sum, pkg) => sum + pkg.usedQuota, 0)
  })

  const usageRate = computed(() => {
    if (totalQuota.value === 0) return 0
    return (totalUsedQuota.value / totalQuota.value) * 100
  })

  return {
    packages,
    loading,
    total,
    page,
    pageSize,
    statusFilter,
    activePackagesCount,
    totalQuota,
    totalUsedQuota,
    usageRate,
    loadPackages,
    loadPackageDetail,
    loadPackageUsageData,
    handleUpgradePackage,
    handleDowngradePackage,
    handlePageChange,
    handlePageSizeChange,
    handleStatusFilterChange,
  }
}
