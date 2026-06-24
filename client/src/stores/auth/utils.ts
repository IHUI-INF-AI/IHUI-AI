import { getStoredData } from '@/utils/request'
import { StorageManager, SecureStorageManager, STORAGE_KEYS } from '@/utils/storage'
import type { UserInfoData, UserFundInfo, UserVipInfo } from '@/api/user'
import type { LoginResponseData, RawUserInfo } from './types'

export const saveUserDataToStorage = (userData: UserInfoData) => {
  const existingData = getStoredData()
  const updatedData = {
    ...(existingData as Record<string, unknown>),
    ...userData,
    loginTime: new Date().toISOString(),
    lastActiveTime: new Date().toISOString(),
  }
  StorageManager.setItem(STORAGE_KEYS.USER_DATA, updatedData)
}

export const getLoginResponseValue = <T>(
  data: LoginResponseData | undefined,
  ...keys: (keyof LoginResponseData)[]
): T | undefined => {
  if (!data) return undefined
  for (const key of keys) {
    const value = data[key]
    if (value !== undefined && value !== null) {
      return value as T
    }
  }
  return undefined
}

export const extractNickname = (storedUserData: Record<string, unknown>): string => {
  const possible = [
    storedUserData.nickname,
    storedUserData.nick_name,
    storedUserData.nickName,
    storedUserData.username,
  ]
  for (const val of possible) {
    if (val && typeof val === 'string' && val.trim()) {
      return val.trim()
    }
  }
  return ''
}

export const extractEmail = (storedUserData: Record<string, unknown>): string => {
  const authInfoData = storedUserData.authInfo as Record<string, unknown> | undefined
  const possible = [
    storedUserData.email,
    authInfoData?.email,
    storedUserData.userEmail,
    storedUserData.user_email,
  ]
  for (const val of possible) {
    if (val && typeof val === 'string' && val.trim()) {
      return val.trim()
    }
  }
  return ''
}

export const extractPhone = (storedUserData: Record<string, unknown>): string => {
  const authInfoData = storedUserData.authInfo as Record<string, unknown> | undefined
  const possible = [storedUserData.phone, authInfoData?.phone, storedUserData.userPhone]
  for (const val of possible) {
    if (val && typeof val === 'string' && val.trim()) {
      return val.trim()
    }
  }
  return ''
}

export const extractUuid = (data: RawUserInfo | Record<string, unknown>): string => {
  const uuid = data.uuid || data.id ||
    (data as RawUserInfo).userId ||
    (data as RawUserInfo).user_id ||
    (data as RawUserInfo).userUuid ||
    (data as RawUserInfo).authInfo?.uuid ||
    (data as RawUserInfo).authInfo?.userId
  return typeof uuid === 'string' ? uuid : ''
}

export const extractIsVip = (isVipRaw: boolean | number | undefined): boolean => {
  return typeof isVipRaw === 'number' ? isVipRaw > 0 : Boolean(isVipRaw)
}

export const extractNeedPwd = (raw: any): number => {
  if (typeof raw === 'number') return raw
  if (raw != null) return Number(raw)
  return 0
}

export const buildUserFromLoginResponse = (
  tokenData: LoginResponseData,
  loginData?: { phone?: string }
): {
  user: UserInfoData
  fundInfo: UserFundInfo | null
  vipInfo: UserVipInfo | null
} => {
  const authInfoData = tokenData?.authInfo
  const loginEmail = tokenData?.email ?? authInfoData?.email ?? ''
  const loginPhone = tokenData?.phone ?? authInfoData?.phone ?? loginData?.phone ?? ''
  const loginUuid = extractUuid(tokenData)
  const loginNeedPwd = extractNeedPwd(tokenData?.needPwd ?? tokenData?.need_pwd ?? authInfoData?.needPwd)
  const loginNickname = tokenData?.nickname ?? authInfoData?.username ?? ''
  const loginIsVip = extractIsVip(tokenData?.isVip)
  const vipLevelVOData = tokenData?.vipLevelVO
  const userMarginData = tokenData?.userMargin
  const identityType = tokenData?.identityType ?? tokenData?.identityTypy ?? 0

  const user: UserInfoData = {
    id: tokenData?.id ?? loginUuid ?? '',
    uuid: loginUuid ?? '',
    username: tokenData?.username ?? authInfoData?.username ?? '',
    email: loginEmail,
    phone: loginPhone,
    avatar: tokenData?.avatar ?? '',
    nickname: loginNickname,
    gender: tokenData?.gender ?? 0,
    birthday: tokenData?.birthday ?? '',
    signature: tokenData?.signature ?? '',
    status: tokenData?.status ?? 1,
    isVip: loginIsVip,
    inviteCode: tokenData?.inviteCode ?? '',
    createTime: tokenData?.createTime ?? tokenData?.createdAt ?? new Date().toISOString(),
    updateTime: tokenData?.updateTime ?? tokenData?.updatedAt ?? tokenData?.createdAt ?? new Date().toISOString(),
    needPwd: Number.isFinite(loginNeedPwd) ? loginNeedPwd : 0,
    vipLevelVO: vipLevelVOData
      ? {
          levelName: vipLevelVOData.title || '',
          levelValue: vipLevelVOData.level || 0,
          ...vipLevelVOData,
        }
      : undefined,
    identityType,
  }

  let fundInfo: UserFundInfo | null = null
  if (userMarginData) {
    const tokenQuantityRaw =
      typeof userMarginData.tokenQuantity === 'string'
        ? parseFloat(userMarginData.tokenQuantity)
        : userMarginData.tokenQuantity || 0
    const tokenQuantity = Number.isFinite(Number(tokenQuantityRaw)) ? Number(tokenQuantityRaw) : 0
    fundInfo = {
      id: userMarginData.id || '',
      userId: userMarginData.userUuid || loginUuid || '',
      balance: tokenQuantity,
      frozenAmount: 0,
      totalRecharge: 0,
      totalConsumption: 0,
      totalWithdraw: 0,
      updateTime: new Date().toISOString(),
    }
  }

  let vipInfo: UserVipInfo | null = null
  if (vipLevelVOData) {
    vipInfo = {
      id: vipLevelVOData.id || '',
      userId: loginUuid || '',
      vipLevelId: vipLevelVOData.id || '',
      vipLevelName: vipLevelVOData.title || '',
      startTime: '',
      endTime: '',
      isExpired: false,
      isActive: vipLevelVOData.userVip?.isValid === 1,
      privileges: [],
    }
  }

  return { user, fundInfo, vipInfo }
}

export const clearAuthStorage = () => {
  // 清理 localStorage
  StorageManager.removeItem(STORAGE_KEYS.USER_TOKEN)
  StorageManager.removeItem(STORAGE_KEYS.TOKEN)
  StorageManager.removeItem(STORAGE_KEYS.USER_DATA)
  StorageManager.removeItem(STORAGE_KEYS.LOGIN_EXPIRY_TIME)
  StorageManager.removeItem(STORAGE_KEYS.REFRESH_TOKEN)
  // 同步清理 sessionStorage(SecureStorageManager)，否则登出后刷新页面会从 sessionStorage 恢复 token 导致静默重新登录
  SecureStorageManager.removeItem(STORAGE_KEYS.USER_TOKEN)
  SecureStorageManager.removeItem(STORAGE_KEYS.TOKEN)
  SecureStorageManager.removeItem(STORAGE_KEYS.REFRESH_TOKEN)
}
