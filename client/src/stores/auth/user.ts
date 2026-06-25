import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getI18nGlobal } from '@/locales'
import { getUserInfo } from '@/api/user'
import { getStoredData } from '@/utils/request'
import { StorageManager, STORAGE_KEYS } from '@/utils/storage'
import { logger } from '@/utils/logger'
import type { UserInfoData, UserFundInfo, UserVipInfo } from '@/api/user'
import type { RawUserInfo } from './types'
import {
  extractNickname,
  extractEmail,
  extractPhone,
  extractUuid,
  extractIsVip,
  extractNeedPwd,
  saveUserDataToStorage,
} from './utils'
import { useTokenStore } from './token'

export const useUserStore = defineStore('user', () => {
  const user = ref<UserInfoData | null>(null)
  const authInfo = ref<UserInfoData | null>(null)
  const isLoading = ref(false)
  const isDemoMode = ref(import.meta.env.VITE_APP_DEMO_MODE === 'true')

  const isFetchingUserInfo = ref(false)
  let fetchUserInfoPromise: Promise<unknown> | null = null
  
  // 跟踪当前请求的"版本"，用于在竞态条件下取消旧请求
  let fetchUserInfoVersion = 0

  const isVip = computed(() => user.value?.isVip || false)
  const userUuid = computed(() => user.value?.uuid || '')
  const nickname = computed(() => user.value?.nickname || '')
  const avatar = computed(() => user.value?.avatar || '')
  const userStatus = computed(() => user.value?.status || 0)
  const inviteCode = computed(() => user.value?.inviteCode || '')

  const setUser = (userData: Partial<UserInfoData>) => {
    if (user.value) {
      user.value = { ...user.value, ...userData }
      saveUserDataToStorage(user.value)
    }
  }

  const updateUserInfo = (userInfo: Partial<UserInfoData>) => {
    if (user.value) {
      user.value = { ...user.value, ...userInfo }
      saveUserDataToStorage(user.value)
    }
  }

  const setAuthInfo = (info: UserInfoData) => {
    authInfo.value = info
  }

  const restoreUserFromStorage = (): boolean => {
    const storedUserData = StorageManager.getItem<Record<string, unknown>>(STORAGE_KEYS.USER_DATA)
    if (!storedUserData) return false

    const vipLevelVOData = storedUserData.vipLevelVO as {
      id?: string
      title?: string
      levelName?: string
      level?: number
      levelValue?: number
      remark?: string
      userVip?: { progress?: number; isValid?: number }
      [key: string]: unknown
    } | undefined

    const identityType = (storedUserData.identityType as number) ?? (storedUserData.identityTypy as number) ?? 0
    const isVipValue = extractIsVip(storedUserData.isVip as boolean | number | undefined)

    user.value = {
      id: (storedUserData.id || storedUserData.uuid || '') as string,
      uuid: (storedUserData.uuid || storedUserData.id || '') as string,
      username: (storedUserData.username || '') as string,
      email: extractEmail(storedUserData),
      phone: extractPhone(storedUserData),
      nickname: extractNickname(storedUserData),
      avatar: (storedUserData.avatar || storedUserData.avatarUrl || '') as string,
      gender: typeof storedUserData.gender === 'number' ? storedUserData.gender : 0,
      birthday: (storedUserData.birthday || '') as string,
      signature: (storedUserData.signature || '') as string,
      status: typeof storedUserData.status === 'number' ? storedUserData.status : 1,
      isVip: isVipValue,
      inviteCode: (storedUserData.inviteCode || '') as string,
      createTime: (storedUserData.createTime || storedUserData.createdAt || new Date().toISOString()) as string,
      updateTime: (storedUserData.updateTime || storedUserData.updatedAt || new Date().toISOString()) as string,
      needPwd: typeof storedUserData.needPwd === 'number' ? storedUserData.needPwd : 0,
      vipLevelVO: vipLevelVOData
        ? { levelName: vipLevelVOData.levelName || vipLevelVOData.title || '', levelValue: vipLevelVOData.levelValue || vipLevelVOData.level || 0, ...vipLevelVOData }
        : undefined,
      identityType,
      roles: Array.isArray(storedUserData.roles) ? (storedUserData.roles as string[]) : undefined,
    } as UserInfoData

    if (user.value.id) {
      authInfo.value = user.value
    }

    logger.info('[UserStore] Restored user state from storage:', user.value?.username || user.value?.nickname)
    return true
  }

  const fetchUserInfo = async (options: { ignoreAuthState?: boolean } = {}) => {
    // 竞态条件保护：如果有正在进行的请求，返回现有 Promise
    if (isFetchingUserInfo.value && fetchUserInfoPromise) {
      return fetchUserInfoPromise
    }

    // 为每次请求分配唯一版本号
    const currentVersion = ++fetchUserInfoVersion
    
    isFetchingUserInfo.value = true
    fetchUserInfoPromise = (async () => {
      try {
        // 检查 token 是否仍然有效（在等待期间可能已登出）
        // 2026-06-25 修复: useTokenStore 可能因 HMR 抖动失败, try/catch 兜底
        let tokenStore: ReturnType<typeof useTokenStore> | null = null
        try {
          tokenStore = useTokenStore()
        } catch (e) {
          logger.debug('[UserStore] tokenStore unavailable, skip auth check:', e)
        }
        if (!options.ignoreAuthState && tokenStore && !tokenStore.token) {
          // Token 已清除，跳过请求
          logger.debug('[UserStore] Token cleared, skipping fetchUserInfo')
          return null
        }
        
        const response = await getUserInfo()
        
        // 检查是否是过时的请求（在新请求发出后返回的旧请求）
        if (currentVersion !== fetchUserInfoVersion) {
          logger.debug('[UserStore] fetchUserInfo request is outdated, ignoring result')
          return null
        }
        const codeRaw = (response as unknown as { code?: number | string }).code
        const code = typeof codeRaw === 'string' ? Number(codeRaw) : codeRaw
        const ok = code === 200 || (response as unknown as { success?: boolean }).success === true
        if (!ok) {
          const message = (response as unknown as { message?: string; msg?: string }).message || (response as unknown as { message?: string; msg?: string }).msg
          throw new Error(message || getI18nGlobal().t('errors.loadDataFailed'))
        }

        const userInfoRaw = response.data as unknown
        const userInfoExtracted =
          userInfoRaw && typeof userInfoRaw === 'object' && 'data' in (userInfoRaw as Record<string, unknown>) &&
          ('code' in (userInfoRaw as Record<string, unknown>) || 'msg' in (userInfoRaw as Record<string, unknown>))
            ? ((userInfoRaw as Record<string, unknown>).data as unknown)
            : userInfoRaw

        if (!userInfoExtracted) {
          throw new Error(getI18nGlobal().t('errors.userInfoEmpty'))
        }

        const userInfo = userInfoExtracted as RawUserInfo
        const authInfoData = userInfo.authInfo
        const userEmail = userInfo.email || authInfoData?.email || ''
        const userPhone = userInfo.phone || authInfoData?.phone || ''

        const userMarginData = (userInfo as Record<string, unknown>).userMargin as {
          id?: string
          userUuid?: string
          tokenQuantity?: string | number
          tokenFree?: string | number
          [key: string]: unknown
        } | undefined

        let fundInfo: UserFundInfo | null = null
        if (userMarginData) {
          const tokenQuantityRaw = typeof userMarginData.tokenQuantity === 'string' ? parseFloat(userMarginData.tokenQuantity) : userMarginData.tokenQuantity || 0
          const tokenQuantity = Number.isFinite(Number(tokenQuantityRaw)) ? Number(tokenQuantityRaw) : 0
          fundInfo = {
            id: userMarginData.id || '',
            userId: userMarginData.userUuid || userInfo.uuid || '',
            balance: tokenQuantity,
            frozenAmount: 0,
            totalRecharge: 0,
            totalConsumption: 0,
            totalWithdraw: 0,
            updateTime: new Date().toISOString(),
          }
        }

        const adminOverride = import.meta.env.VITE_ADMIN_OVERRIDE === 'true'
        let isAdmin = Array.isArray(userInfo.roles) ? userInfo.roles.includes('admin') : false
        if (!isAdmin && adminOverride && (userInfo.uuid === 'admin' || userInfo.username === 'admin')) {
          isAdmin = true
        }
        if (!isAdmin && adminOverride) {
          const overrideUuid = import.meta.env.VITE_ADMIN_OVERRIDE_UUID
          const overridePhone = import.meta.env.VITE_ADMIN_OVERRIDE_PHONE
          if (overrideUuid && userInfo.uuid === overrideUuid) isAdmin = true
          if (overridePhone) {
            const normalizedPhone = (userInfo.phone || '').replace(/[\s+-]/g, '')
            if (normalizedPhone === overridePhone || normalizedPhone.endsWith(overridePhone)) isAdmin = true
          }
        }

        const existingUser = user.value
        const existingPhone = existingUser?.phone || ''
        const existingEmail = existingUser?.email || ''
        const existingNickname = existingUser?.nickname || ''
        const existingAvatar = existingUser?.avatar || ''
        const existingSignature = existingUser?.signature || ''
        const existingBirthday = existingUser?.birthday || ''
        const existingGender = existingUser?.gender

        const extractedUuid = extractUuid(userInfo)
        const apiNickname = userInfo.nickname || ((userInfo as Record<string, unknown>).nick_name as string) || ((userInfo as Record<string, unknown>).nickName as string) || ''

        const vipLevelVO = (userInfo as Record<string, unknown>).vipLevelVO as {
          id?: string
          title?: string
          levelName?: string
          level?: number
          levelValue?: number
          remark?: string
          userVip?: { progress?: number; isValid?: number }
          [key: string]: unknown
        } | undefined

        let vipInfo: UserVipInfo | null = null
        if (vipLevelVO) {
          vipInfo = {
            id: vipLevelVO.id || '',
            userId: extractedUuid || '',
            vipLevelId: vipLevelVO.id || '',
            vipLevelName: vipLevelVO.title || vipLevelVO.levelName || '',
            startTime: '',
            endTime: '',
            isExpired: false,
            isActive: vipLevelVO.userVip?.isValid === 1,
            privileges: [],
          }
        }

        const identityType = ((userInfo as Record<string, unknown>).identityType as number) ?? ((userInfo as Record<string, unknown>).identityTypy as number) ?? 0
        const userIsVip = extractIsVip(userInfo.isVip)

        // 保留管理员标识字段（避免 fetchUserInfo 覆盖时丢失导致路由守卫误判）
        const existingRoles = (existingUser?.roles as string[] | undefined)
          ?? (Array.isArray(userInfo.roles) ? (userInfo.roles as string[]) : undefined)
        const existingIsAdmin = (existingUser as Record<string, unknown> | null)?.isAdmin ?? (userInfo as Record<string, unknown>).isAdmin
        const existingUserType = (existingUser as Record<string, unknown> | null)?.userType ?? (userInfo as Record<string, unknown>).userType
        const existingRole = (existingUser as Record<string, unknown> | null)?.role ?? (userInfo as Record<string, unknown>).role

        user.value = {
          id: extractedUuid,
          uuid: isAdmin ? 'admin' : extractedUuid,
          username: userInfo.username || existingUser?.username || '',
          email: userEmail || existingEmail || '',
          phone: userPhone || existingPhone || '',
          nickname: isAdmin ? apiNickname || '最高管理员' : apiNickname || existingNickname || userInfo.username || '',
          avatar: userInfo.avatar || existingAvatar || (isAdmin ? '/images/APP.jpg' : '/images/common/userIcon.svg'),
          gender: userInfo.gender !== undefined ? userInfo.gender : existingGender !== undefined ? existingGender : 0,
          birthday: userInfo.birthday || existingBirthday || '',
          signature: isAdmin ? userInfo.signature || '系统最高管理员账号' : userInfo.signature || existingSignature || '',
          status: userInfo.status !== undefined ? userInfo.status : 1,
          isVip: isAdmin ? true : userIsVip,
          inviteCode: isAdmin ? userInfo.inviteCode || 'ADMIN001' : userInfo.inviteCode || '',
          createTime: userInfo.createTime || new Date().toISOString(),
          updateTime: userInfo.updateTime || userInfo.createTime || new Date().toISOString(),
          needPwd: extractNeedPwd(userInfo.needPwd ?? userInfo.need_pwd) ?? 0,
          vipLevelVO: vipLevelVO ? { levelName: vipLevelVO.title || vipLevelVO.levelName || '', levelValue: vipLevelVO.level || vipLevelVO.levelValue || 0, ...vipLevelVO } : undefined,
          identityType,
          roles: existingRoles,
          ...(existingIsAdmin !== undefined ? { isAdmin: existingIsAdmin } : {}),
          ...(existingUserType !== undefined ? { userType: existingUserType } : {}),
          ...(existingRole !== undefined ? { role: existingRole } : {}),
        } as UserInfoData

        if (user.value) {
          const storedData = (getStoredData() as Record<string, unknown>) || {}
          const tokenStore = useTokenStore()
          StorageManager.setItem(STORAGE_KEYS.USER_DATA, {
            ...storedData,
            ...user.value,
            thirdPartyAccounts: { ...((storedData.thirdPartyAccounts as Record<string, unknown>) || {}), accessToken: tokenStore.token || (storedData.thirdPartyAccounts as Record<string, unknown>)?.accessToken },
            fundInfo,
            vipInfo,
          })
        }

        return { fundInfo, vipInfo }
      } catch (error) {
        logger.error(getI18nGlobal().t('logs.getUserInfoFailed'), error)
        throw error
      }
    })()

    try {
      return await fetchUserInfoPromise
    } finally {
      isFetchingUserInfo.value = false
      fetchUserInfoPromise = null
    }
  }

  const clearUser = () => {
    user.value = null
    authInfo.value = null
  }

  return {
    user,
    authInfo,
    isLoading,
    isDemoMode,
    isFetchingUserInfo,
    isVip,
    userUuid,
    nickname,
    avatar,
    userStatus,
    inviteCode,
    setUser,
    updateUserInfo,
    setAuthInfo,
    restoreUserFromStorage,
    fetchUserInfo,
    clearUser,
  }
})
