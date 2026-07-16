export interface AdminUser {
  id: string
  phone: string | null
  email: string | null
  nickname: string | null
  avatar: string | null
  roleId: number | null
  status: number | null
  deptId: number | null
  createdAt: string | null
}

export interface UsersData {
  list: AdminUser[]
  total: number
  page: number
  pageSize: number
}

export interface DeptItem {
  deptId: number
  parentId: number
  deptName: string
  orderNum: number | null
  leader: string | null
  phone: string | null
  email: string | null
  status: string | null
}
