import { defineStore } from 'pinia'
import { computed } from 'vue'
import { t } from '@/utils/i18n'
import { getI18nGlobal } from '@/locales'
import {
  login as apiLogin,
  register as apiRegister,
  phoneLogin,
  completePhoneLogin,
  logout as apiLogout,
} from '@/api/user'
import { StorageManager, STORAGE_KEYS } from '@/utils/storage'
import { logger } from '@/utils/logger'
import type { LoginDuration } from '@/utils/login-duration'
import type { LoginParams, RegisterParams } from '@/types'
import type { UserInfoData, UserFundInfo, UserVipInfo } from '@/api/user'
import type { LoginResponseData } from './types'
import { buildUserFromLoginResponse } from './utils'
import { useTokenStore } from './token'
import { useUserStore } from './user'
import { useWalletStore } from './wallet'
import { useVipStore } from './vip'
import { usePermissionsStore } from './permissions'
import { useThirdPartyStore } from './thirdParty'

export const useAuthStore = defineStore('auth', () => {
  // 2026-06-25 修复: 顶层 6 个子 store 调用全部包 try/catch, 失败时为 null,
  // 通过 getter 在需要时(在 computed/methods 被访问时)重新尝试.
  // 解决 Vite HMR 抖动 / 动态 import 完成前 setup 阶段偶发的
  //   'getActivePinia() was called but there was no active Pinia' 错误.
  // 注意: Pinia 同 ID 的 store 第二次调用会返回缓存实例, 不会重复初始化,
  //   所以即使 getter 多次被调用也是安全的.
  let tokenStore: ReturnType<typeof useTokenStore> | null = null
  let userStore: ReturnType<typeof useUserStore> | null = null
  let walletStore: ReturnType<typeof useWalletStore> | null = null
  let vipStore: ReturnType<typeof useVipStore> | null = null
  let permissionsStore: ReturnType<typeof usePermissionsStore> | null = null
  let thirdPartyStore: ReturnType<typeof useThirdPartyStore> | null = null

  try {
    tokenStore = useTokenStore()
  } catch (e) {
    logger.debug('[AuthStore] tokenStore unavailable on init, will lazy load:', e)
  }
  try {
    userStore = useUserStore()
  } catch (e) {
    logger.debug('[AuthStore] userStore unavailable on init, will lazy load:', e)
  }
  try {
    walletStore = useWalletStore()
  } catch (e) {
    logger.debug('[AuthStore] walletStore unavailable on init, will lazy load:', e)
  }
  try {
    vipStore = useVipStore()
  } catch (e) {
    logger.debug('[AuthStore] vipStore unavailable on init, will lazy load:', e)
  }
  try {
    permissionsStore = usePermissionsStore()
  } catch (e) {
    logger.debug('[AuthStore] permissionsStore unavailable on init, will lazy load:', e)
  }
  try {
    thirdPartyStore = useThirdPartyStore()
  } catch (e) {
    logger.debug('[AuthStore] thirdPartyStore unavailable on init, will lazy load:', e)
  }

  const getTokenStore = (): ReturnType<typeof useTokenStore> | null => {
    if (tokenStore) return tokenStore
    try {
      tokenStore = useTokenStore()
      return tokenStore
    } catch (e) {
      logger.debug('[AuthStore] tokenStore lazy load failed:', e)
      return null
    }
  }

  const getUserStore = (): ReturnType<typeof useUserStore> | null => {
    if (userStore) return userStore
    try {
      userStore = useUserStore()
      return userStore
    } catch (e) {
      logger.debug('[AuthStore] userStore lazy load failed:', e)
      return null
    }
  }

  const getWalletStore = (): ReturnType<typeof useWalletStore> | null => {
    if (walletStore) return walletStore
    try {
      walletStore = useWalletStore()
      return walletStore
    } catch (e) {
      logger.debug('[AuthStore] walletStore lazy load failed:', e)
      return null
    }
  }

  const getVipStore = (): ReturnType<typeof useVipStore> | null => {
    if (vipStore) return vipStore
    try {
      vipStore = useVipStore()
      return vipStore
    } catch (e) {
      logger.debug('[AuthStore] vipStore lazy load failed:', e)
      return null
    }
  }

  const getPermissionsStore = (): ReturnType<typeof usePermissionsStore> | null => {
    if (permissionsStore) return permissionsStore
    try {
      permissionsStore = usePermissionsStore()
      return permissionsStore
    } catch (e) {
      logger.debug('[AuthStore] permissionsStore lazy load failed:', e)
      return null
    }
  }

  const getThirdPartyStore = (): ReturnType<typeof useThirdPartyStore> | null => {
    if (thirdPartyStore) return thirdPartyStore
    try {
      thirdPartyStore = useThirdPartyStore()
      return thirdPartyStore
    } catch (e) {
      logger.debug('[AuthStore] thirdPartyStore lazy load failed:', e)
      return null
    }
  }

  const isLoggedIn = computed(() => getPermissionsStore()?.isLoggedIn ?? false)
  const isVip = computed(() => getUserStore()?.isVip ?? false)
  const userUuid = computed(() => getUserStore()?.userUuid ?? '')
  const nickname = computed(() => getUserStore()?.nickname ?? '')
  const avatar = computed(() => getUserStore()?.avatar ?? '')
  const userStatus = computed(() => getUserStore()?.userStatus ?? 0)
  const inviteCode = computed(() => getUserStore()?.inviteCode ?? '')
  const balance = computed(() => getWalletStore()?.balance ?? 0)
  const frozenAmount = computed(() => getWalletStore()?.frozenAmount ?? 0)
  const totalRecharge = computed(() => getWalletStore()?.totalRecharge ?? 0)
  const totalConsumption = computed(() => getWalletStore()?.totalConsumption ?? 0)
  const vipLevel = computed(() => getVipStore()?.vipLevel ?? '')
  const isVipActive = computed(() => getVipStore()?.isVipActive ?? false)
  const vipEndTime = computed(() => getVipStore()?.vipEndTime ?? '')
  const isInitialized = computed(() => getTokenStore()?.isInitialized ?? false)
  const isTokenExpired = computed(() => getTokenStore()?.isTokenExpired ?? true)
  // 下面 4 个 computed 是函数型权限检查, store 不可用时返回始终拒绝的占位函数
  const hasPermission = computed(() => (permission: string) => getPermissionsStore()?.hasPermission(permission) ?? false)
  const hasRole = computed(() => (role: string) => getPermissionsStore()?.hasRole(role) ?? false)
  const canUseFeature = computed(() => (feature: string) => getPermissionsStore()?.canUseFeature(feature) ?? false)
  const isLoading = computed(() => getUserStore()?.isLoading || getThirdPartyStore()?.isLoading || false)
  const initCompleted = computed(() => getTokenStore()?.initCompleted ?? false)

  const initAuth = async () => {
    logger.debug('[AuthStore] Initializing auth state...')

    const ts = getTokenStore()
    const us = getUserStore()
    const ws = getWalletStore()
    const vs = getVipStore()
    if (!ts || !us || !ws || !vs) {
      logger.warn('[AuthStore] Required sub-stores unavailable, skip initAuth')
      return
    }

    if (ts.checkExpiryAndClear()) {
      return
    }

    if (!ts.restoreToken()) {
      logger.debug('[AuthStore] No stored token found, remaining logged out')
      return
    }

    const storedUserData = StorageManager.getItem<Record<string, unknown>>(STORAGE_KEYS.USER_DATA)

    if (storedUserData) {
      us.restoreUserFromStorage()
      ws.restoreFundInfo()
      vs.restoreVipInfo()

      if (storedUserData.loginTime) {
        ts.loginTime = storedUserData.loginTime as string
      }
      if (storedUserData.lastActiveTime) {
        ts.lastActiveTime = storedUserData.lastActiveTime as string
      }

      logger.info('[AuthStore] Restored user state from storage:', us.user?.username || us.user?.nickname)

      us.fetchUserInfo().catch((error: any) => {
        logger.warn('[AuthStore] Background refresh user info failed (using cached data):', error)
      })
    } else {
      logger.debug('[AuthStore] Has token but no user data, attempting to fetch user info')
      try {
        await us.fetchUserInfo()
        logger.info('[AuthStore] Successfully fetched user info')
      } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        const status = error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { status?: number } }).response?.status
          : undefined
        const isNotLoggedInError = !status && (
          errorMessage.includes('未登录') ||
          errorMessage.includes('请先登录') ||
          errorMessage.includes('not logged in')
        )

        if (isNotLoggedInError) {
          logger.debug('[AuthStore] User not logged in, clearing token')
        } else {
          logger.error('[AuthStore] Failed to fetch user info, clearing invalid token:', error)
        }
        clearAuthState()
      }
    }

    ts.setInitCompleted(true)
    logger.debug('[AuthStore] Initialization complete')
  }

  const clearAuthState = () => {
    const ts = getTokenStore()
    const us = getUserStore()
    const ws = getWalletStore()
    const vs = getVipStore()
    if (ts) ts.clearTokens()
    if (us) us.clearUser()
    if (ws) ws.clearFundInfo()
    if (vs) vs.clearVipInfo()
  }

  const register = async (registerData: RegisterParams) => {
    const us = getUserStore()
    const ts = getTokenStore()
    if (!us || !ts) {
      logger.warn('[AuthStore] userStore/tokenStore unavailable, cannot register')
      throw new Error(t('error.auth.服务尚未就绪'))
    }
    us.isLoading = true
    try {
      if (registerData.type === 'phone') {
        if (!registerData.phone || !registerData.code || !registerData.password) {
          throw new Error(t('error.auth.手机号验证码和密'))
        }
      } else {
        if (!registerData.username || !registerData.password) {
          throw new Error(t('error.auth.用户名和密码不能1'))
        }
      }

      const requestData: {
        username?: string
        password: string
        email?: string
        phone?: string
        code?: string
        captcha?: string
        inviteCode?: string
      } = { password: registerData.password }

      if (registerData.type === 'phone') {
        requestData.phone = registerData.phone
        requestData.code = registerData.code
        requestData.username = registerData.username || registerData.phone
        requestData.email = registerData.email || `${registerData.phone}@example.com`
      } else {
        requestData.username = registerData.username || ''
        requestData.email = registerData.email || `${registerData.username || 'user'}@example.com`
        if (registerData.phone && registerData.code) {
          requestData.phone = registerData.phone
          requestData.code = registerData.code
        }
        if (registerData.code && !registerData.phone) {
          requestData.captcha = registerData.code
        }
      }

      if (registerData.inviteCode) {
        requestData.inviteCode = registerData.inviteCode
      }

      const response = await apiRegister({
        username: requestData.username || '',
        password: requestData.password,
        email: requestData.email || '',
        phone: requestData.phone,
        code: requestData.code,
        captcha: requestData.captcha,
        inviteCode: requestData.inviteCode,
      })

      const responseData = response.data

      let tokenValue: string
      let refreshTokenValue: string
      let userInfo: UserInfoData | null = null

      if (typeof responseData === 'object' && responseData !== null) {
        if ('token' in responseData) {
          tokenValue = responseData.token || ''
          refreshTokenValue = responseData.refreshToken || ''
          userInfo = (responseData as { user?: UserInfoData }).user || null
        } else if ('tokenType' in responseData || 'accessToken' in responseData || 'access_token' in responseData) {
          // 2026-06-24 修复: 后端 _build_token_data 返回 accessToken/access_token 双写, 非 token 字段
          tokenValue = (responseData as { accessToken?: string; access_token?: string }).accessToken
            || (responseData as { access_token?: string }).access_token
            || (responseData as { token?: string }).token || ''
          refreshTokenValue = (responseData as { refreshToken?: string }).refreshToken
            || (responseData as { refresh_token?: string }).refresh_token || ''
          userInfo = (responseData as { user?: UserInfoData }).user || null
        } else {
          throw new Error(t('error.auth.无效的响应数据格2'))
        }
      } else {
        throw new Error(t('error.auth.无效的响应数据格3'))
      }

      ts.setToken(tokenValue, refreshTokenValue)

      if (userInfo) {
        us.user = {
          id: userInfo.id || userInfo.uuid || '',
          uuid: userInfo.uuid || userInfo.id || '',
          username: userInfo.username || registerData.username || registerData.phone || '',
          email: userInfo.email || registerData.email || '',
          phone: userInfo.phone || registerData.phone || '',
          nickname: userInfo.nickname || userInfo.username || registerData.username || registerData.phone || '',
          avatar: userInfo.avatar || '',
          gender: userInfo.gender || 0,
          birthday: userInfo.birthday || '',
          signature: userInfo.signature || '',
          status: userInfo.status || 1,
          isVip: userInfo.isVip || false,
          inviteCode: userInfo.inviteCode || registerData.inviteCode || '',
          createTime: userInfo.createTime || new Date().toISOString(),
          updateTime: userInfo.updateTime || new Date().toISOString(),
        } as UserInfoData
      }

      const userData = {
        thirdPartyAccounts: { accessToken: tokenValue, refreshToken: refreshTokenValue },
        username: registerData.username || registerData.phone || '',
        email: registerData.email || '',
        phone: registerData.phone || '',
        loginTime: ts.loginTime,
        lastActiveTime: ts.lastActiveTime,
        ...(us.user || {}),
      }

      StorageManager.setItem(STORAGE_KEYS.USER_DATA, userData)

      await us.fetchUserInfo()

      return response
    } catch (error) {
      logger.error('Registration failed:', error)
      throw error
    } finally {
      us.isLoading = false
    }
  }

  const login = async (loginData: LoginParams) => {
    const us = getUserStore()
    const ts = getTokenStore()
    const ws = getWalletStore()
    const vs = getVipStore()
    if (!us || !ts || !ws || !vs) {
      logger.warn('[AuthStore] Required sub-stores unavailable, cannot login')
      throw new Error(t('error.auth.服务尚未就绪'))
    }
    us.isLoading = true
    try {
      let response

      if (loginData.type === 'phone' && loginData.phone && loginData.code) {
        const verifyResponse = await phoneLogin({ phone: loginData.phone, code: loginData.code })
        const tempKey = verifyResponse.data
        response = await completePhoneLogin({ phone: loginData.phone, tempKey: tempKey || '' })
      } else if (loginData.username && loginData.password) {
        response = await apiLogin({ username: loginData.username, password: loginData.password })
      } else {
        throw new Error(t('error.auth.登录信息不完整4'))
      }

      const tokenData = response.data as LoginResponseData

      const tokenValue =
        tokenData?.token ||
        tokenData?.accessToken ||
        tokenData?.userToken ||
        tokenData?.thirdPartyAccounts?.accessToken ||
        ''
      const refreshTokenValue = tokenData?.refreshToken || tokenData?.thirdPartyAccounts?.refreshToken || ''

      ts.setToken(tokenValue, refreshTokenValue)
      ts.setLoginExpiry()

      const { user, fundInfo, vipInfo } = buildUserFromLoginResponse(tokenData, loginData)
      us.user = user

      if (fundInfo) {
        ws.setFundInfo(fundInfo)
      }
      if (vipInfo) {
        vs.setVipInfo(vipInfo)
      }

      const completeUserData = {
        ...user,
        thirdPartyAccounts: {
          accessToken: tokenValue,
          refreshToken: refreshTokenValue,
          expiresAt: tokenData?.thirdPartyAccounts?.expiresAt,
          refreshExpiresAt: tokenData?.thirdPartyAccounts?.refreshExpiresAt,
        },
        authInfo: tokenData?.authInfo,
        fundInfo,
        vipInfo,
        developerLink: tokenData?.developerLinks,
        loginTime: ts.loginTime,
        lastActiveTime: ts.lastActiveTime,
        id: user?.id || user?.uuid || '',
        uuid: user?.uuid || '',
        phone: user?.phone || '',
        email: user?.email || '',
        nickname: user?.nickname || '',
      }

      StorageManager.setItem(STORAGE_KEYS.USER_DATA, completeUserData)

      logger.debug('[AuthStore] Login successful, user info saved:', {
        uuid: user?.uuid,
        nickname: user?.nickname,
        phone: user?.phone,
        email: user?.email,
        isVip: user?.isVip,
        vipLevel: tokenData?.vipLevelVO?.title,
        balance: fundInfo?.balance,
      })

      try {
        const { MultiDeviceService } = await import('@/utils/multiDeviceService')
        await MultiDeviceService.registerCurrentDevice()
      } catch (e) {
        logger.warn('[AuthStore] Device registration failed', e)
      }

      try {
        const { SecurityLogService } = await import('@/utils/securityLogService')
        await SecurityLogService.logLogin(true)
      } catch (e) {
        logger.warn('[AuthStore] Failed to record login log', e)
      }

      let currentLocation: { country?: string; city?: string; ip?: string } | null = null
      let checkResult: { isSuspicious: boolean; reason?: string } = { isSuspicious: false }

      try {
        const { LocationService } = await import('@/utils/locationService')
        currentLocation = await LocationService.fetchCurrentLocation()
        checkResult = LocationService.checkSuspiciousLogin(currentLocation)

        if (checkResult.isSuspicious) {
          const { SecurityLogService } = await import('@/utils/securityLogService')
          await SecurityLogService.logSuspiciousLogin(checkResult.reason || '异地登录')
          logger.warn('[AuthStore] Suspicious login detected', checkResult)
        }

        LocationService.saveLoginLocation({
          ...currentLocation,
          loginTime: Date.now(),
        } as import('@/utils/locationService').LoginLocation)
      } catch (e) {
        logger.warn('[AuthStore] Location detection failed', e)
      }

      try {
        const { LoginBehaviorService } = await import('@/utils/loginBehaviorService')
        const { DeviceService } = await import('@/utils/deviceService')
        const deviceId = DeviceService.getDeviceId() || 'unknown'
        const deviceName = navigator.userAgent.includes('Windows') ? 'Windows' :
                          navigator.userAgent.includes('Mac') ? 'Mac' :
                          navigator.userAgent.includes('Linux') ? 'Linux' : 'Unknown Device'
        LoginBehaviorService.recordLogin(deviceId, deviceName, currentLocation || undefined)
      } catch (e) {
        logger.warn('[AuthStore] Failed to record login behavior', e)
      }

      try {
        const { SecurityNotificationService } = await import('@/utils/securityNotificationService')
        if (checkResult.isSuspicious) {
          SecurityNotificationService.notifySuspiciousLogin(checkResult.reason || '异地登录')
        }
      } catch (e) {
        logger.warn('[AuthStore] Failed to send security notification', e)
      }

      us.fetchUserInfo().catch((error: any) => {
        logger.warn('[AuthStore] Background refresh user info failed (using data from login response):', error)
      })

      try {
        const { websocketService } = await import('@/utils/websocket')
        await websocketService.connect(tokenValue)
      } catch (error) {
        logger.warn('WebSocket connection failed', error)
      }

      return response
    } catch (error) {
      logger.error(getI18nGlobal().t('logs.loginFailed'), error)
      throw error
    } finally {
      us.isLoading = false
    }
  }

  const logout = async () => {
    try {
      const { websocketService } = await import('@/utils/websocket')
      websocketService.disconnect()
    } catch (_error) {
      // 静默失败
    }
    // 2026-06-24 修复: 恢复调用后端 /api/v1/auth/logout 使 token 加入黑名单
    try {
      await apiLogout()
    } catch {
      // 后端登出失败不阻塞本地清理
    } finally {
      sessionStorage.setItem('__logout_flag__', Date.now().toString())
      try {
        const { SecurityLogService } = await import('@/utils/securityLogService')
        await SecurityLogService.logLogout()
      } catch {
        // 静默处理
      }
      clearAuthState()
      try {
        const { RememberMeService } = await import('@/utils/rememberMeService')
        RememberMeService.clearCredentials()
      } catch {
        // 静默处理
      }
    }
  }

  const thirdPartyLogin = async (loginData: { token: string; refreshToken?: string; user: UserInfoData | Record<string, unknown>; loginType: string }) => {
    const tps = getThirdPartyStore()
    if (!tps) {
      logger.warn('[AuthStore] thirdPartyStore unavailable, cannot thirdPartyLogin')
      return false
    }
    return tps.thirdPartyLogin(loginData)
  }

  const refreshTokens = async () => {
    try {
      const ts = getTokenStore()
      const us = getUserStore()
      if (!ts || !us) {
        logger.warn('[AuthStore] tokenStore/userStore unavailable, cannot refreshTokens')
        return { success: false }
      }
      const savedRefreshToken = ts.refreshToken
      if (!savedRefreshToken) {
        await us.fetchUserInfo()
        return { success: true }
      }
      const success = await refreshTokenAction(savedRefreshToken)
      if (!success) {
        await logout()
      }
      return { success }
    } catch (error) {
      logger.error(getI18nGlobal().t('logs.refreshTokenFailed'), error)
      // 2026-06-25 加固: logout 单独 try/catch, 防止其失败绕过本 catch,
      // 进而绕过 throw error 导致 refreshTokens 出现"半崩溃"状态.
      try {
        await logout()
      } catch (logoutErr) {
        logger.warn('[AuthStore] logout during refreshTokens error recovery also failed:', logoutErr)
      }
      throw error
    }
  }

  const refreshTokenAction = async (savedRefreshToken: string): Promise<boolean> => {
    try {
      const us = getUserStore()
      const ts = getTokenStore()
      if (!us || !ts) {
        logger.warn('[AuthStore] userStore/tokenStore unavailable, cannot refreshTokenAction')
        return false
      }
      us.isLoading = true
      logger.info('[AuthStore] Attempting to auto-login with refreshToken')

      const { refreshToken: refreshTokenApi } = await import('@/api/user')
      const response = await refreshTokenApi(savedRefreshToken)

      if (response.success && response.data) {
        const tokenData = response.data
        const newToken = tokenData.token || ''
        const newRefreshToken = tokenData.refreshToken || savedRefreshToken

        if (!newToken) {
          logger.warn('[AuthStore] Refresh response missing token')
          const { RememberMeService } = await import('@/utils/rememberMeService')
          RememberMeService.recordAutoLoginFailure('刷新响应缺少 token')
          return false
        }

        ts.setToken(newToken, newRefreshToken)
        await us.fetchUserInfo()

        const { RememberMeService } = await import('@/utils/rememberMeService')
        RememberMeService.updateRefreshToken(newRefreshToken)
        RememberMeService.resetAutoLoginRecord()

        logger.info('[AuthStore] Auto-login with refreshToken succeeded')
        return true
      }

      logger.warn('[AuthStore] Refresh token response invalid', response)
      const { RememberMeService } = await import('@/utils/rememberMeService')
      RememberMeService.recordAutoLoginFailure('刷新响应无效')
      return false
    } catch (error) {
      logger.error('[AuthStore] Auto-login with refreshToken failed', error)
      const { RememberMeService } = await import('@/utils/rememberMeService')
      RememberMeService.recordAutoLoginFailure(error instanceof Error ? error.message : '未知错误')
      return false
    } finally {
      const us = getUserStore()
      if (us) us.isLoading = false
    }
  }

  /** 拉取用户信息并同步余额、VIP 到各 store，确保页面显示与后端一致 */
  const fetchUserInfo = async () => {
    const us = getUserStore()
    const ws = getWalletStore()
    const vs = getVipStore()
    if (!us) {
      logger.warn('[AuthStore] userStore unavailable, cannot fetchUserInfo')
      return
    }
    const result = await us.fetchUserInfo()
    if (result && typeof result === 'object') {
      if (result.fundInfo && ws) ws.setFundInfo(result.fundInfo)
      if (result.vipInfo && vs) vs.setVipInfo(result.vipInfo)
    }
  }
  const updateUserInfo = (userInfo: Partial<UserInfoData>) => {
    const us = getUserStore()
    if (!us) {
      logger.warn('[AuthStore] userStore unavailable, cannot updateUserInfo')
      return
    }
    return us.updateUserInfo(userInfo)
  }
  const setAuthInfo = (info: UserInfoData) => {
    const us = getUserStore()
    if (!us) {
      logger.warn('[AuthStore] userStore unavailable, cannot setAuthInfo')
      return
    }
    return us.setAuthInfo(info)
  }
  const setFundInfo = (info: UserFundInfo) => {
    const ws = getWalletStore()
    if (!ws) {
      logger.warn('[AuthStore] walletStore unavailable, cannot setFundInfo')
      return
    }
    return ws.setFundInfo(info)
  }
  const setVipInfo = (info: UserVipInfo) => {
    const vs = getVipStore()
    if (!vs) {
      logger.warn('[AuthStore] vipStore unavailable, cannot setVipInfo')
      return
    }
    return vs.setVipInfo(info)
  }
  const setUser = (userData: { uuid?: string; nickname?: string; avatar?: string; isVip?: boolean; phone?: string }) => {
    const us = getUserStore()
    if (!us) {
      logger.warn('[AuthStore] userStore unavailable, cannot setUser')
      return
    }
    return us.setUser(userData)
  }

  const setAuthState = (
    newToken: string,
    newRefreshToken: string,
    userData: UserInfoData | null,
    options?: { loginDuration?: LoginDuration; skipStorage?: boolean }
  ) => {
    const ts = getTokenStore()
    const us = getUserStore()
    if (!ts || !us) {
      logger.warn('[AuthStore] tokenStore/userStore unavailable, cannot setAuthState')
      return
    }
    const currentTime = new Date().toISOString()

    ts.setToken(newToken, newRefreshToken)
    us.user = userData

    if (userData?.id) {
      us.authInfo = userData
    }

    if (options?.skipStorage) {
      return
    }

    ts.setLoginExpiry(options?.loginDuration)

    if (userData) {
      const existingData = StorageManager.getItem<Record<string, unknown>>(STORAGE_KEYS.USER_DATA) || {}
      StorageManager.setItem(STORAGE_KEYS.USER_DATA, {
        ...existingData,
        ...userData,
        thirdPartyAccounts: { accessToken: newToken, refreshToken: newRefreshToken || '' },
        loginTime: currentTime,
        lastActiveTime: currentTime,
      })
    }

    logger.debug('[AuthStore] setAuthState: Auth state updated atomically')
  }

  const updateLastActiveTime = () => {
    const ts = getTokenStore()
    if (!ts) {
      logger.warn('[AuthStore] tokenStore unavailable, cannot updateLastActiveTime')
      return
    }
    return ts.updateLastActiveTime()
  }
  const checkTokenExpiry = () => {
    const ts = getTokenStore()
    if (!ts) {
      logger.warn('[AuthStore] tokenStore unavailable, cannot checkTokenExpiry')
      return
    }
    return ts.checkTokenExpiry(() => refreshTokens().catch(error => logger.error('Token refresh failed:', error)))
  }
  const checkPermission = (permission: string): boolean => {
    const ps = getPermissionsStore()
    if (!ps) {
      logger.warn('[AuthStore] permissionsStore unavailable, cannot checkPermission')
      return false
    }
    return ps.checkPermission(permission)
  }
  const checkFeatureAccess = (feature: string): boolean => {
    const ps = getPermissionsStore()
    if (!ps) {
      logger.warn('[AuthStore] permissionsStore unavailable, cannot checkFeatureAccess')
      return false
    }
    return ps.checkFeatureAccess(feature)
  }
  const updateBalance = (newBalance: number) => {
    const ws = getWalletStore()
    if (!ws) {
      logger.warn('[AuthStore] walletStore unavailable, cannot updateBalance')
      return
    }
    return ws.updateBalance(newBalance)
  }
  const consumeBalance = (amount: number): boolean => {
    const ws = getWalletStore()
    if (!ws) {
      logger.warn('[AuthStore] walletStore unavailable, cannot consumeBalance')
      return false
    }
    try {
      return ws.consumeBalance(amount)
    } catch (e) {
      // 2026-06-25 加固: 子 store 内部抛错 (Pinia 未激活 / ref 抛错) 不应外溢
      // 业务上 consume 失败等价于余额不足, 返回 false
      logger.warn('[AuthStore] walletStore.consumeBalance threw, treat as failed:', e)
      return false
    }
  }
  const rechargeBalance = (amount: number) => {
    const ws = getWalletStore()
    if (!ws) {
      logger.warn('[AuthStore] walletStore unavailable, cannot rechargeBalance')
      return
    }
    return ws.rechargeBalance(amount)
  }

  return {
    token: computed(() => getTokenStore()?.token ?? ''),
    refreshToken: computed(() => getTokenStore()?.refreshToken ?? ''),
    user: computed(() => getUserStore()?.user ?? null),
    authInfo: computed(() => getUserStore()?.authInfo ?? null),
    fundInfo: computed(() => getWalletStore()?.fundInfo ?? null),
    vipInfo: computed(() => getVipStore()?.vipInfo ?? null),
    isLoading,
    loginTime: computed(() => getTokenStore()?.loginTime ?? ''),
    lastActiveTime: computed(() => getTokenStore()?.lastActiveTime ?? ''),
    isDemoMode: computed(() => getUserStore()?.isDemoMode ?? false),
    isFetchingUserInfo: computed(() => getUserStore()?.isFetchingUserInfo ?? false),

    isLoggedIn,
    isVip,
    userUuid,
    nickname,
    avatar,
    userStatus,
    inviteCode,
    balance,
    frozenAmount,
    totalRecharge,
    totalConsumption,
    vipLevel,
    isVipActive,
    vipEndTime,
    isInitialized,
    isTokenExpired,
    hasPermission,
    hasRole,
    canUseFeature,
    initCompleted,

    initAuth,
    login,
    register,
    logout,
    thirdPartyLogin,
    refreshTokens,
    refreshTokenAction,
    fetchUserInfo,
    updateUserInfo,
    setAuthInfo,
    setFundInfo,
    setVipInfo,
    setUser,
    setAuthState,
    updateLastActiveTime,
    checkTokenExpiry,
    checkPermission,
    checkFeatureAccess,
    updateBalance,
    consumeBalance,
    rechargeBalance,
  }
})

export { useTokenStore } from './token'
export { useUserStore } from './user'
export { useWalletStore } from './wallet'
export { useVipStore } from './vip'
export { usePermissionsStore } from './permissions'
export { useThirdPartyStore } from './thirdParty'
export * from './types'
