/**
 * 应用管理Composable
 */
import { ref, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useI18n } from 'vue-i18n'
import {
  getApps,
  getApp,
  createApp,
  updateApp,
  deleteApp,
  getAppStats,
  type App,
  type CreateAppRequest,
  type UpdateAppRequest,
} from '@/api/apps'
import { logger } from '@/utils/logger'

export function useApps() {
  const { t } = useI18n()

  const apps = ref<App[]>([])
  const loading = ref(false)
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(10)
  const statusFilter = ref<string>('')

  /**
   * 加载应用列表
   */
  const loadApps = async () => {
    loading.value = true
    try {
      const response = await getApps({
        page: page.value,
        pageSize: pageSize.value,
        status: statusFilter.value || undefined,
      })

      if (response.success && response.data) {
        // 后端返回格式: { list: [], total: number }
        apps.value = response.data.list || []
        total.value = response.data.total || 0
      } else {
        ElMessage.error(response.message || t('common.loadFailed'))
      }
    } catch (error) {
      logger.error('Failed to load app list:', error)
      ElMessage.error(t('common.loadFailed'))
    } finally {
      loading.value = false
    }
  }

  /**
   * 创建应用
   */
  const handleCreateApp = async (data: CreateAppRequest) => {
    try {
      const response = await createApp(data)
      if (response.success && response.data) {
        ElMessage.success(t('apiService.apps.createSuccess'))
        await loadApps()
        return response.data
      } else {
        ElMessage.error(response.message || t('apiService.apps.createFailed'))
        return null
      }
    } catch (error) {
      logger.error('Failed to create app:', error)
      ElMessage.error(t('apiService.apps.createFailed'))
      return null
    }
  }

  /**
   * 更新应用
   */
  const handleUpdateApp = async (id: string, data: UpdateAppRequest) => {
    try {
      const response = await updateApp(id, data)
      if (response.success && response.data) {
        ElMessage.success(t('apiService.apps.updateSuccess'))
        await loadApps()
        return response.data
      } else {
        ElMessage.error(response.message || t('apiService.apps.updateFailed'))
        return null
      }
    } catch (error) {
      logger.error('Failed to update app:', error)
      ElMessage.error(t('apiService.apps.updateFailed'))
      return null
    }
  }

  /**
   * 删除应用
   */
  const handleDeleteApp = async (id: string, name: string) => {
    try {
      await ElMessageBox.confirm(
        t('apiService.apps.deleteConfirm', { name }),
        t('common.confirm'),
        {
          confirmButtonText: t('common.delete'),
          cancelButtonText: t('common.cancel'),
          type: 'warning',
        }
      )

      const response = await deleteApp(id)
      if (response.success) {
        ElMessage.success(t('apiService.apps.deleteSuccess'))
        await loadApps()
        return true
      } else {
        ElMessage.error(response.message || t('apiService.apps.deleteFailed'))
        return false
      }
    } catch (error) {
      if (error !== 'cancel') {
        logger.error('Failed to delete app:', error)
        ElMessage.error(t('apiService.apps.deleteFailed'))
      }
      return false
    }
  }

  /**
   * 获取应用详情
   */
  const loadAppDetail = async (id: string) => {
    try {
      const response = await getApp(id)
      if (response.success && response.data) {
        return response.data
      } else {
        ElMessage.error(response.message || t('common.loadFailed'))
        return null
      }
    } catch (error) {
      logger.error('Failed to load app detail:', error)
      ElMessage.error(t('common.loadFailed'))
      return null
    }
  }

  /**
   * 获取应用统计
   */
  const loadAppStats = async (id: string, params?: {
    startDate?: string
    endDate?: string
  }) => {
    try {
      const response = await getAppStats(id, params)
      if (response.success && response.data) {
        return response.data
      } else {
        ElMessage.error(response.message || t('common.loadFailed'))
        return null
      }
    } catch (error) {
      logger.error('Failed to load app statistics:', error)
      ElMessage.error(t('common.loadFailed'))
      return null
    }
  }

  /**
   * 分页变化处理
   */
  const handlePageChange = (newPage: number) => {
    page.value = newPage
    void loadApps()
  }

  /**
   * 每页数量变化处理
   */
  const handlePageSizeChange = (newPageSize: number) => {
    pageSize.value = newPageSize
    page.value = 1
    void loadApps()
  }

  /**
   * 状态筛选变化处理
   */
  const handleStatusFilterChange = (newStatus: string) => {
    statusFilter.value = newStatus
    page.value = 1
    void loadApps()
  }

  /**
   * 计算属性
   */
  const activeAppsCount = computed(() => {
    return apps.value.filter(app => app.status === 'active').length
  })

  const totalRequests = computed(() => {
    return apps.value.reduce((sum, app) => sum + app.requestCount, 0)
  })

  return {
    apps,
    loading,
    total,
    page,
    pageSize,
    statusFilter,
    activeAppsCount,
    totalRequests,
    loadApps,
    handleCreateApp,
    handleUpdateApp,
    handleDeleteApp,
    loadAppDetail,
    loadAppStats,
    handlePageChange,
    handlePageSizeChange,
    handleStatusFilterChange,
  }
}
