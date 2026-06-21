export type LoginPlatformType = 'web' | 'android' | 'third_wechat' | 'third_ali' | 'mp_weixin'

export interface ThirdPartyTokenInfo {
  accessToken?: string
  access_token?: string
  refreshToken?: string
  refresh_token?: string
  token?: string
  tokenType?: string
  token_type?: string
  expiresIn?: number
  expires_in?: number
}

export interface SharedUserInfo {
  id?: string | number
  uuid?: string
  username?: string
  nickname?: string
  name?: string
  phone?: string
  email?: string
  avatar?: string
  avatarUrl?: string
  gender?: number
  status?: number
  isVip?: boolean
  inviteCode?: string
  parentId?: string
  roles?: string[]
  thirdPartyAccounts?: ThirdPartyTokenInfo
  [key: string]: unknown
}

export interface AuthToken {
  token?: string
  accessToken?: string
  access_token?: string
  refreshToken?: string
  refresh_token?: string
  expiresIn?: number
  expires_in?: number
  tokenType?: string
  token_type?: string
}

export interface LoginResponseData extends AuthToken {
  user?: SharedUserInfo
  userInfo?: SharedUserInfo
  sysUser?: SharedUserInfo
  data?: SharedUserInfo | AuthToken
  roles?: string[]
  permissions?: string[]
  thirdPartyAccounts?: ThirdPartyTokenInfo
  [key: string]: unknown
}
