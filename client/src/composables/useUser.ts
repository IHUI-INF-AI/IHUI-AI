import { ref, computed, type Ref, type ComputedRef } from 'vue'
import { logger } from '@/utils/logger'

export interface UserInfo {
  /** 用户 ID */
  id?: string | number
  /** 用户名 */
  username?: string
  /** 昵称 */
  nickname?: string
  /** 头像 */
  avatar?: string
  /** 手机号 */
  phone?: string
  /** 邮箱 */
  email?: string
  /** VIP 状态 */
  isVip?: boolean
  /** VIP 过期时间 */
  vipExpireTime?: string
  /** 其他自定义字段 */
  [key: string]: any
}

export interface UseUserOptions {
  /** 存储 key，默认 'userInfo' */
  storageKey?: string
  /** 存储类型，默认 'local' */
  storageType?: 'local' | 'session'
}

export interface UseUserReturn {
  /** 用户信息 */
  userInfo: Ref<UserInfo | null>
  /** 是否已登录 */
  isLogin: ComputedRef<boolean>
  /** 获取用户信息 */
  getUserInfo: () => Promise<UserInfo | null>
  /** 更新用户信息 */
  updateUserInfo: (info: Partial<UserInfo>) => Promise<void>
  /** 设置用户信息 */
  setUserInfo: (info: UserInfo) => Promise<void>
  /** 清除用户信息 */
  clearUserInfo: () => Promise<void>
  /** 登出 */
  logout: () => Promise<void>
}

function getStorage(storageType: 'local' | 'session'): Storage {
  if (typeof uni !== 'undefined') {
    return {
      getItem: (key: string) => uni.getStorageSync(key),
      setItem: (key: string, value: string) => uni.setStorageSync(key, value),
      removeItem: (key: string) => uni.removeStorageSync(key),
    } as Storage
  }
  return storageType === 'session' ? sessionStorage : localStorage
}

export function useUser(options: UseUserOptions = {}): UseUserReturn {
  const { storageKey = 'userInfo', storageType = 'local' } = options

  const userInfo = ref<UserInfo | null>(null) as Ref<UserInfo | null>
  const isLogin = computed(() => userInfo.value !== null)

  const getUserInfo = async (): Promise<UserInfo | null> => {
    try {
      const storage = getStorage(storageType)
      const data = storage.getItem(storageKey)
      if (data) {
        const info = typeof data === 'string' ? JSON.parse(data) : data
        userInfo.value = info
        return info
      }
    } catch (error) {
      logger.error('getUserInfo error:', error)
    }
    return null
  }

  const updateUserInfo = async (info: Partial<UserInfo>): Promise<void> => {
    try {
      const current = userInfo.value || {}
      const updated = { ...current, ...info }
      await setUserInfo(updated)
    } catch (error) {
      logger.error('updateUserInfo error:', error)
    }
  }

  const setUserInfo = async (info: UserInfo): Promise<void> => {
    try {
      const storage = getStorage(storageType)
      storage.setItem(storageKey, JSON.stringify(info))
      userInfo.value = info
    } catch (error) {
      logger.error('setUserInfo error:', error)
    }
  }

  const clearUserInfo = async (): Promise<void> => {
    try {
      const storage = getStorage(storageType)
      storage.removeItem(storageKey)
      userInfo.value = null
    } catch (error) {
      logger.error('clearUserInfo error:', error)
    }
  }

  const logout = async (): Promise<void> => {
    await clearUserInfo()
  }

  return {
    userInfo,
    isLogin,
    getUserInfo,
    updateUserInfo,
    setUserInfo,
    clearUserInfo,
    logout,
  }
}
