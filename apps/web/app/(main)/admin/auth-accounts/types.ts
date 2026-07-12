export interface AuthAccount {
  id: string
  userUuid: string
  platform: string
  openId: string
  platformName?: string
  accessToken?: string
  refreshToken?: string
  expiresAt?: string
  nickname?: string
  avatar?: string
  bindTime?: string
}

export interface AuthAccountForm {
  userUuid: string
  platform: string
  openId: string
  platformName: string
  accessToken: string
  refreshToken: string
  expiresAt: string
  nickname: string
  avatar: string
  bindTime: string
}

export interface AuthAccountSearch {
  userUuid: string
  platform: string
  openId: string
  platformName: string
  nickname: string
}
