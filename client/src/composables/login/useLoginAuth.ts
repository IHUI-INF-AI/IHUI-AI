/**
 * Login 认证状态管理Composable
 *
 * 负责登录状态检查和重定向逻辑
 *
 * @packageDocumentation
 */

import { watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { logger } from '@/utils/logger'
import { useAuthStore } from '@/stores/auth'
import { StorageManager, STORAGE_KEYS } from '@/utils/storage'
import { isLoginExpired } from '@/utils/login-duration'

/**
 * useLoginAuth 配置选项
 */
export interface UseLoginAuthOptions {
  /** 登录成功后回调*/
  onLoginSuccess?: () => void
}

/**
 * Login 认证状态管理Composable
 *
 * @param options - 配置选项
 * @returns 返回认证状态检查方法
 */
export function useLoginAuth(options: UseLoginAuthOptions = {}) {
  const { onLoginSuccess } = options
  const route = useRoute()
  const router = useRouter()
  const authStore = useAuthStore()

  /**
   * 检查是否已登录，如果已登录则重定向到首页
   */
  const checkLoginStatus = (): boolean => {
    try {
      // 如果URL中有source参数，说明是跨项目登录，允许访问（即使已登录也可以切换项目）
      const hasSourceParam = route.query.source !== undefined
      if (hasSourceParam) {
        // 有source参数，允许访问登录页，不进行重定向
        return false
      }

      // 检查 token
      const token =
        StorageManager.getItem<string>(STORAGE_KEYS.TOKEN) ||
        StorageManager.getItem<string>(STORAGE_KEYS.USER_TOKEN)

      // 检查登录是否过期
      const expiryTime = StorageManager.getItem<number | null>(STORAGE_KEYS.LOGIN_EXPIRY_TIME)
      const isExpired = expiryTime !== null && isLoginExpired(expiryTime)

      // 检查用户数据
      const userData = StorageManager.getItem<Record<string, unknown>>(STORAGE_KEYS.USER_DATA)

      // 检查authStore 中的登录状态
      const isStoreLoggedIn = authStore.isLoggedIn && authStore.token && authStore.user

      // 如果已登录（token 存在且未过期，且有用户数据，authStore 也显示已登录
      if (token && !isExpired && userData && isStoreLoggedIn) {
        // 若正在显示「绑定密码」弹窗（首次登录补全），不重定向，避免弹窗被关掉
        const accountBindDialogOpen = sessionStorage.getItem('__account_bind_dialog_open__')
        if (accountBindDialogOpen === '1') {
          return false
        }
        // 重定向到首页或之前保存的路径
        const savedReturnPath = StorageManager.getItem<string>('auth-return-path')
        if (savedReturnPath && savedReturnPath !== '/login' && savedReturnPath !== '/register') {
          StorageManager.removeItem('auth-return-path')
          void router.replace(savedReturnPath)
        } else {
          void router.replace('/')
        }
        return true
      }

      // 如果 token 过期或无效，清除登录状态
      if (isExpired || !userData) {
        StorageManager.removeItem(STORAGE_KEYS.TOKEN)
        StorageManager.removeItem(STORAGE_KEYS.USER_TOKEN)
        StorageManager.removeItem(STORAGE_KEYS.USER_DATA)
        StorageManager.removeItem(STORAGE_KEYS.LOGIN_EXPIRY_TIME)
        if (authStore.token) {
          authStore.logout()
        }
      }

      return false
    } catch (err) {
      logger.error('[LoginAuth] Failed to check login status:', err)
      return false
    }
  }

  // 防止重复执行的标志
  let isChecking = false
  let hasRedirected = false

  // 监听登录状态变化，如果已登录则重定向
  watch(
    () => authStore.isLoggedIn && authStore.token && authStore.user,
    isLoggedIn => {
      // 检查是否有退出登录标志，如果有则不处理自动登录
      const logoutFlag = sessionStorage.getItem('__logout_flag__')
      if (logoutFlag) {
        return
      }
      
      if (isLoggedIn && !hasRedirected && !isChecking) {
        isChecking = true
        // 延迟一下，确保状态已完全更新
        setTimeout(() => {
          const shouldRedirect = checkLoginStatus()
          if (shouldRedirect) {
            hasRedirected = true
          }
          isChecking = false
        }, 100)
      }
    },
    { immediate: true }
  )

  onMounted(() => {
    // 检查是否已登录，如果已登录则重定向
    if (!hasRedirected && !isChecking) {
      isChecking = true
      const shouldRedirect = checkLoginStatus()
      if (shouldRedirect) {
        hasRedirected = true
        isChecking = false
        return
      }
      isChecking = false
    }

    // 如果已经重定向，就不处理消息提示
    if (hasRedirected) {
      return
    }

    // 调用成功回调
    if (onLoginSuccess) {
      onLoginSuccess()
    }
  })

  return {
    // 方法
    checkLoginStatus,
  }
}
