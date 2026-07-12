export interface AuthDept {
  id: string
  userId: string
  deptId: string
  createdAt?: string
}

export interface ListData {
  list: AuthDept[]
  total: number
}

export interface AuthDeptForm {
  userId: string
  deptId: string
  createdAt: string
}
