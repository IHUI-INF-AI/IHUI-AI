/**
 * 应用分组管理Composable
 */
import { ref, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useI18n } from 'vue-i18n'
import {
  getGroups,
  getGroup,
  createGroup,
  updateGroup,
  deleteGroup,
  getGroupApps,
  type ApiGroup,
  type CreateGroupRequest,
  type UpdateGroupRequest,
} from '@/api/groups'
import { logger } from '@/utils/logger'

export function useGroups() {
  const { t } = useI18n()

  const groups = ref<ApiGroup[]>([])
  const loading = ref(false)
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(10)
  const typeFilter = ref<string>('')
  const statusFilter = ref<string>('')

  /**
   * 加载分组列表
   */
  const loadGroups = async () => {
    loading.value = true
    try {
      const response = await getGroups({
        page: page.value,
        pageSize: pageSize.value,
        type: typeFilter.value || undefined,
        status: statusFilter.value || undefined,
      })

      if (response.success && response.data) {
        groups.value = response.data.list || (response.data as { items?: any[] }).items || []
        total.value = response.data.total || 0
      } else {
        ElMessage.error(response.message || t('common.loadFailed'))
      }
    } catch (error) {
      logger.error('Failed to load group list:', error)
      ElMessage.error(t('common.loadFailed'))
    } finally {
      loading.value = false
    }
  }

  /**
   * 创建分组
   */
  const handleCreateGroup = async (data: CreateGroupRequest) => {
    try {
      const response = await createGroup(data)
      if (response.success && response.data) {
        ElMessage.success(t('apiService.groups.createSuccess'))
        await loadGroups()
        return response.data
      } else {
        ElMessage.error(response.message || t('apiService.groups.createFailed'))
        return null
      }
    } catch (error) {
      logger.error('Failed to create group:', error)
      ElMessage.error(t('apiService.groups.createFailed'))
      return null
    }
  }

  /**
   * 更新分组
   */
  const handleUpdateGroup = async (id: string, data: UpdateGroupRequest) => {
    try {
      const response = await updateGroup(id, data)
      if (response.success && response.data) {
        ElMessage.success(t('apiService.groups.updateSuccess'))
        await loadGroups()
        return response.data
      } else {
        ElMessage.error(response.message || t('apiService.groups.updateFailed'))
        return null
      }
    } catch (error) {
      logger.error('Failed to update group:', error)
      ElMessage.error(t('apiService.groups.updateFailed'))
      return null
    }
  }

  /**
   * 删除分组
   */
  const handleDeleteGroup = async (id: string, name: string) => {
    try {
      await ElMessageBox.confirm(
        t('apiService.groups.deleteConfirm', { name }),
        t('common.confirm'),
        {
          confirmButtonText: t('common.delete'),
          cancelButtonText: t('common.cancel'),
          type: 'warning',
        }
      )

      const response = await deleteGroup(id)
      if (response.success) {
        ElMessage.success(t('apiService.groups.deleteSuccess'))
        await loadGroups()
        return true
      } else {
        ElMessage.error(response.message || t('apiService.groups.deleteFailed'))
        return false
      }
    } catch (error) {
      if (error !== 'cancel') {
        logger.error('Failed to delete group:', error)
        ElMessage.error(t('apiService.groups.deleteFailed'))
      }
      return false
    }
  }

  /**
   * 获取分组详情
   */
  const loadGroupDetail = async (id: string) => {
    try {
      const response = await getGroup(id)
      if (response.success && response.data) {
        return response.data
      } else {
        ElMessage.error(response.message || t('common.loadFailed'))
        return null
      }
    } catch (error) {
      logger.error('Failed to load group detail:', error)
      ElMessage.error(t('common.loadFailed'))
      return null
    }
  }

  /**
   * 获取分组下的应用列表
   */
  const loadGroupApps = async (id: string, params?: {
    page?: number
    pageSize?: number
  }) => {
    try {
      const response = await getGroupApps(id, params)
      if (response.success && response.data) {
        return response.data
      } else {
        ElMessage.error(response.message || t('common.loadFailed'))
        return null
      }
    } catch (error) {
      logger.error('Failed to load group app list:', error)
      ElMessage.error(t('common.loadFailed'))
      return null
    }
  }

  /**
   * 分页变化处理
   */
  const handlePageChange = (newPage: number) => {
    page.value = newPage
    void loadGroups()
  }

  /**
   * 每页数量变化处理
   */
  const handlePageSizeChange = (newPageSize: number) => {
    pageSize.value = newPageSize
    page.value = 1
    void loadGroups()
  }

  /**
   * 类型筛选变化处理
   */
  const handleTypeFilterChange = (newType: string) => {
    typeFilter.value = newType
    page.value = 1
    void loadGroups()
  }

  /**
   * 状态筛选变化处理
   */
  const handleStatusFilterChange = (newStatus: string) => {
    statusFilter.value = newStatus
    page.value = 1
    void loadGroups()
  }

  /**
   * 计算属性
   */
  const activeGroupsCount = computed(() => {
    return groups.value.filter(group => group.status === 'active').length
  })

  const totalAppCount = computed(() => {
    return groups.value.reduce((sum, group) => sum + group.appCount, 0)
  })

  return {
    groups,
    loading,
    total,
    page,
    pageSize,
    typeFilter,
    statusFilter,
    activeGroupsCount,
    totalAppCount,
    loadGroups,
    handleCreateGroup,
    handleUpdateGroup,
    handleDeleteGroup,
    loadGroupDetail,
    loadGroupApps,
    handlePageChange,
    handlePageSizeChange,
    handleTypeFilterChange,
    handleStatusFilterChange,
  }
}
