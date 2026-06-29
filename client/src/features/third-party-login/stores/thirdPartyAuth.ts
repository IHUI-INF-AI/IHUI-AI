import { defineStore } from 'pinia'
import { logger } from '../../../utils/logger'
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { AuthFlowService } from '@/services/auth-flow.service'
import {
  bindThirdPartyAccount as bindThirdPartyAccountApi,
  unbindThirdPartyAccount as unbindThirdPartyAccountApi,
  getUserThirdPartyAccounts,
} from '@/api/user'

// 第三方平台类型
export type ThirdPartyPlatform = 'google'

// 第三方登录状态
export interface ThirdPartyLoginState {
  platform: ThirdPartyPlatform
  status: 'pending' | 'scanning' | 'scanned' | 'confirming' | 'success' | 'failed' | 'expired'
  qrCodeUrl?: string
  stateKey?: string
  expiresAt?: number
  error?: string
  retryCount: number
}

// 第三方账号绑定信息
export interface ThirdPartyAccount {
  id: string
  platform: ThirdPartyPlatform
  platformUserId: string
  platformUsername: string
  platformAvatar: string
  bindTime: string
  status: 'active' | 'disabled'
}

// 第三方登录配置
export interface ThirdPartyConfig {
  google: {
    enabled: boolean
    clientId: string
    redirectUri: string
    scope: string
  }
}

export const useThirdPartyAuthStore = defineStore('thirdPartyAuth', () => {
  // 状态
  const config = ref<ThirdPartyConfig>({
    google: { enabled: false, clientId: '', redirectUri: '', scope: '' },
  })

  const loginStates = ref<Map<ThirdPartyPlatform, ThirdPartyLoginState>>(new Map())
  const boundAccounts = ref<ThirdPartyAccount[]>([])
  const isLoading = ref(false)
  const currentLoginPlatform = ref<ThirdPartyPlatform | null>(null)

  // 计算属性
  const enabledPlatforms = computed(() => {
    const platforms: ThirdPartyPlatform[] = []
    if (config.value.google.enabled) platforms.push('google')
    return platforms
  })

  const isAnyPlatformEnabled = computed(() => enabledPlatforms.value.length > 0)

  const getCurrentLoginState = computed(() => {
    if (!currentLoginPlatform.value) return null
    return loginStates.value.get(currentLoginPlatform.value) || null
  })

  const getPlatformDisplayName = (platform: ThirdPartyPlatform): string => {
    const names: Record<ThirdPartyPlatform, string> = {
      google: 'Google',
    }
    return names[platform] ?? platform
  }

  const isBound = (platform: ThirdPartyPlatform): boolean => {
    return boundAccounts.value.some(
      (account: ThirdPartyAccount) => account.platform === platform && account.status === 'active'
    )
  }

  const getBoundAccount = (platform: ThirdPartyPlatform): ThirdPartyAccount | null => {
    return (
      boundAccounts.value.find(
        (account: ThirdPartyAccount) => account.platform === platform && account.status === 'active'
      ) || null
    )
  }

  // 设置第三方登录配置
  const setConfig = (newConfig: Partial<ThirdPartyConfig>) => {
    config.value = { ...config.value, ...newConfig }
  }

  // 初始化登录状态
  const initLoginState = (platform: ThirdPartyPlatform) => {
    const state: ThirdPartyLoginState = {
      platform,
      status: 'pending',
      retryCount: 0,
    }
    loginStates.value.set(platform, state)
    currentLoginPlatform.value = platform
    return state
  }

  // 更新登录状态
  const updateLoginState = (
    platform: ThirdPartyPlatform,
    updates: Partial<ThirdPartyLoginState>
  ) => {
    const currentState = loginStates.value.get(platform)
    if (currentState) {
      const newState = { ...currentState, ...updates }
      loginStates.value.set(platform, newState)
    }
  }

  // 清除登录状态
  const clearLoginState = (platform: ThirdPartyPlatform) => {
    loginStates.value.delete(platform)
    if (currentLoginPlatform.value === platform) {
      currentLoginPlatform.value = null
    }
  }

  // 开始第三方登录
  const startLogin = async (platform: ThirdPartyPlatform): Promise<boolean> => {
    try {
      isLoading.value = true

      // 检查平台是否启用
      const platformConfig = config.value[platform]
      if (!platformConfig?.enabled) {
        throw new Error(`${getPlatformDisplayName(platform)}登录未启用`)
      }

      // 初始化登录状态
      initLoginState(platform)

      return true
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error(`Starting ${getPlatformDisplayName(platform)} login failed:`, error)
      ElMessage.error(errorMessage || `Starting ${getPlatformDisplayName(platform)} login failed`)
      return false
    } finally {
      isLoading.value = false
    }
  }

  // 处理登录成功 - 优化版本，使用 AuthFlowService
  const handleLoginSuccess = async (
    platform: ThirdPartyPlatform,
    data: {
      token: string
      user: Record<string, unknown>
      refreshToken?: string
    }
  ) => {
    try {
      // 更新登录状态
      updateLoginState(platform, {
        status: 'success',
      })

      // 使用 AuthFlowService 统一处理登录响应（原子化存储 + 自动获取用户信息）
      const result = await AuthFlowService.processLoginResponse(
        data.token,
        data.refreshToken || '',
        data.user
      )

      if (result.success) {
        AuthFlowService.showSuccess(`${getPlatformDisplayName(platform)}登录成功`)

        // 清除登录状态
        clearLoginState(platform)

        // 刷新绑定账号列表
        await refreshBoundAccounts()

        return true
      } else {
        throw new Error('登录处理失败')
      }
    } catch (error: unknown) {
      logger.error(`${getPlatformDisplayName(platform)} login processing failed:`, error)
      const errorMsg = error instanceof Error ? error.message : String(error)
      updateLoginState(platform, {
        status: 'failed',
        error: errorMsg,
      })
      ElMessage.error(errorMsg || `${getPlatformDisplayName(platform)} login failed`)
      return false
    }
  }

  // 处理登录失败
  const handleLoginError = (platform: ThirdPartyPlatform, error: unknown) => {
    logger.error(`${getPlatformDisplayName(platform)} login failed:`, error)

    const currentState = loginStates.value.get(platform)
    const retryCount = (currentState?.retryCount || 0) + 1
    const errorMsg = error instanceof Error ? error.message : String(error) || '登录失败'

    updateLoginState(platform, {
      status: 'failed',
      error: errorMsg,
      retryCount,
    })

    // 如果重试次数过多，建议切换登录方式
    if (retryCount >= 3) {
      ElMessage.error(`${getPlatformDisplayName(platform)}登录多次失败，建议尝试其他登录方式`)
    } else {
      ElMessage.error(errorMsg || `${getPlatformDisplayName(platform)} login failed`)
    }
  }

  // 重试登录
  const retryLogin = async (platform: ThirdPartyPlatform): Promise<boolean> => {
    const currentState = loginStates.value.get(platform)
    if (!currentState) return false

    if (currentState.retryCount >= 5) {
      const { t } = useI18n()
      ElMessage.warning(t('thirdPartyLogin.retryTooMany'))
      return false
    }

    // 清除当前状态并重新开始
    clearLoginState(platform)
    return await startLogin(platform)
  }

  // 取消登录
  const cancelLogin = (platform: ThirdPartyPlatform) => {
    clearLoginState(platform)
    ElMessage.info(`已取消${getPlatformDisplayName(platform)}登录`)
  }

  // 绑定第三方账号
  const bindAccount = async (
    platform: ThirdPartyPlatform,
    authData: { code: string }
  ): Promise<boolean> => {
    try {
      isLoading.value = true

      const result = await bindThirdPartyAccountApi({ platform, code: authData.code })
      if (!result.success) {
        throw new Error(result.message || '绑定失败')
      }

      ElMessage.success(`${getPlatformDisplayName(platform)}账号绑定成功`)

      await refreshBoundAccounts()

      return true
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error(`Binding ${getPlatformDisplayName(platform)} account failed:`, error)
      ElMessage.error(errorMessage || `Binding ${getPlatformDisplayName(platform)} account failed`)
      return false
    } finally {
      isLoading.value = false
    }
  }

  // 解绑第三方账号
  const unbindAccount = async (platform: ThirdPartyPlatform): Promise<boolean> => {
    try {
      isLoading.value = true

      const account = getBoundAccount(platform)
      if (!account) {
        throw new Error(`未找到${getPlatformDisplayName(platform)}绑定的账号`)
      }

      const result = await unbindThirdPartyAccountApi(account.id)
      if (!result.success) {
        throw new Error(result.message || '解绑失败')
      }

      ElMessage.success(`${getPlatformDisplayName(platform)}账号解绑成功`)

      await refreshBoundAccounts()

      return true
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error(`Unbinding ${getPlatformDisplayName(platform)} account failed:`, error)
      ElMessage.error(errorMessage || `Unbinding ${getPlatformDisplayName(platform)} account failed`)
      return false
    } finally {
      isLoading.value = false
    }
  }

  // 刷新绑定账号列表
  const refreshBoundAccounts = async () => {
    try {
      const result = await getUserThirdPartyAccounts()
      if (result.success && result.data) {
        boundAccounts.value = result.data.map((item): ThirdPartyAccount => ({
          id: item.id,
          platform: item.platform as ThirdPartyPlatform,
          platformUserId: item.platformUserId,
          platformUsername: item.platformUsername,
          platformAvatar: item.platformAvatar,
          bindTime: item.bindTime,
          status: item.status === 1 ? 'active' : 'disabled',
        }))
      }
    } catch (error) {
      logger.error('Refreshing bound account list failed:', error)
    }
  }

  // 检查登录状态过期
  const checkExpiredStates = () => {
    const now = Date.now()
    for (const [platform, state] of loginStates.value.entries()) {
      if (state.expiresAt && now > state.expiresAt) {
        updateLoginState(platform, {
          status: 'expired',
          error: '登录已过期',
        })
      }
    }
  }

  // 清理所有状态
  const clearAllStates = () => {
    loginStates.value.clear()
    currentLoginPlatform.value = null
    isLoading.value = false
  }

  // 获取平台统计信息
  const getPlatformStats = computed(() => {
    return {
      total: enabledPlatforms.value.length,
      bound: boundAccounts.value.filter((account: ThirdPartyAccount) => account.status === 'active')
        .length,
      available:
        enabledPlatforms.value.length -
        boundAccounts.value.filter((account: ThirdPartyAccount) => account.status === 'active')
          .length,
    }
  })

  return {
    // 状态
    config,
    loginStates,
    boundAccounts,
    isLoading,
    currentLoginPlatform,

    // 计算属性
    enabledPlatforms,
    isAnyPlatformEnabled,
    getCurrentLoginState,
    getPlatformStats,

    // 方法
    setConfig,
    initLoginState,
    updateLoginState,
    clearLoginState,
    startLogin,
    handleLoginSuccess,
    handleLoginError,
    retryLogin,
    cancelLogin,
    bindAccount,
    unbindAccount,
    refreshBoundAccounts,
    checkExpiredStates,
    clearAllStates,
    getPlatformDisplayName,
    isBound,
    getBoundAccount,
  }
})
