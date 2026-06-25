/**
 * 原子性状态恢复函数
 * 
 * 用于确保认证状态的原子性恢复，避免竞态条件
 * 提供可靠的状态恢复机制
 */

// ⚠️ 启动优化：延迟加载 useAuthStore
// import { useAuthStore } from '@/stores/auth'
import { StorageManager, STORAGE_KEYS } from '@/utils/storage'
import { isExpiryTimePassed } from '@/utils/login-duration'
import { deepEqual } from '@/utils/object-utils'
import type { UserInfoData } from '@/api/user/user'
import { logger } from '@/utils/logger'

/**
 * 状态恢复结果
 */
export interface AuthRestoreResult {
  success: boolean
  hasToken: boolean
  hasUserData: boolean
  isExpired: boolean
  error?: string
}

/**
 * 认证状态快照
 */
export interface AuthStateSnapshot {
  token: string | null
  user: UserInfoData | null
  loginTime: string | null
  lastActiveTime: string | null
  isLoggedIn: boolean
}

/**
 * 创建认证状态快照
 */
export async function createAuthStateSnapshot(): Promise<AuthStateSnapshot> {
  const { useAuthStore } = await import('@/stores/auth')
  const authStore = useAuthStore()
  return {
    token: authStore.token || null,
    user: authStore.user as UserInfoData | null,
    loginTime: (authStore as { loginTime?: string }).loginTime || null,
    lastActiveTime: (authStore as { lastActiveTime?: string }).lastActiveTime || null,
    isLoggedIn: authStore.isLoggedIn,
  }
}

/**
 * 从 localStorage 获取认证数据
 */
function getAuthDataFromStorage(): {
  token: string | null
  userData: Record<string, unknown> | null
  expiryTime: number | null
  isExpired: boolean
} {
  const token = StorageManager.getItem<string>(STORAGE_KEYS.TOKEN) ||
               StorageManager.getItem<string>(STORAGE_KEYS.USER_TOKEN)
  const userData = StorageManager.getItem<Record<string, unknown>>(STORAGE_KEYS.USER_DATA)
  const expiryTime = StorageManager.getItem<number | null>(STORAGE_KEYS.LOGIN_EXPIRY_TIME)
  const isExpired = expiryTime !== null && isExpiryTimePassed(expiryTime)

  return { token, userData, expiryTime, isExpired }
}

/**
 * 转换用户数据为 UserInfoData
 * 处理完整的用户信息结构，包括 vipLevelVO、authInfo、identityType 等
 */
function transformUserData(userData: Record<string, unknown>): UserInfoData {
  // 从 authInfo 中提取认证信息
  const authInfoData = userData.authInfo as {
    email?: string
    phone?: string
    userUuid?: string
    username?: string
  } | undefined
  
  const uuid = userData.uuid as string | undefined
  const id = userData.id as string | undefined
  const username = userData.username as string | undefined
  const email = (userData.email || authInfoData?.email) as string | undefined
  const phone = (userData.phone || authInfoData?.phone) as string | undefined
  const nickname = userData.nickname as string | undefined
  const avatar = userData.avatar as string | undefined
  const avatarUrl = userData.avatarUrl as string | undefined
  const gender = userData.gender as number | undefined
  const birthday = userData.birthday as string | undefined
  const signature = userData.signature as string | undefined
  const status = userData.status as number | undefined
  const inviteCode = userData.inviteCode as string | undefined
  const createTime = userData.createTime as string | undefined
  const updateTime = userData.updateTime as string | undefined
  const needPwd = userData.needPwd as number | undefined
  const parentId = userData.parentId as string | undefined
  
  // 处理 isVip（兼容数值和布尔值）
  const isVipRaw = userData.isVip
  const isVip = typeof isVipRaw === 'number' ? isVipRaw > 0 : Boolean(isVipRaw)
  
  // 提取 vipLevelVO
  const vipLevelVOData = userData.vipLevelVO as {
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
    [key: string]: any
  } | undefined
  
  // 提取身份类型（兼容拼写错误）
  const identityType = (
    (userData.identityType as number) ??
    (userData.identityTypy as number) ??
    0
  )

  return {
    id: uuid || id || '',
    uuid: uuid || id || '',
    username: username || '',
    email: email || '',
    phone: phone || '',
    nickname: nickname || username || 'User',
    avatar: avatar || avatarUrl || '',
    gender: gender || 0,
    birthday: birthday || '',
    signature: signature || '',
    status: status || 1,
    isVip: isVip,
    inviteCode: inviteCode || '',
    createTime: createTime || new Date().toISOString(),
    updateTime: updateTime || new Date().toISOString(),
    needPwd: needPwd ?? 0,
    parentId: parentId || '',
    // VIP 等级详情
    vipLevelVO: vipLevelVOData ? {
      levelName: vipLevelVOData.title || vipLevelVOData.levelName || '',
      levelValue: vipLevelVOData.level || vipLevelVOData.levelValue || 0,
      ...vipLevelVOData,
    } : undefined,
    // 身份类型
    identityType,
  } as UserInfoData
}

/**
 * 原子性地恢复认证状态
 * 
 * @param skipFetchUserInfo 是否跳过获取用户信息（默认 false）
 * @returns 恢复结果
 */
export async function restoreAuthStateAtomically(skipFetchUserInfo = false): Promise<AuthRestoreResult> {
  const startTime = Date.now()
  logger.info('[AuthRestore] Starting atomic state restoration')

  try {
    const { useAuthStore } = await import('@/stores/auth')
  const authStore = useAuthStore()
    const { token, userData, isExpired } = getAuthDataFromStorage()

    const result: AuthRestoreResult = {
      success: false,
      hasToken: !!token,
      hasUserData: !!userData,
      isExpired,
    }

    if (!token) {
      logger.info('[AuthRestore] No token found, clearing all state')
      await clearAuthState()
      result.error = 'No token found'
      return result
    }

    if (!userData) {
      logger.info('[AuthRestore] No user data found, clearing all state')
      await clearAuthState()
      result.error = 'No user data found'
      return result
    }

    if (isExpired) {
      logger.info('[AuthRestore] Login expired, clearing all state')
      await clearAuthState()
      result.error = 'Login expired'
      return result
    }

    const transformedUserData = transformUserData(userData)

    const currentSnapshot = await createAuthStateSnapshot()

    authStore.token = token
    authStore.user = transformedUserData

    const loginTime = userData.loginTime as string | undefined
    const lastActiveTime = userData.lastActiveTime as string | undefined

    if (loginTime) {
      (authStore as { loginTime?: string }).loginTime = loginTime
    }
    if (lastActiveTime) {
      (authStore as { lastActiveTime?: string }).lastActiveTime = lastActiveTime
    }

    if (!skipFetchUserInfo) {
      try {
        const store = authStore as { fetchUserInfo?: () => Promise<void> }
        if (store.fetchUserInfo) {
          await store.fetchUserInfo()
          logger.debug('[AuthRestore] Obtained latest user info')
        }
      } catch (fetchError) {
        logger.warn('[AuthRestore] Failed to get user info, using local data:', fetchError)
      }
    }

    const newSnapshot = await createAuthStateSnapshot()
    const duration = Date.now() - startTime

    result.success = true
    logger.info('[AuthRestore] State restoration successful', {
      duration: `${duration}ms`,
      before: currentSnapshot,
      after: newSnapshot,
    })

    return result
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('[AuthRestore] State restoration failed', {
      error: errorMessage,
      duration: `${duration}ms`,
      stack: error instanceof Error ? error.stack : undefined,
    })

    return {
      success: false,
      hasToken: false,
      hasUserData: false,
      isExpired: false,
      error: errorMessage,
    }
  }
}

/**
 * 清除认证状态
 */
export async function clearAuthState(): Promise<void> {
  const { useAuthStore } = await import('@/stores/auth')
  const authStore = useAuthStore()

  authStore.token = ''
  authStore.user = null
  const authStoreWithExtras = authStore as { 
    loginTime?: string | null
    lastActiveTime?: string | null
    refreshToken?: string
    fundInfo?: any
    vipInfo?: any
    authInfo?: any
  }
  authStoreWithExtras.loginTime = null
  authStoreWithExtras.lastActiveTime = null
  authStoreWithExtras.refreshToken = ''
  authStoreWithExtras.fundInfo = null
  authStoreWithExtras.vipInfo = null
  authStoreWithExtras.authInfo = null

  StorageManager.removeItem(STORAGE_KEYS.TOKEN)
  StorageManager.removeItem(STORAGE_KEYS.USER_TOKEN)
  StorageManager.removeItem(STORAGE_KEYS.USER_DATA)
  StorageManager.removeItem(STORAGE_KEYS.LOGIN_EXPIRY_TIME)
  StorageManager.removeItem(STORAGE_KEYS.REFRESH_TOKEN)

  logger.debug('[AuthRestore] Cleared all auth state')
}

/**
 * 检查认证状态是否有效
 */
export function isAuthStateValid(): boolean {
  const { token, userData, isExpired } = getAuthDataFromStorage()
  return !!token && !!userData && !isExpired
}

/**
 * 获取认证状态快照
 */
export async function getAuthStateSnapshot(): Promise<AuthStateSnapshot> {
  return await createAuthStateSnapshot()
}

/**
 * 比较两个认证状态快照
 */
export function compareAuthSnapshots(before: AuthStateSnapshot, after: AuthStateSnapshot): {
  tokenChanged: boolean
  userChanged: boolean
  loginTimeChanged: boolean
  isLoggedInChanged: boolean
} {
  return {
    tokenChanged: before.token !== after.token,
    userChanged: !deepEqual(before.user, after.user),
    loginTimeChanged: before.loginTime !== after.loginTime,
    isLoggedInChanged: before.isLoggedIn !== after.isLoggedIn,
  }
}

/**
 * 验证认证状态一致性
 */
export async function validateAuthStateConsistency(): Promise<{
  isConsistent: boolean
  issues: string[]
}> {
  const issues: string[] = []
  const { useAuthStore } = await import('@/stores/auth')
  const authStore = useAuthStore()
  const { token, userData } = getAuthDataFromStorage()

  if (authStore.token && !token) {
    issues.push('authStore.token 存在但 localStorage 中没有 token')
  }

  if (!authStore.token && token) {
    issues.push('localStorage 中有 token 但 authStore.token 不存在')
  }

  if (authStore.user && !userData) {
    issues.push('authStore.user 存在但 localStorage 中没有用户数据')
  }

  if (!authStore.user && userData) {
    issues.push('localStorage 中有用户数据但 authStore.user 不存在')
  }

  if (authStore.token !== token) {
    issues.push(`authStore.token 与 localStorage.token 不一致: ${authStore.token} !== ${token}`)
  }

  if (authStore.isLoggedIn !== (!!authStore.token && !!authStore.user)) {
    issues.push(`authStore.isLoggedIn 计算错误: ${authStore.isLoggedIn}`)
  }

  return {
    isConsistent: issues.length === 0,
    issues,
  }
}

/**
 * 同步认证状态到 localStorage
 */
export async function syncAuthStateToStorage(): Promise<void> {
  const { useAuthStore } = await import('@/stores/auth')
  const authStore = useAuthStore()
  const loginTime = (authStore as { loginTime?: string }).loginTime
  const lastActiveTime = (authStore as { lastActiveTime?: string }).lastActiveTime

  if (authStore.token) {
    StorageManager.setItem(STORAGE_KEYS.TOKEN, authStore.token)
    StorageManager.setItem(STORAGE_KEYS.USER_TOKEN, authStore.token)
  }

  if (authStore.user) {
    const storedData = StorageManager.getItem<Record<string, unknown>>(STORAGE_KEYS.USER_DATA) || {}
    StorageManager.setItem(STORAGE_KEYS.USER_DATA, {
      ...storedData,
      ...authStore.user,
      loginTime,
      lastActiveTime,
    })
  }

  logger.debug('[AuthRestore] Synced auth state to localStorage')
}

/**
 * 批量操作：恢复状态并验证一致性
 */
export async function restoreAndValidateAuthState(): Promise<{
  restoreResult: AuthRestoreResult
  validationResult: Awaited<ReturnType<typeof validateAuthStateConsistency>>
}> {
  const restoreResult = await restoreAuthStateAtomically(true)
  const validationResult = await validateAuthStateConsistency()

  if (!validationResult.isConsistent) {
    logger.warn('[AuthRestore] Consistency issues after state restoration:', validationResult.issues)
  }

  return {
    restoreResult,
    validationResult,
  }
}
