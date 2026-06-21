export interface User {
  id: string
  username: string
  nickname: string
  avatar: string
  email?: string
  phone?: string
  bio?: string
  isVip: boolean
  level: 'free' | 'bronze' | 'silver' | 'gold' | 'platinum'
  vipExpireTime?: string
  createTime?: string
  updateTime?: string
}

export interface UserInfo {
  id: string
  username: string
  nickname: string
  avatar: string
  email?: string
  phone?: string
  bio?: string
  isVip: boolean
  level: 'free' | 'bronze' | 'silver' | 'gold' | 'platinum'
  vipExpireTime?: string
  balance?: number
  commission?: number
  createTime?: string
  updateTime?: string
}

export interface LoginParams {
  username: string
  password: string
  captcha?: string
  captchaId?: string
}

export interface RegisterParams {
  username: string
  password: string
  email?: string
  phone?: string
  captcha?: string
  captchaId?: string
}

export interface UpdatePasswordParams {
  oldPassword: string
  newPassword: string
  confirmPassword: string
}

export interface Commission {
  id: string
  userId: string
  amount: number
  status: 'pending' | 'available' | 'withdrawn'
  source?: string
  createTime?: string
  updateTime?: string
}

export interface WithdrawRecord {
  id: string
  userId: string
  amount: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  account: string
  accountType: 'alipay' | 'wechat' | 'bank'
  remark?: string
  createTime?: string
  updateTime?: string
}
