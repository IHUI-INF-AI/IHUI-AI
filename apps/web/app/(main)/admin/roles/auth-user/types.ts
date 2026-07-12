export interface AuthUser {
  id: string
  userName: string
  nickName: string
  email: string
  phonenumber: string
  status: number
  createdAt: string
}

export interface ListResp {
  list: AuthUser[]
  total: number
}
