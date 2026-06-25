 
import { ref, reactive } from 'vue'
import { useAuthStore } from '@/stores/auth'
import type { UserInfoData } from '@/api/user/user'
import { getDeveloperList, createDeveloper } from '@/api/agent/agent-developer'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { logger } from '@/utils/logger'
import { formatTime } from '@/shared'
import { usePagination } from './usePagination'
import { useStatusFormatter } from './useStatusFormatter'

/**
 * 开发者续费记录接口
 */
export interface AgentDeveloper {
  id: string
  order_no: string
  user_name: string
  type: string
  count: number
  bug_time: string
  expiration_date: string
}

/**
 * 用户开发者相关功能的 Composable
 * 提供开发者续费记录的加载和提交功能
 *
 * @returns {Object} 返回开发者相关的状态和方法
 * @returns {Ref<AgentDeveloper[]>} returns.developerList - 开发者续费记录列表
 * @returns {Ref<boolean>} returns.developerLoading - 加载状态
 * @returns {Ref<boolean>} returns.showDeveloperDialog - 续费对话框显示状态
 * @returns {Reactive<Object>} returns.developerForm - 续费表单数据
 * @returns {Ref<boolean>} returns.developerSubmitting - 提交状态
 * @returns {Reactive<Object>} returns.developerPagination - 分页信息
 * @returns {Function} returns.loadDeveloperRecords - 加载开发者续费记录
 * @returns {Function} returns.handleSubmitDeveloper - 提交开发者续费
 * @returns {Function} returns.isExpired - 判断是否过期（来自 useStatusFormatter）
 */
export function useUserDeveloper() {
  const authStore = useAuthStore()
  const { handleResult: handleOperationResult, showError: showErrorMsg } = useOperationFeedback()
  const { isExpired } = useStatusFormatter()

  const developerList = ref<AgentDeveloper[]>([])
  const developerLoading = ref(false)
  const showDeveloperDialog = ref(false)
  const developerForm = reactive({
    type: '0', // 默认月
    count: 1,
  })
  const developerSubmitting = ref(false)

  // 加载开发者续费记录
  const loadDeveloperRecords = async (): Promise<void> => {
    const user = authStore.user as UserInfoData | null
    if (!user?.uuid) return
    developerLoading.value = true
    try {
      const response = await getDeveloperList({
        page: developerPagination.page,
        pageSize: developerPagination.pageSize,
        uuid: user.uuid,
      })
      if (response.code === 200 || response.success) {
         
         
        developerList.value = (response.data?.list || []) as any
        developerPagination.total = response.data?.pagination?.total || 0
      }
    } catch (error) {
      logger.error('Failed to load developer renewal records:', error)
    } finally {
      developerLoading.value = false
    }
  }

  // 使用公共分页 composable（需要在 loadDeveloperRecords 定义后）
  const {
    pagination: developerPagination,
    handlePageChange,
    handlePageSizeChange,
  } = usePagination({
    onPageChange: () => loadDeveloperRecords(),
    onPageSizeChange: () => loadDeveloperRecords(),
  })

  // 提交开发者续费
  const handleSubmitDeveloper = async (): Promise<void> => {
    const user = authStore.user as UserInfoData | null
    if (!user?.uuid) return
    if (!developerForm.count || developerForm.count <= 0) {
      showErrorMsg('请输入购买数量')
      return
    }

    developerSubmitting.value = true
    try {
      await handleOperationResult(
        createDeveloper({
          uuid: user.uuid,
          user_name: user.nickname || user.username,
          type: developerForm.type,
          count: developerForm.count,
        }),
        {
          successMessage: '续费记录创建成功',
          onSuccess: () => {
            showDeveloperDialog.value = false
            developerForm.type = '0'
            developerForm.count = 1
            void loadDeveloperRecords()
          },
        }
      )
    } finally {
      developerSubmitting.value = false
    }
  }

  // isExpired 已从 useStatusFormatter 获取

  return {
    developerList,
    developerLoading,
    showDeveloperDialog,
    developerForm,
    developerSubmitting,
    developerPagination,
    loadDeveloperRecords,
    handleSubmitDeveloper,
    isExpired,
    handlePageChange,
    handlePageSizeChange,
    formatTime,
  }
}
