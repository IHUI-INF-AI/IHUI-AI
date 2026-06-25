import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import type { UserInfoData } from '@/api/user/user'
import { getUserFavorites } from '@/api/agent/agent/agents'
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
 * 收藏项接口
 */
export interface FavoriteItem {
  favoriteId: string
  agentId: string
  agentName: string
  description?: string
  avatar?: string
  price?: number
  collectCount?: number
  downloadCount?: number
  status?: string
  favoriteTime: string
}

/**
 * 用户收藏相关功能的 Composable
 * 提供收藏列表的加载、搜索和跳转功能
 *
 * @returns {Object} 返回收藏相关的状态和方法
 * @returns {Ref<FavoriteItem[]>} returns.favorites - 收藏列表
 * @returns {Ref<boolean>} returns.favoritesLoading - 加载状态
 * @returns {Ref<string>} returns.favoritesSearch - 搜索关键词
 * @returns {Function} returns.loadFavorites - 加载收藏列表（防抖）
 * @returns {Function} returns.gotoAgentDetail - 跳转到智能体详情页
 */
export function useUserFavorites() {
  const router = useRouter()
  const route = useRoute()
  const authStore = useAuthStore()

  const favorites = ref<FavoriteItem[]>([])
  const favoritesLoading = ref(false)
  const favoritesSearch = ref('')

  // 性能优化：防抖搜索
  const debouncedLoadFavorites = useDebounceFn(async () => {
    const user = authStore.user as UserInfoData | null
    if (!user?.uuid) return
    const cacheKey = `favorites_${user.uuid}_${favoritesSearch.value}`
    const cached = getCachedData(cacheKey) as FavoriteItem[] | null
    if (cached && Array.isArray(cached)) {
      favorites.value = cached
      return
    }

    favoritesLoading.value = true
    cancelRequest('favorites')
    createAbortController('favorites')
    try {
      const user = authStore.user as UserInfoData
      const response = await getUserFavorites({
        uuid: user.uuid,
        search: favoritesSearch.value || undefined,
      })
      if (response.code === 200 || response.success === true) {
        const data = Array.isArray(response.data)
          ? response.data
          : (response.data as unknown as { list?: FavoriteItem[] })?.list || []
        favorites.value = data as FavoriteItem[]
        setCachedData(cacheKey, data)
      }
    } catch (error: any) {
      if (error instanceof Error && error.name !== 'AbortError') {
        logger.error('Failed to load favorites:', error)
      }
    } finally {
      favoritesLoading.value = false
    }
  }, 300)

  const loadFavorites = debouncedLoadFavorites

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
          logger.error('[UserFavorites] Failed to navigate to agent detail:', error, { agentId })
        }
      })
    } catch (error) {
      logger.error('[UserFavorites] Route navigation error:', error)
    }
  }

  return {
    favorites,
    favoritesLoading,
    favoritesSearch,
    loadFavorites,
    gotoAgentDetail,
    formatTime,
  }
}
