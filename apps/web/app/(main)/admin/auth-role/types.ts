export interface AuthRole {
  id: string
  userId: string
  roleId: string
  createdAt?: string
}

export interface ListData {
  list: AuthRole[]
  total: number
}

export interface AuthRoleForm {
  userId: string
  roleId: string
  createdAt: string
}
