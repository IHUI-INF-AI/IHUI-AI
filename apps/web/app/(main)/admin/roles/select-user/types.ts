export interface UnallocUser {
  id: string
  userName: string
  nickName: string
  email: string
  phonenumber: string
  status: number
  createdAt: string
}

export interface ListResp {
  list: UnallocUser[]
  total: number
}

export interface SearchState {
  userName: string
  phonenumber: string
}
