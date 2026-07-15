export interface MemberUser {
  id: string
  nickname: string | null
  phone: string | null
  email: string | null
  level: number
  status: number
  createdAt: string | null
}

export interface ListData {
  list: MemberUser[]
  total: number
}

export interface CreateUserForm {
  nickname: string
  phone: string
  email: string
  password: string
}
