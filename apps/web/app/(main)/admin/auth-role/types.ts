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

// 2026-08-30 角色权限点配置:权限点(与 packages/database permissions 表字段对齐)
export interface Permission {
  id: string
  name: string
  displayName: string
  resource: string
  action: string
  description?: string | null
  createdAt?: string
}

export interface PermissionListData {
  list: Permission[]
}
