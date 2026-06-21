import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import type { UserInfoData } from '@/api/user'
import {
  getAgentExamineList,
  getAgentExamineDetail,
  updateAgentExamine,
  type AgentExamine,
} from '@/api/agent-examine'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { logger } from '@/utils/logger'
import { formatTime } from '@/shared'
import { useDebounceFn } from '@vueuse/core'
import {
  cancelRequest,
  createAbortController,
  getCachedData,
  setCachedData,
} from '@/utils/resource-optimizer'

export interface MyExamineItem {
  id: string
  agent_id: string
  agent_name: string
  start_user: string
  start_name: string
  category_id?: string
  prologue?: string
  status: number
  created_at: string
}

/**
 * 审核详情接口
 */
export interface ExamineDetail {
  id: string
  status: number
  desc?: string
  [key: string]: string | number | undefined
}

/**
 * 用户审核相关功能的 Composable
 * 提供智能体审核列表的加载、详情查看和操作功能
 *
 * @returns {Object} 返回审核相关的状态和方法
 * @returns {Ref<MyExamineItem[]>} returns.examineList - 审核列表
 * @returns {Ref<boolean>} returns.examineLoading - 加载状态
 * @returns {Ref<string>} returns.examineSearch - 搜索关键词
 * @returns {Ref<boolean>} returns.examineDetailVisible - 详情对话框显示状态
 * @returns {Ref<ExamineDetail | null>} returns.examineDetail - 审核详情
 * @returns {Function} returns.loadExamineList - 加载审核列表（防抖）
 * @returns {Function} returns.handleViewDetail - 查看审核详情
 * @returns {Function} returns.handleApprove - 批准审核
 * @returns {Function} returns.handleReject - 拒绝审核
 */
export function useUserExamine() {
  const { t } = useI18n()
  const router = useRouter()
  const authStore = useAuthStore()
  const { handleResult: handleOperationResult } = useOperationFeedback()

  const examineList = ref<MyExamineItem[]>([])
  const examineLoading = ref(false)
  const examineSearch = ref('')
  const examineDetailVisible = ref(false)
  const examineDetail = ref<ExamineDetail | null>(null)
  const examineRemark = ref('')
  const examineUpdating = ref(false)

  // 性能优化：防抖搜索
  const debouncedLoadMyExamine = useDebounceFn(async () => {
    const user = authStore.user as UserInfoData | null
    if (!user?.uuid) return
    const cacheKey = `examine_${user.uuid}_${examineSearch.value}`
    const cached = getCachedData(cacheKey) as MyExamineItem[] | null
    if (cached && Array.isArray(cached)) {
      examineList.value = cached
      return
    }

    examineLoading.value = true
    cancelRequest('examine')
    createAbortController('examine')
    try {
      const user = authStore.user as UserInfoData
      const res = await getAgentExamineList({
        page: 1,
        pageSize: 20,
        keyword: examineSearch.value || undefined, // 使用 keyword 而不是 search
        start_user: user.uuid,
      })
      if (res.code === 200 || res.success) {
        const data = Array.isArray(res.data)
          ? res.data
          : (res.data as { agents?: MyExamineItem[] })?.agents || []
        examineList.value = data as MyExamineItem[]
        setCachedData(cacheKey, data)
      }
    } catch (error: any) {
      if (error instanceof Error && error.name !== 'AbortError') {
        logger.error('Failed to load examine list:', error)
      }
    } finally {
      examineLoading.value = false
    }
  }, 300)

  const loadMyExamine = debouncedLoadMyExamine

  const openExamineDetail = async (id: string): Promise<void> => {
    const res = await getAgentExamineDetail(id)
    if (res.code === 200 || res.success) {
      const data = res.data as AgentExamine
      examineDetail.value = {
        id: data.id,
        status: data.status,
        desc: data.desc,
        ...Object.fromEntries(
          Object.entries(data).map(([key, value]) => [
            key,
            typeof value === 'string' || typeof value === 'number' ? value : String(value),
          ])
        ),
      } as ExamineDetail
      examineDetailVisible.value = true
    }
  }

  const handleExamineApprove = async (): Promise<void> => {
    if (!examineDetail.value) return
    examineUpdating.value = true
    try {
      await handleOperationResult(
        updateAgentExamine(examineDetail.value.id, {
          status: 2,
          desc: examineRemark.value || undefined,
        }),
        {
          successMessage: t('user.messages.examineApproveSuccess'),
          onSuccess: () => {
            examineDetailVisible.value = false
            void loadMyExamine()
          },
        }
      )
    } finally {
      examineUpdating.value = false
    }
  }

  const handleExamineReject = async (): Promise<void> => {
    if (!examineDetail.value) return
    examineUpdating.value = true
    try {
      await handleOperationResult(
        updateAgentExamine(examineDetail.value.id, {
          status: 3,
          desc: examineRemark.value || undefined,
        }),
        {
          successMessage: t('user.messages.examineRejectSuccess'),
          onSuccess: () => {
            examineDetailVisible.value = false
            void loadMyExamine()
          },
        }
      )
    } finally {
      examineUpdating.value = false
    }
  }

  const gotoAgentDetail = async (agentId: string): Promise<void> => {
    if (!agentId) return

    try {
      const path = `/agents/${agentId}`
      await router.push(path).catch(error => {
        // 忽略导航重复错误
        if (error.name !== 'NavigationDuplicated' && error.name !== 'NavigationRedirected') {
          logger.error('[UserExamine] Failed to navigate to agent detail:', error, { agentId })
        }
      })
    } catch (error) {
      logger.error('[UserExamine] Route navigation error:', error)
    }
  }

  return {
    examineList,
    examineLoading,
    examineSearch,
    examineDetailVisible,
    examineDetail,
    examineRemark,
    examineUpdating,
    loadMyExamine,
    openExamineDetail,
    handleExamineApprove,
    handleExamineReject,
    gotoAgentDetail,
    formatTime,
  }
}
