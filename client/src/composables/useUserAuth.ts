import { t } from '@/utils/i18n'

// 用户认证 API 集成 Composable
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { logger } from '@/utils/logger'
import { StorageManager } from '@/utils/storage'

interface LoginRequest {
  identifier: string // 用户名、邮箱或手机号
  password: string
}

interface RegisterRequest {
  username: string
  email?: string
  password: string
  confirmPassword: string
  phone?: string
  code?: string
}

interface AuthResponse {
  success: boolean
  message: string
  user?: {
    id: number
    username: string
    email: string
    role: string
    created_at?: string
  }
  token?: string
}

export function useUserAuth() {
  const router = useRouter()
  const { showSuccess, showError } = useOperationFeedback()

  const loading = ref(false)

  // 后端 API 基础 URL
  const API_BASE_URL = '/api/auth'

  // 登录 API
  const login = async (loginData: LoginRequest): Promise<AuthResponse> => {
    loading.value = true

    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loginData),
      })

      const result = await response.json()

      if (result.success) {
        // 保存 token 到 StorageManager
        if (result.token) {
          StorageManager.setItem('auth_token', result.token)
        }

        // 保存用户信息
        if (result.user) {
          StorageManager.setItem('user_info', result.user)
        }

        showSuccess(result.message || '登录成功')

        // 跳转到首页或用户指定页面
        const redirectTo = new URLSearchParams(window.location.search).get('redirect') || '/'
        void router.push(redirectTo)
      } else {
        showError(result.message || '登录失败')
      }

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('api.use_user_auth.网络错误')
      showError(`登录失败: ${errorMessage}`)
      logger.error('[UserAuth] Login request failed', error)

      return {
        success: false,
        message: errorMessage,
      }
    } finally {
      loading.value = false
    }
  }

  // 注册 API
  const register = async (registerData: RegisterRequest): Promise<AuthResponse> => {
    loading.value = true

    try {
      const response = await fetch(`${API_BASE_URL}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(registerData),
      })

      const result = await response.json()

      if (result.success) {
        // 保存 token 到 StorageManager
        if (result.token) {
          StorageManager.setItem('auth_token', result.token)
        }

        // 保存用户信息
        if (result.user) {
          StorageManager.setItem('user_info', result.user)
        }

        showSuccess(result.message || '注册成功')

        // 跳转到首页
        void router.push('/')
      } else {
        showError(result.message || '注册失败')
      }

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('api.use_user_auth.网络错误1')
      showError(`注册失败: ${errorMessage}`)
      logger.error('[UserAuth] Registration request failed', error)

      return {
        success: false,
        message: errorMessage,
      }
    } finally {
      loading.value = false
    }
  }

  // 检查登录状态
  const checkAuthStatus = (): boolean => {
    const token = StorageManager.getItem<string>('auth_token')
    const userInfo = StorageManager.getItem('user_info')

    return !!(token && userInfo)
  }

  // 获取当前用户信息
  const getCurrentUser = () => {
    return StorageManager.getItem('user_info')
  }

  // 登出
  const logout = () => {
    loading.value = false
    StorageManager.removeItem('auth_token')
    StorageManager.removeItem('user_info')
    showSuccess(t('auth.logoutSuccess'))
    void router.push('/login')
  }

  return {
    loading,
    login,
    register,
    checkAuthStatus,
    getCurrentUser,
    logout,
  }
}
