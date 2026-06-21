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
  tokenQuota: number
  totalTokens: number
  usedTokens: number
  vipExpireTime?: string
  createTime: string
  lastLoginTime: string
  inviteCode: string
  invitedBy?: string
  commissionBalance: number
  totalCommission: number
  googleId?: string
  googleEmail?: string
  googleName?: string
  googlePicture?: string
  googleVerifiedEmail?: boolean
  googleLinked?: boolean
  googleLinkedTime?: string
}

export interface UserInfo {
  nickname: string
  avatar: string
  email?: string
  phone?: string
}

export interface LoginParams {
  username?: string
  password?: string
  phone?: string
  code?: string
  type?: 'account' | 'phone' | 'third-party'
}

export interface LoginInfo {
  nickname?: string
  phone?: string
  avatarUrl?: string
  token?: string
  id?: number
  isVip?: number
  identityType?: number
}

export interface RegisterParams {
  username?: string
  password: string
  confirmPassword?: string
  phone?: string
  email?: string
  inviteCode?: string
  code?: string
  type?: 'account' | 'phone' | 'third-party'
}

export interface UpdatePasswordParams {
  oldPassword: string
  newPassword: string
  confirmPassword: string
}

export interface UserStats {
  totalUsers: number
  activeUsers: number
  vipUsers: number
  todayNewUsers: number
}

export interface Commission {
  id: string
  userId: string
  fromUserId: string
  fromUserName: string
  amount: number
  type: 'register' | 'recharge' | 'vip' | 'consumption'
  status: 'pending' | 'completed' | 'cancelled'
  createTime: string
  settleTime?: string
  description: string
}

export interface WithdrawRecord {
  id: string
  userId: string
  amount: number
  fee: number
  actualAmount: number
  status: 'pending' | 'processing' | 'completed' | 'rejected'
  bankInfo?: {
    bankName: string
    accountName: string
    accountNumber: string
  }
  alipayInfo?: {
    account: string
    name: string
  }
  createTime: string
  processTime?: string
  completeTime?: string
  rejectReason?: string
}
