/**
 * 统一认证流程服务
 * 优化登录性能，避免重复的 API 调用和存储操作
 *
 * 优化点：
 * 1. 静态导入所有模块，避免动态 import 延迟
 * 2. fetchUserInfo 仅在必要时调用一次，带防重入锁
 * 3. Token 和用户信息一次性存储，避免重复写入
 * 4. 移除不必要的等待循环
 */

import { useAuthStore, useTokenStore, useUserStore, useWalletStore, useVipStore } from '@/stores/auth'
import { useRouter, type Router } from 'vue-router'
import { StorageManager, TokenManager, STORAGE_KEYS, logger } from '@/utils/core'
import {
  calculateExpiryTime,
  getDefaultLoginDuration,
  type LoginDuration,
} from '@/utils/login-duration'
import {
  unifiedLogin,
  type LoginSource,
  type UnifiedLoginRequest,
  type UnifiedLoginResponse,
} from '@/api/unified-auth'
import { completePhoneLogin, type UserInfoData } from '@/api/user'

// 手机登录参数类型
interface PhoneLoginParams {
  phone: string
  tempKey: string
}

// 辅助函数：获取 authStore.user 并进行类型断言
const getAuthUser = () => {
  const authStore = useAuthStore()
  return authStore.user as UserInfoData | null
}
import { getStoredData } from '@/utils/request'
import { ElMessage } from 'element-plus'
import i18n from '@/locales'
import { ssoLoginByUuid, buildEduPlatformUrl, EduPlatformType } from '@/api/sso'

// 类型安全的 i18n 翻译函数
type TranslateFn = (key: string) => string
const getTranslator = (): TranslateFn => {
  // 使用类型断言来访问 i18n.global.t
  return (key: string) => (i18n.global as unknown as { t: TranslateFn }).t(key)
}

// 类型定义
export interface LoginCredentials {
  phone: string
  password: string
  email?: string
  code?: string
  uuid?: string
  remember?: boolean
}

export interface LoginResult {
  success: boolean
  token?: string
  refreshToken?: string
  userInfo?: Record<string, unknown>
  error?: string
  needRegister?: boolean
}

export interface LoginOptions {
  /** 登录来源 */
  source?: LoginSource
  /** 登录持续时间 */
  duration?: LoginDuration
  /** 是否保存历史记录 */
  saveHistory?: boolean
  /** 登录成功后的回调 */
  onSuccess?: () => void
  /** 登录失败后的回调 */
  onError?: (error: Error) => void
}

export interface RedirectOptions {
  /** 来源项目 */
  source?: string
  /** 重定向 URL */
  redirectUrl?: string
  /** Token */
  token?: string
  /** Refresh Token */
  refreshToken?: string
  /** 过期时间（秒） */
  expiresIn?: number
  /** 用户信息 */
  userInfo?: Record<string, unknown>
  /** 调用方显式传入的 router 实例(避免静态方法内 useRouter() 脱离 setup 上下文) */
  router?: Router
}

// 防重入锁
let isFetchingUserInfo = false
let fetchUserInfoPromise: Promise<void> | null = null

/**
 * 统一认证流程服务
 * 提供高性能的登录、登出和认证状态管理
 */
export class AuthFlowService {
  /**
   * 统一登录入口
   * 优化后的登录流程，最多 2 次 API 请求（登录 + 可选的用户信息获取）
   */
  static async login(
    credentials: LoginCredentials,
    options: LoginOptions = {}
  ): Promise<LoginResult> {
    const { source = 'main', duration, onSuccess, onError } = options
    const t = getTranslator()

    logger.info('[AuthFlowService] Login started', {
      source,
      phone: credentials.phone?.slice(0, 3) + '****',
    })
    const startTime = performance.now()

    try {
      // 1. 调用统一登录 API
      const loginRequest: UnifiedLoginRequest = {
        phone: credentials.phone,
        password: credentials.password,
        email: credentials.email,
        code: credentials.code,
        uuid: credentials.uuid,
        remember: credentials.remember,
      }

      const response = await unifiedLogin(source, loginRequest)
      logger.debug('[AuthFlowService] Login response', { response })

      // 2. 检查登录是否成功
      if (!response.success || !response.data?.token) {
        // 过滤无意义的 "success" 消息，使用有意义的错误提示
        const rawMsg = response.message
        const isUselessMessage = !rawMsg || rawMsg.toLowerCase() === 'success' || rawMsg === '成功'
        const errorMsg = isUselessMessage ? t('auth.loginFailed') : rawMsg
        logger.warn('[AuthFlowService] Login failed', { message: errorMsg, rawMessage: rawMsg })

        // 检查是否需要注册
        const needRegister = this.checkNeedRegister(response)
        if (needRegister) {
          return {
            success: false,
            error: errorMsg,
            needRegister: true,
          }
        }

        onError?.(new Error(errorMsg))
        return { success: false, error: errorMsg }
      }

      const { token, refreshToken, userInfo } = response.data

      // 3. 一次性保存认证状态（关键优化：避免重复存储）
      await this.saveAuthState(token, refreshToken || '', userInfo, duration)

      // 4. 如果响应中没有完整用户信息，获取一次（且仅一次）
      const user = getAuthUser()
      if (!user || !user.uuid) {
        await this.ensureUserInfo()
      }

      const elapsed = performance.now() - startTime
      logger.info('[AuthFlowService] Login successful', { elapsed: `${elapsed.toFixed(0)}ms` })

      onSuccess?.()
      return {
        success: true,
        token,
        refreshToken,
        userInfo: getAuthUser() as unknown as Record<string, unknown>,
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.error('[AuthFlowService] Login error', { error: errorMsg })
      onError?.(error instanceof Error ? error : new Error(errorMsg))
      return { success: false, error: errorMsg }
    }
  }

  /**
   * 手机验证码登录
   */
  static async phoneLogin(
    params: PhoneLoginParams,
    options: LoginOptions = {}
  ): Promise<LoginResult> {
    const { duration, onSuccess, onError } = options
    const t = getTranslator()

    logger.info('[AuthFlowService] Phone verification login started')
    const startTime = performance.now()

    try {
      // 1. 调用手机登录 API
      const response = await completePhoneLogin(params)

      // 2. 检查登录是否成功
      const codeNum =
        typeof response.code === 'string' ? parseInt(response.code, 10) : response.code
      const isSuccess = codeNum === 200 || response.success === true

      if (!isSuccess) {
        const errorMsg = response.message || response.msg || t('auth.loginFailed')
        logger.warn('[AuthFlowService] Phone login failed', { message: errorMsg })
        onError?.(new Error(errorMsg))
        return { success: false, error: errorMsg }
      }

      // 3. 提取 token 和用户信息
      const responseData = response.data as Record<string, unknown> | undefined
      const token = (responseData?.token ||
        responseData?.accessToken ||
        responseData?.access_token ||
        (response as unknown as { token?: string }).token) as string

      if (!token) {
        const errorMsg = t('auth.loginResponseMissingToken')
        logger.error('[AuthFlowService] Login response missing token')
        onError?.(new Error(errorMsg))
        return { success: false, error: errorMsg }
      }

      const refreshToken = (responseData?.refreshToken ||
        responseData?.refresh_token ||
        (response as unknown as { refreshToken?: string }).refreshToken ||
        '') as string

      const userInfo = (responseData?.user ||
        responseData?.userInfo ||
        (response as unknown as { user?: Record<string, unknown> }).user ||
        (response as unknown as { userInfo?: Record<string, unknown> }).userInfo) as Record<string, unknown> | undefined

      // 4. 一次性保存认证状态
      await this.saveAuthState(token, refreshToken, userInfo, duration)

      // 5. 如果没有完整用户信息，获取一次
      const userAfterAuth = getAuthUser()
      if (!userAfterAuth || !userAfterAuth.uuid) {
        await this.ensureUserInfo()
      }

      const elapsed = performance.now() - startTime
      logger.info('[AuthFlowService] Phone login successful', { elapsed: `${elapsed.toFixed(0)}ms` })

      onSuccess?.()
      return {
        success: true,
        token,
        refreshToken,
        userInfo: getAuthUser() as unknown as Record<string, unknown>,
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.error('[AuthFlowService] Phone login error', { error: errorMsg })
      onError?.(error instanceof Error ? error : new Error(errorMsg))
      return { success: false, error: errorMsg }
    }
  }

  /**
   * 处理已有的登录响应数据
   * 用于 handlePhoneLogin 等需要自行调用 API 的场景
   * @param token - 访问令牌
   * @param refreshToken - 刷新令牌
   * @param userInfo - 用户信息（可选）
   * @param duration - 登录持续时间（可选）
   */
  static async processLoginResponse(
    token: string,
    refreshToken: string = '',
    userInfo?: Record<string, unknown>,
    duration?: LoginDuration
  ): Promise<{ success: boolean; userInfo: Record<string, unknown> | null }> {
    logger.info('[AuthFlowService] Processing login response data')
    const startTime = performance.now()

    try {
      // 1. 保存认证状态
      await this.saveAuthState(token, refreshToken, userInfo, duration)

      // 2. 如果没有完整用户信息，获取一次
      const currentUser = getAuthUser()
      if (!currentUser || !currentUser.uuid) {
        await this.ensureUserInfo()
      }

      const elapsed = performance.now() - startTime
      logger.info('[AuthFlowService] Login response processed', { elapsed: `${elapsed.toFixed(0)}ms` })

      return {
        success: true,
        userInfo: getAuthUser() as unknown as Record<string, unknown> | null,
      }
    } catch (error) {
      logger.error('[AuthFlowService] Failed to process login response', { error })
      return { success: false, userInfo: null }
    }
  }

  /**
   * 一次性保存认证状态
   * 关键优化：合并所有存储操作，避免重复写入
   */
  private static async saveAuthState(
    token: string,
    refreshToken: string,
    userInfo?: Record<string, unknown>,
    duration?: LoginDuration
  ): Promise<void> {
    const tokenStore = useTokenStore()
    const userStore = useUserStore()
    const walletStore = useWalletStore()
    const vipStore = useVipStore()
    const currentTime = new Date().toISOString()

    // 1. 通过 tokenStore 写入 token，使 authStore.isLoggedIn 与 token 同步
    tokenStore.setToken(token, refreshToken)

    // 2. 设置用户信息（如果提供）
    let normalizedUser: Record<string, unknown> | null = null
    if (userInfo) {
      normalizedUser = this.normalizeUserInfo(userInfo)
      userStore.user = normalizedUser as unknown as UserInfoData

      // 更新 fundInfo（如果有用户余额信息）
      const userMarginData = normalizedUser.userMargin as
        | {
            id?: string
            userUuid?: string
            tokenQuantity?: string | number
            [key: string]: unknown
          }
        | undefined

      if (userMarginData) {
        const tokenQuantity =
          typeof userMarginData.tokenQuantity === 'string'
            ? parseFloat(userMarginData.tokenQuantity)
            : userMarginData.tokenQuantity || 0

        walletStore.setFundInfo({
          id: userMarginData.id || '',
          userId: userMarginData.userUuid || (normalizedUser.uuid as string) || '',
          balance: tokenQuantity,
          frozenAmount: 0,
          totalRecharge: 0,
          totalConsumption: 0,
          totalWithdraw: 0,
          updateTime: currentTime,
        })
      }

      // 更新 vipInfo（如果有 VIP 等级信息）
      const vipLevelVOData = normalizedUser.vipLevelVO as
        | {
            id?: string
            title?: string
            levelName?: string
            userVip?: { isValid?: number }
            [key: string]: unknown
          }
        | undefined

      if (vipLevelVOData) {
        vipStore.setVipInfo({
          id: vipLevelVOData.id || '',
          userId: (normalizedUser.uuid as string) || '',
          vipLevelId: vipLevelVOData.id || '',
          vipLevelName: vipLevelVOData.title || vipLevelVOData.levelName || '',
          startTime: '',
          endTime: '',
          isExpired: false,
          isActive: vipLevelVOData.userVip?.isValid === 1,
          privileges: [],
        })
      }
    }

    // 4. 计算过期时间
    const loginDurationValue =
      duration ||
      StorageManager.getItem<LoginDuration>(STORAGE_KEYS.LOGIN_DURATION)?.value ||
      getDefaultLoginDuration()
    const expiryTime = calculateExpiryTime(typeof loginDurationValue === 'number' ? loginDurationValue : loginDurationValue.value)

    // 5. 一次性保存到 TokenManager（内部会处理 localStorage）
    TokenManager.setToken(token, refreshToken)

    // 6. 保存过期时间
    if (expiryTime !== null) {
      StorageManager.setItem(STORAGE_KEYS.LOGIN_EXPIRY_TIME, expiryTime)
    } else {
      StorageManager.removeItem(STORAGE_KEYS.LOGIN_EXPIRY_TIME)
    }

    // 7. 保存用户数据到 localStorage（一次性操作）
    const existingData = (getStoredData() as Record<string, unknown>) || {}
    const userData =
      normalizedUser ||
      (userStore.user && typeof userStore.user === 'object'
        ? (userStore.user as Record<string, unknown>)
        : {})

    // 获取 thirdPartyAccounts 中的过期时间（如果有）
    const thirdPartyAccounts = (userInfo?.thirdPartyAccounts || {}) as Record<string, unknown>

    StorageManager.setItem(STORAGE_KEYS.USER_DATA, {
      ...existingData,
      ...userData,
      thirdPartyAccounts: {
        accessToken: token,
        refreshToken: refreshToken || '',
        expiresAt: thirdPartyAccounts.expiresAt,
        refreshExpiresAt: thirdPartyAccounts.refreshExpiresAt,
      },
      fundInfo: walletStore.fundInfo,
      vipInfo: vipStore.vipInfo,
      loginTime: currentTime,
      lastActiveTime: currentTime,
    })

    logger.debug('[AuthFlowService] Auth state saved', {
      uuid: (userData as Record<string, unknown>).uuid,
      nickname: (userData as Record<string, unknown>).nickname,
      isVip: (userData as Record<string, unknown>).isVip,
    })
  }

  /**
   * 确保用户信息已加载（带防重入锁）
   * 关键优化：避免并发调用和重复请求
   */
  private static async ensureUserInfo(): Promise<void> {
    // 如果已有用户信息，直接返回
    const existingUser = getAuthUser()
    if (existingUser && existingUser.uuid) {
      return
    }

    // 防重入：如果正在获取，等待现有请求
    if (isFetchingUserInfo && fetchUserInfoPromise) {
      logger.debug('[AuthFlowService] Waiting for existing fetchUserInfo request')
      await fetchUserInfoPromise
      return
    }

    // 设置锁
    isFetchingUserInfo = true

    try {
      // 创建并保存 Promise
      fetchUserInfoPromise = (async () => {
        const authStoreInstance = useAuthStore()
        const storeWithFetch = authStoreInstance as { fetchUserInfo?: () => Promise<void> }
        if (storeWithFetch.fetchUserInfo) {
          await storeWithFetch.fetchUserInfo()
        }
      })()

      await fetchUserInfoPromise
      logger.debug('[AuthFlowService] User info fetched successfully')
    } catch (error) {
      logger.warn('[AuthFlowService] Failed to get user info', { error })
      // 不抛出错误，使用现有数据
    } finally {
      // 释放锁
      isFetchingUserInfo = false
      fetchUserInfoPromise = null
    }
  }

  /**
   * 规范化用户信息
   * 处理后端返回的完整用户数据结构，包括 authInfo、vipLevelVO、userMargin 等
   */
  private static normalizeUserInfo(userInfo: Record<string, unknown>): Record<string, unknown> {
    // 从 authInfo 中提取认证信息（后端数据结构嵌套在 authInfo 中）
    const authInfoData = userInfo.authInfo as
      | {
          email?: string
          phone?: string
          userUuid?: string
          username?: string
          birthday?: string
        }
      | undefined

    // 解析 UUID：尝试多种可能的字段名
    const resolvedUuid = (userInfo.uuid ||
      userInfo.id ||
      authInfoData?.userUuid ||
      (userInfo.thirdPartyAccounts as Record<string, unknown>)?.userUuid ||
      '') as string

    // 计算显示名称：优先使用 name、nickname，最后才用 username
    const displayName = (userInfo.name ||
      userInfo.nickname ||
      authInfoData?.username ||
      userInfo.username ||
      userInfo.phone ||
      authInfoData?.phone ||
      '') as string

    // 提取 VIP 等级详情
    const vipLevelVOData = userInfo.vipLevelVO as
      | {
          id?: string
          title?: string
          levelName?: string
          level?: number
          levelValue?: number
          remark?: string
          userVip?: {
            progress?: number
            isValid?: number
          }
          [key: string]: unknown
        }
      | undefined

    // 提取用户余额/资金信息
    const userMarginData = userInfo.userMargin as
      | {
          id?: string
          userUuid?: string
          tokenQuantity?: string | number
          tokenFree?: string | number
          [key: string]: unknown
        }
      | undefined

    // 提取开发者链接信息
    const developerLinkData = userInfo.developerLink as Record<string, unknown> | undefined

    // 处理 isVip（兼容数值和布尔值）
    const isVipRaw = userInfo.isVip
    const isVipValue = typeof isVipRaw === 'number' ? isVipRaw > 0 : Boolean(isVipRaw)

    // 提取身份类型（0-普通会员, 1-操盘手, 2-私董会）
    const identityType =
      (userInfo.identityType as number) ??
      (userInfo.identityTypy as number) ?? // 兼容拼写错误
      0

    return {
      // 基础信息
      id: resolvedUuid || (userInfo.id as string) || '',
      uuid: resolvedUuid,
      name: displayName, // 添加 name 字段，供跨项目使用
      username: (userInfo.username || authInfoData?.username || userInfo.phone || '') as string,
      email: (authInfoData?.email || userInfo.email || '') as string,
      phone: (authInfoData?.phone || userInfo.phone || '') as string,
      nickname: displayName || (userInfo.username as string) || '',
      avatar: (userInfo.avatar || '') as string,
      gender: userInfo.gender ?? 0,
      birthday: (userInfo.birthday || authInfoData?.birthday || '') as string,
      signature: (userInfo.signature || '') as string,
      status: userInfo.status ?? 1,
      isVip: isVipValue,
      inviteCode: (userInfo.inviteCode || '') as string,
      parentId: (userInfo.parentId || '') as string,
      createTime: (userInfo.createTime || userInfo.createdAt || new Date().toISOString()) as string,
      updateTime: (userInfo.updateTime || userInfo.updatedAt || new Date().toISOString()) as string,
      needPwd:
        (userInfo as { needPwd?: number; need_pwd?: number }).needPwd ??
        (userInfo as { needPwd?: number; need_pwd?: number }).need_pwd ??
        0,
      // 身份类型
      identityType,
      // VIP 等级详情
      vipLevelVO: vipLevelVOData
        ? {
            levelName: vipLevelVOData.title || vipLevelVOData.levelName || '',
            levelValue: vipLevelVOData.level || vipLevelVOData.levelValue || 0,
            ...vipLevelVOData,
          }
        : undefined,
      // 原始 authInfo 数据（保留完整结构）
      authInfo: authInfoData,
      // 用户余额信息
      userMargin: userMarginData,
      // 开发者链接信息
      developerLink: developerLinkData,
    }
  }

  /**
   * 检查是否需要注册
   */
  private static checkNeedRegister(response: UnifiedLoginResponse): boolean {
    const t = getTranslator()
    const message = response.message || ''
    const code = response.code

    return (
      message.includes(t('auth.userDoesNotExist')) ||
      message.includes(t('auth.accountDoesNotExist')) ||
      message.includes(t('auth.userNotRegistered')) ||
      message.includes('not found') ||
      code === 404 ||
      code === 4001
    )
  }

  /**
   * 统一重定向处理
   */
  static async redirectAfterLogin(options: RedirectOptions = {}): Promise<void> {
    const { source, redirectUrl, token, refreshToken, expiresIn, userInfo } = options

    // 检查是否有教育平台跳转需求
    const eduRedirectPlatform = sessionStorage.getItem('edu_redirect_platform')
    if (eduRedirectPlatform === 'eduWeb' || eduRedirectPlatform === 'eduAdmin') {
      sessionStorage.removeItem('edu_redirect_platform')
      const success = await this.redirectToEduPlatform(eduRedirectPlatform)
      if (success) {
        return
      }
      // 如果教育平台跳转失败，继续正常的重定向流程
    }

    // 仅总管理端/教育端（admin、edu-web、edu-admin）才跨项目跳转；user/sms 为官网登录不跳转
    const isCrossProjectSource = source && ['admin', 'edu-web', 'edu-admin'].includes(source)
    if (isCrossProjectSource && redirectUrl) {
      try {
        const redirectUrlObj = new URL(redirectUrl)
        if (token) {
          redirectUrlObj.searchParams.set('token', token)
        }
        if (refreshToken) {
          redirectUrlObj.searchParams.set('refreshToken', refreshToken)
        }
        if (expiresIn) {
          redirectUrlObj.searchParams.set('expiresIn', String(expiresIn))
        }
        if (userInfo) {
          redirectUrlObj.searchParams.set('userInfo', encodeURIComponent(JSON.stringify(userInfo)))
        }

        logger.info('[AuthFlowService] Cross-project redirect', { url: redirectUrlObj.toString() })
        window.location.href = redirectUrlObj.toString()
        return
      } catch (error) {
        logger.error('[AuthFlowService] Failed to build redirect URL', { error })
      }
    }

    // 本项目内重定向
    const savedReturnPath = StorageManager.getItem<string>(STORAGE_KEYS.AUTH_RETURN_PATH)
    let targetPath = '/'

    // 验证路径是否为有效的前端路由
    const isValidFrontendPath = (path: string): boolean => {
      if (!path || path.trim() === '') return false
      const apiPathPatterns = ['/api/', '/login/pwd/', '/auth/', '/prod-api/', '/message/', '/api/v1/auth/']
      return !apiPathPatterns.some(pattern => path.startsWith(pattern))
    }

    if (savedReturnPath && savedReturnPath !== '/login' && isValidFrontendPath(savedReturnPath)) {
      targetPath = savedReturnPath
      StorageManager.removeItem(STORAGE_KEYS.AUTH_RETURN_PATH)
    }

    logger.info('[AuthFlowService] Same-project redirect', { path: targetPath })

    // 使用 router 进行跳转
    try {
      const router = useRouter()
      void router.push(targetPath)
    } catch {
      // 如果 router 不可用，使用 window.location
      window.location.href = targetPath
    }
  }

  /**
   * 跳转到教育平台
   * @param platform 平台类型：eduWeb=用户端，eduAdmin=管理端
   * @returns 是否成功发起跳转
   */
  private static async redirectToEduPlatform(platform: 'eduWeb' | 'eduAdmin'): Promise<boolean> {
    const t = getTranslator()

    try {
      const authStore = useAuthStore()
      const storedUserData = getStoredData() as Record<string, unknown> | null

      // 获取用户 UUID
      const storeUser = authStore.user as { uuid?: string; id?: string } | null
      let userUuid = storeUser?.uuid || storeUser?.id || ''

      // 尝试从 JWT token 中解析 UUID
      if (!userUuid) {
        const accessToken =
          (storedUserData?.thirdPartyAccounts as Record<string, string>)?.accessToken ||
          authStore.token
        if (accessToken) {
          try {
            const parts = accessToken.split('.')
            if (parts.length === 3) {
              const payload = JSON.parse(atob(parts[1]))
              userUuid = payload.uuid || ''
            }
          } catch {
            // JWT 解析失败，忽略
          }
        }
      }

      // 尝试从 storedUserData 获取
      if (!userUuid) {
        userUuid = (storedUserData?.uuid ?? storedUserData?.id ?? '') as string
      }

      if (!userUuid) {
        logger.warn('[AuthFlowService] Cannot get user UUID, skipping education platform redirect')
        return false
      }

      // 构建教育平台 URL
      const getEduPlatformUrl = (port: number, path: string = '/index') => {
        const protocol = window.location.protocol
        const hostname = window.location.hostname
        return `${protocol}//${hostname}:${port}${path}`
      }

      const baseUrl = platform === 'eduAdmin' ? getEduPlatformUrl(8200) : getEduPlatformUrl(8100)
      const platformType = platform === 'eduAdmin' ? EduPlatformType.ADMIN : EduPlatformType.USER

      logger.info('[AuthFlowService] Initiating education platform SSO login', {
        platform,
        platformType: platformType === 1 ? '管理员端' : '会员端',
      })

      // 调用 SSO 接口
      const ssoResponse = await ssoLoginByUuid({
        uuid: userUuid,
        platform: platformType,
      })

      const ssoCode = (ssoResponse as { code?: number }).code
      const ssoMsg = (ssoResponse as { msg?: string }).msg ?? ssoResponse.message

      if (ssoCode === 555) {
        ElMessage.warning(
          ssoMsg || t('auth.eduPlatformUserNotLinked')
        )
        return false
      }

      if (!ssoResponse.success || !ssoResponse.data) {
        ElMessage.error(ssoMsg || t('auth.ssoLoginFailed'))
        return false
      }

      // 构建跳转 URL
      const redirectUrl = buildEduPlatformUrl(baseUrl, ssoResponse.data)

      logger.info('[AuthFlowService] Redirecting to education platform', {
        redirectUrl: redirectUrl.substring(0, 100) + '...',
      })
      window.location.href = redirectUrl
      return true
    } catch (error) {
      logger.error('[AuthFlowService] Failed to redirect to education platform', error)
      ElMessage.error(t('auth.eduPlatformRedirectFailed'))
      return false
    }
  }

  /**
   * 显示登录成功消息
   */
  static showSuccess(message?: string): void {
    const t = getTranslator()
    ElMessage.success(message || t('auth.loginSuccess'))
  }

  /**
   * 显示登录错误消息
   */
  static showError(message: string): void {
    ElMessage.error(message)
  }

  /**
   * 计算过期时间（秒）
   */
  static calculateExpiresInSeconds(duration?: LoginDuration): number {
    const loginDurationValue =
      duration?.value ||
      StorageManager.getItem<LoginDuration>(STORAGE_KEYS.LOGIN_DURATION)?.value ||
      getDefaultLoginDuration()
    const expiryTime = calculateExpiryTime(loginDurationValue)

    if (expiryTime) {
      return Math.floor((new Date(expiryTime).getTime() - Date.now()) / 1000)
    }

    // 默认 7 天
    return 3600 * 24 * 7
  }
}

// 导出便捷函数
export const authFlowLogin = AuthFlowService.login.bind(AuthFlowService)
export const authFlowPhoneLogin = AuthFlowService.phoneLogin.bind(AuthFlowService)
export const authFlowRedirect = AuthFlowService.redirectAfterLogin.bind(AuthFlowService)
