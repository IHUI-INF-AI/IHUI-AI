import type { UserInfoData, UserFundInfo, UserVipInfo } from '@/api/user'

export interface RawUserInfo {
  id?: string
  uuid?: string
  userId?: string
  user_id?: string
  userUuid?: string
  email?: string
  phone?: string
  username?: string
  nickname?: string
  avatar?: string
  gender?: number
  birthday?: string
  signature?: string
  status?: number
  isVip?: boolean | number
  inviteCode?: string
  createTime?: string
  updateTime?: string
  needPwd?: number
  need_pwd?: number
  roles?: string[]
  authInfo?: {
    email?: string
    phone?: string
    uuid?: string
    userId?: string
    userUuid?: string
    username?: string
    needPwd?: number
  }
}

export interface LoginResponseData extends RawUserInfo {
  token?: string
  accessToken?: string
  userToken?: string
  refreshToken?: string
  status?: number
  inviteCode?: string
  createTime?: string
  createdAt?: string
  updateTime?: string
  updatedAt?: string
  thirdPartyAccounts?: {
    accessToken?: string
    refreshToken?: string
    expiresAt?: string
    refreshExpiresAt?: string
  }
  vipLevelVO?: {
    id?: string
    title?: string
    vipLevelName?: string
    levelName?: string
    level?: number
    vipLevel?: number
    remark?: string
    expireTime?: string
    vipExpireTime?: string
    userVip?: {
      progress?: number
      isValid?: number
    }
    [key: string]: unknown
  }
  userMargin?: {
    id?: string
    userUuid?: string
    tokenQuantity?: string | number
  }
  identityType?: number
  identityTypy?: number
  developerLinks?: unknown
}

export interface AuthState {
  token: string
  refreshToken: string
  user: UserInfoData | null
  authInfo: UserInfoData | null
  fundInfo: UserFundInfo | null
  vipInfo: UserVipInfo | null
  isLoading: boolean
  loginTime: string
  lastActiveTime: string
  isDemoMode: boolean
  initCompleted: boolean
}

export interface ThirdPartyLoginData {
  token: string
  refreshToken?: string
  user: UserInfoData | Record<string, unknown>
  loginType: string
}

export type { UserInfoData, UserFundInfo, UserVipInfo }
