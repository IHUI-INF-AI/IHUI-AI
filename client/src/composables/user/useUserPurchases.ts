import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import type { UserInfoData } from '@/api/user'
import { getUserPurchasedAgents } from '@/api/agents'
import { logger } from '@/utils/logger'
import { formatTime } from '@/shared'
import { useDebounceFn } from '@vueuse/core'
import {
  cancelRequest,
  createAbortController,
  getCachedData,
  setCachedData,
} from '@/utils/resource-optimizer'

/**
 * 购买项接口
 */
export interface PurchasedItem {
  id: string
  userUuid: string
  agentId: string
  agentName: string
  agentAvatar?: string
  agentDescription?: string
  orderNo: string
  buyType?: number
  buyDuration?: number
  amount: number
  status: string
  expireTime?: string
  createdAt: string
  updatedAt: string
}

/**
 * 用户购买相关功能的 Composable
 * 提供购买列表的加载、搜索和跳转功能
 *
 * @returns {Object} 返回购买相关的状态和方法
 * @returns {Ref<PurchasedItem[]>} returns.purchases - 购买列表
 * @returns {Ref<boolean>} returns.purchasesLoading - 加载状态
 * @returns {Ref<string>} returns.purchasesSearch - 搜索关键词
 * @returns {Ref<string | null>} returns.purchasesDate - 日期筛选
 * @returns {Function} returns.loadPurchases - 加载购买列表（防抖）
 * @returns {Function} returns.gotoAgentDetail - 跳转到智能体详情页
 */
export function useUserPurchases() {
  const router = useRouter()
  const route = useRoute()
  const authStore = useAuthStore()

  const purchases = ref<PurchasedItem[]>([])
  const purchasesLoading = ref(false)
  const purchasesSearch = ref('')
  const purchasesDate = ref<string | '' | null>(null)

  // 性能优化：防抖搜索
  const debouncedLoadPurchases = useDebounceFn(async () => {
    const user = authStore.user as UserInfoData | null
    if (!user?.uuid) return
    const cacheKey = `purchases_${user.uuid}_${purchasesSearch.value}_${purchasesDate.value}`
    const cached = getCachedData(cacheKey) as PurchasedItem[] | null
    if (cached && Array.isArray(cached)) {
      purchases.value = cached
      return
    }

    purchasesLoading.value = true
    cancelRequest('purchases')
    createAbortController('purchases')
    try {
      const user = authStore.user as UserInfoData
      const response = await getUserPurchasedAgents({
        uuid: user.uuid,
        search: purchasesSearch.value || undefined,
        date: purchasesDate.value || undefined,
      })
      if (response.code === 200 || response.success === true) {
        const data = Array.isArray(response.data)
          ? response.data
          : (response.data as unknown as { list?: PurchasedItem[] })?.list || []
        purchases.value = data as PurchasedItem[]
        setCachedData(cacheKey, data)
      }
    } catch (error: any) {
      if (error instanceof Error && error.name !== 'AbortError') {
        logger.error('Failed to load purchase records:', error)
      }
    } finally {
      purchasesLoading.value = false
    }
  }, 300)

  const loadPurchases = debouncedLoadPurchases

  const gotoAgentDetail = async (agentId: string): Promise<void> => {
    if (!agentId) return

    try {
      const path = `/agents/${agentId}`
      // 如果已经在目标路由，不执行跳转
      if (route.path === path) {
        return
      }

      await router.push(path).catch(error => {
        // 忽略导航重复错误
        if (error.name !== 'NavigationDuplicated' && error.name !== 'NavigationRedirected') {
          logger.error('[UserPurchases] Failed to navigate to agent detail:', error, { agentId })
        }
      })
    } catch (error) {
      logger.error('[UserPurchases] Route navigation error:', error)
    }
  }

  return {
    purchases,
    purchasesLoading,
    purchasesSearch,
    purchasesDate,
    loadPurchases,
    gotoAgentDetail,
    formatTime,
  }
}
