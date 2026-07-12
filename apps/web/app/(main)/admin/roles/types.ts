export type Scope = 'none' | 'self' | 'team' | 'org' | 'all'

export interface Role {
  id: string
  name: string
  displayName: string
  description: string | null
  scope: Scope
  isSystem: boolean
  createdAt: string
  permissionsCount?: number
}

export interface RoleForm {
  name: string
  displayName: string
  description: string
  scope: Scope
}
