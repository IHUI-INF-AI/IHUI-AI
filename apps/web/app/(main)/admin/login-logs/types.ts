export interface LoginLog {
  id: string
  userUuid: string
  loginType?: string
  platform?: string
  ip?: string
  location?: string
  userAgent?: string
  loginTime?: string
  message?: string
}

export interface ListData {
  list: LoginLog[]
  total: number
}

export interface LoginLogForm {
  userUuid: string
  loginType: string
  platform: string
  ip: string
  location: string
  userAgent: string
  loginTime: string
  message: string
}

export interface LoginLogSearch {
  userUuid: string
  platform: string
  location: string
  loginTime: string
}
