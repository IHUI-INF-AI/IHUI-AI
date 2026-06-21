/**
 * 统一认证服务
 * 用于处理跨项目的认证逻辑
 */

import { ElMessage } from 'element-plus'
import { logger } from '../utils/logger'
import { safeParseJson, StorageManager, STORAGE_KEYS } from '@/utils/storage'
import { t } from '@/composables/useLang'

export class UnifiedAuthService {
  private static instance: UnifiedAuthService
  private readonly mainProjectUrl: string // 主项目地址（官网）
  private readonly currentProjectUrl: string // 当前项目地址
  private readonly currentProjectPort: string // 当前项目端口

  private constructor() {
    this.currentProjectUrl = window.location.origin
    this.currentProjectPort = window.location.port
    const envMainUrl = (import.meta.env.VITE_MAIN_PROJECT_URL as string | undefined)?.trim()
    // 优先使用环境变量，缺省时使用当前访问的来源，避免强绑 127.0.0.1 导致“more-private address space”错误
    if (envMainUrl && envMainUrl.startsWith('http')) {
      this.mainProjectUrl = envMainUrl.replace(/\/+$/, '')
    } else {
      this.mainProjectUrl = this.currentProjectUrl
    }
  }

  static getInstance() {
    if (!UnifiedAuthService.instance) {
      UnifiedAuthService.instance = new UnifiedAuthService()
    }
    return UnifiedAuthService.instance
  }

  /**
   * 获取当前项目标识 - 统一使用8888端口
   */
  private getCurrentProjectId(): string {
    const port = this.currentProjectPort
    const projectIdMap: Record<string, string> = {
      '8888': 'main', // 主项目 - 统一端口
    }

    return projectIdMap[port] || 'main'
  }

  /**
   * 跳转到登录页面
   * @param redirectUrl 登录成功后的重定向URL
   * @param options 附加选项
   */
  redirectToLogin(redirectUrl?: string, options?: { source?: string; message?: string }) {
    const source = options?.source || this.getCurrentProjectId()
    const finalRedirectUrl = redirectUrl || this.currentProjectUrl
    const loginUrl = new URL('/login', this.mainProjectUrl)

    loginUrl.searchParams.set('source', source)
    loginUrl.searchParams.set('redirect', encodeURIComponent(finalRedirectUrl))

    if (options?.message) {
      loginUrl.searchParams.set('message', encodeURIComponent(options.message))
    }

    // 保存当前页面路径，以便登录后返回
    if (!redirectUrl) {
      localStorage.setItem('auth-return-path', window.location.pathname + window.location.search)
    }

    window.location.href = loginUrl.toString()
  }

  /**
   * 跳转到注册页面
   * @param redirectUrl 注册成功后的重定向URL
   * @param options 附加选项
   */
  redirectToRegister(redirectUrl?: string, options?: { source?: string; message?: string }) {
    const source = options?.source || this.getCurrentProjectId()
    const finalRedirectUrl = redirectUrl || this.currentProjectUrl
    const registerUrl = new URL('/register', this.mainProjectUrl)

    registerUrl.searchParams.set('source', source)
    registerUrl.searchParams.set('redirect', encodeURIComponent(finalRedirectUrl))

    if (options?.message) {
      registerUrl.searchParams.set('message', encodeURIComponent(options.message))
    }

    // 保存当前页面路径，以便注册后返回
    if (!redirectUrl) {
      localStorage.setItem('auth-return-path', window.location.pathname + window.location.search)
    }

    window.location.href = registerUrl.toString()
  }

  /**
   * 处理认证回调
   * 检查URL中是否包含认证信息，并保存到本地存储
   * @returns 是否成功处理认证回调
   */
  handleAuthCallback(): boolean {
    const urlParams = new URLSearchParams(window.location.search)
    const token = urlParams.get('token')
    const refreshToken = urlParams.get('refreshToken')
    const userInfoStr = urlParams.get('userInfo')
    const error = urlParams.get('error')

    // 处理错误
    if (error) {
      ElMessage.error(decodeURIComponent(error))
      return false
    }

    // 处理认证成功
    if (token && userInfoStr) {
      try {
        const userInfo = safeParseJson(decodeURIComponent(userInfoStr), null, {
          forbidFunction: true,
        })

        // 保存认证信息到本地存储 - 使用统一的存储 keys
        StorageManager.setItem(STORAGE_KEYS.TOKEN, token)
        StorageManager.setItem(STORAGE_KEYS.USER_TOKEN, token)
        if (refreshToken) {
          StorageManager.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken)
        }
        StorageManager.setItem(STORAGE_KEYS.USER_DATA, userInfo)

        // 清除URL参数
        const url = new URL(window.location.href)
        url.searchParams.delete('token')
        url.searchParams.delete('refreshToken')
        url.searchParams.delete('userInfo')
        url.searchParams.delete('error')
        window.history.replaceState({}, document.title, url.toString())

        ElMessage.success(t('unifiedAuth.loginSuccess'))
        return true
      } catch (err) {
        logger.error('Failed to parse user info:', err)
        ElMessage.error(t('unifiedAuth.loginInfoParseFailed'))
        return false
      }
    }

    return false
  }

  /**
   * 检查用户是否已登录
   * @returns 是否已登录
   */
  isLoggedIn(): boolean {
    return !!StorageManager.getItem(STORAGE_KEYS.TOKEN) || !!StorageManager.getItem(STORAGE_KEYS.USER_TOKEN)
  }

  /**
   * 获取当前用户信息
   * @returns 用户信息对象
   */
  getCurrentUser(): Record<string, unknown> | null {
    return StorageManager.getItem<Record<string, unknown>>(STORAGE_KEYS.USER_DATA)
  }

  /**
   * 获取认证令牌
   * @returns 认证令牌
   */
  getAuthToken(): string | null {
    return StorageManager.getItem<string>(STORAGE_KEYS.TOKEN) || StorageManager.getItem<string>(STORAGE_KEYS.USER_TOKEN)
  }

  /**
   * 获取刷新令牌
   * @returns 刷新令牌
   */
  getRefreshToken(): string | null {
    return StorageManager.getItem<string>(STORAGE_KEYS.REFRESH_TOKEN)
  }

  /**
   * 退出登录
   * @param redirectToMain 是否重定向到主项目
   */
  logout(redirectToMain: boolean = false) {
    // 清除本地存储的认证信息 - 使用统一的存储 keys
    StorageManager.removeItem(STORAGE_KEYS.TOKEN)
    StorageManager.removeItem(STORAGE_KEYS.USER_TOKEN)
    StorageManager.removeItem(STORAGE_KEYS.REFRESH_TOKEN)
    StorageManager.removeItem(STORAGE_KEYS.USER_DATA)
    StorageManager.removeItem(STORAGE_KEYS.LOGIN_EXPIRY_TIME)

    ElMessage.success(t('unifiedAuth.logoutSuccess'))

    // 如果需要重定向到主项目
    if (redirectToMain) {
      window.location.href = this.mainProjectUrl
    }
  }

  /**
   * 刷新令牌
   * @returns 是否刷新成功
   */
  async refreshToken(): Promise<boolean> {
    const refreshToken = this.getRefreshToken()
    if (!refreshToken) {
      return false
    }

    try {
      const response = await fetch(`${this.mainProjectUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      })

      const data = await response.json()

      if (data.success) {
        StorageManager.setItem(STORAGE_KEYS.TOKEN, data.data.token)
        StorageManager.setItem(STORAGE_KEYS.USER_TOKEN, data.data.token)
        if (data.data.refreshToken) {
          StorageManager.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.data.refreshToken)
        }
        return true
      }

      return false
    } catch (error) {
      logger.error('Failed to refresh token:', error)
      return false
    }
  }

  /**
   * 检查令牌是否有效
   * @returns 令牌是否有效
   */
  async isTokenValid(): Promise<boolean> {
    const token = this.getAuthToken()
    if (!token) {
      return false
    }

    try {
      const response = await fetch(`${this.mainProjectUrl}/api/auth/verify-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      })

      const data = await response.json()
      return data.success
    } catch (error) {
      logger.error('Failed to verify token:', error)
      return false
    }
  }
}

// 导出单例实例
export default UnifiedAuthService.getInstance()
