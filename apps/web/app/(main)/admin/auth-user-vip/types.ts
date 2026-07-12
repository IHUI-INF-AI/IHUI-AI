export interface AuthUserVip {
  id: string
  userUuid: string
  vipId: string
  progress?: string
  creator?: string
  createdTime?: string
  isValid?: string | number
}

export interface AuthUserVipSearch {
  userUuid: string
  vipId: string
  progress: string
  isValid: string
}

export interface AuthUserVipForm {
  userUuid: string
  vipId: string
  progress: string
  creator: string
  createdTime: string
  isValid: string
}

export interface ListData {
  list: AuthUserVip[]
  total: number
}
