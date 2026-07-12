export interface LoginLog {
  id: string
  userUuid: string
  loginType: string
  platform: string
  ip: string
  location: string
  userAgent: string
  loginTime: string
  message: string
}

export interface ListResp {
  list: LoginLog[]
  total: number
}

export type LoginLogSearch = {
  userUuid: string
  platform: string
  location: string
  startTime: string
  endTime: string
}
