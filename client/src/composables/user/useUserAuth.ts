/**
 * User 认证和初始化 Composable
 *
 * 负责用户中心的认证检查、用户信息获取和初始化逻辑
 *
 * @packageDocumentation
 */

import { onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { StorageManager, STORAGE_KEYS } from '@/utils/storage'
import { logger } from '@/utils/logger'

/**
 * useUserAuth 配置选项
 */
export interface UseUserAuthOptions {
  /** 是否自动重定向到登录页（默认 true） */
  redirectToLogin?: boolean
  /** 重定向路径（默认 '/login'） */
  redirectPath?: string
}

/**
 * 验证重定向URL是否安全
 * 防止开放重定向攻击
 */
function isValidRedirect(redirect: string): boolean {
  if (!redirect.startsWith('/')) return false
  if (redirect.startsWith('//')) return false
  if (redirect.includes('\\')) return false
  if (redirect.toLowerCase().startsWith('javascript:')) return false
  if (redirect.toLowerCase().startsWith('data:')) return false
  if (redirect.includes('\n') || redirect.includes('\r')) return false
  return true
}

/**
 * 获取安全的重定向路径
 */
function getSafeRedirect(redirect: string | null | undefined): string {
  if (!redirect) return '/'
  if (isValidRedirect(redirect)) {
    return redirect
  }
  logger.warn('[Security] Suspicious redirect attempt detected', { redirect })
  return '/'
}

/**
 * User 认证和初始化 Composable
 *
 * @param options - 配置选项
 * @returns 返回认证状态和方法
 */
export function useUserAuth(options: UseUserAuthOptions = {}) {
  const { redirectToLogin = true, redirectPath = '/login' } = options

  const authStore = useAuthStore()
  const router = useRouter()
  const { showError: showErrorMsg } = useOperationFeedback()

  /**
   * 检查登录状态
   */
  const checkAuth = (): boolean => {
    return !!(authStore.isLoggedIn && authStore.token)
  }

  /**
   * 获取用户信息
   */
  const fetchUserInfo = async (): Promise<boolean> => {
    if (!authStore.token) {
      return false
    }

    if (authStore.user) {
      return true
    }

    try {
      const store = authStore as ReturnType<typeof useAuthStore> & {
        fetchUserInfo: () => Promise<void>
      }
      await store.fetchUserInfo()

      if (!authStore.user) {
        logger.error('[UserAuth] Still no user data after getting user info, token may be invalid')
        showErrorMsg('获取用户信息失败，请重新登录')
        return false
      }

      return true
    } catch (error) {
      logger.error('[UserAuth] Failed to get user info:', error)
      showErrorMsg('获取用户信息失败，但您可以继续使用')

      if (!authStore.user) {
        const storedData = StorageManager.getItem<unknown>(STORAGE_KEYS.USER_DATA)
        if (storedData) {
          // 已有存储的用户数据，可以考虑恢复到 store 中
          // 但当前实现选择不自动恢复，避免数据不一致
        }
      }

      return false
    }
  }

  /**
   * 初始化用户中心
   */
  const initialize = async (): Promise<boolean> => {
    if (!checkAuth()) {
      if (redirectToLogin) {
        const safePath = getSafeRedirect(redirectPath)
        void router.replace(safePath)
      }
      return false
    }

    if (!authStore.user) {
      const success = await fetchUserInfo()
      if (!success && redirectToLogin) {
        const safePath = getSafeRedirect(redirectPath)
        void router.replace(safePath)
        return false
      }
    }

    return true
  }

  // 自动初始化
  onMounted(() => {
    void initialize()
  })

  return {
    // 状态
    isAuthenticated: computed(() => checkAuth()),
    user: computed(() => authStore.user),

    // 方法
    checkAuth,
    fetchUserInfo,
    initialize,
  }
}
