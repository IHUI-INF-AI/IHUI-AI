export interface AdminUser {
  id: string
  phone: string | null
  email: string | null
  nickname: string | null
  avatar: string | null
  roleId: number | null
  status: number | null
  createdAt: string | null
}

export interface UsersData {
  list: AdminUser[]
  total: number
  page: number
  pageSize: number
}
