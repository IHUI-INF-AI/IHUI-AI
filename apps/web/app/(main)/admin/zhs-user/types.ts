export interface ZhsUser {
  id: string
  token: string | null
  openId: string | null
  nickname: string | null
  userName: string | null
  avatar: string | null
  card: string | null
  phone: string | null
  inviteCode: string | null
  parentId: string | null
  balance: string | null
  totalEarnings: string | null
  isVip: string | null
  identityTypy: string | null
  commissionRatio: string | null
  tokenQuantity: string | null
  createdAt: string | null
}

export interface ListData {
  list: ZhsUser[]
  total: number
}

export type ZhsUserForm = Record<string, string>
export type ZhsUserSearch = Record<string, string>

export interface FieldDef {
  key: keyof ZhsUser
  label: string
  required?: boolean
}
