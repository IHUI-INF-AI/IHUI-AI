interface User {
  user_id: string
  username: string
  email: string | null
  display_name: string
  is_active: boolean
  is_superuser: boolean
  last_login: string | null
  roles: Role[]
  permissions: Permission[]
}

interface Role {
  role_id: string
  name: string
  display_name: string
  description?: string
  is_system: boolean
}

interface Permission {
  permission_id: string
  name: string
  display_name: string
  resource: string
  action: string
}

interface FileAccess {
  user_id: string
  permission: string
  granted_by: string | null
  granted_at: string
  expires_at: string | null
}

const API_BASE = '/api/rbac'

class RbacService {
  async initialize(): Promise<void> {
    await fetch(`${API_BASE}/init`, { method: 'POST' })
  }

  async createUser(data: {
    username: string
    email?: string
    password?: string
    display_name?: string
  }): Promise<User> {
    const response = await fetch(`${API_BASE}/user/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      throw new Error('Failed to create user')
    }

    const result = await response.json()
    return result.user
  }

  async getUser(userId: string): Promise<User | null> {
    const response = await fetch(`${API_BASE}/user/${userId}`)
    
    if (!response.ok) {
      return null
    }

    const data = await response.json()
    return data.user
  }

  async assignRole(userId: string, roleId: string, assignedBy?: string): Promise<void> {
    const url = `${API_BASE}/user/${userId}/role/${roleId}${assignedBy ? `?assigned_by=${assignedBy}` : ''}`
    const response = await fetch(url, { method: 'POST' })

    if (!response.ok) {
      throw new Error('Failed to assign role')
    }
  }

  async getUserPermissions(userId: string): Promise<Permission[]> {
    const response = await fetch(`${API_BASE}/user/${userId}/permissions`)
    
    if (!response.ok) {
      return []
    }

    const data = await response.json()
    return data.permissions
  }

  async getRoles(): Promise<Role[]> {
    const response = await fetch(`${API_BASE}/roles`)
    
    if (!response.ok) {
      return []
    }

    const data = await response.json()
    return data.roles
  }

  async createRole(data: {
    name: string
    display_name: string
    description?: string
  }): Promise<Role> {
    const response = await fetch(`${API_BASE}/role/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      throw new Error('Failed to create role')
    }

    const result = await response.json()
    return result.role
  }

  async getRolePermissions(roleId: string): Promise<Permission[]> {
    const response = await fetch(`${API_BASE}/role/${roleId}/permissions`)
    
    if (!response.ok) {
      return []
    }

    const data = await response.json()
    return data.permissions
  }

  async assignPermission(roleId: string, permissionId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/role/${roleId}/permission/${permissionId}`, {
      method: 'POST'
    })

    if (!response.ok) {
      throw new Error('Failed to assign permission')
    }
  }

  async getPermissions(): Promise<Permission[]> {
    const response = await fetch(`${API_BASE}/permissions`)
    
    if (!response.ok) {
      return []
    }

    const data = await response.json()
    return data.permissions
  }

  async grantFileAccess(data: {
    file_id: string
    user_id: string
    permission: string
    expires_in_hours?: number
  }, grantedBy?: string): Promise<FileAccess> {
    const url = `${API_BASE}/access/grant${grantedBy ? `?granted_by=${grantedBy}` : ''}`
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      throw new Error('Failed to grant access')
    }

    const result = await response.json()
    return result.access
  }

  async checkFileAccess(fileId: string, userId: string, permission: string): Promise<{
    has_access: boolean
    direct_access: boolean
    role_access: boolean
  }> {
    const response = await fetch(
      `${API_BASE}/access/check?file_id=${fileId}&user_id=${userId}&permission=${permission}`
    )

    if (!response.ok) {
      return { has_access: false, direct_access: false, role_access: false }
    }

    const data = await response.json()
    return data
  }

  async getFileAccessList(fileId: string): Promise<FileAccess[]> {
    const response = await fetch(`${API_BASE}/access/file/${fileId}`)
    
    if (!response.ok) {
      return []
    }

    const data = await response.json()
    return data.access_list
  }

  async revokeFileAccess(fileId: string, userId: string): Promise<void> {
    await fetch(`${API_BASE}/access/file/${fileId}/user/${userId}`, {
      method: 'DELETE'
    })
  }

  hasPermission(user: User | null, permissionName: string): boolean {
    if (!user) return false
    if (user.is_superuser) return true
    return user.permissions.some(p => p.name === permissionName)
  }

  hasRole(user: User | null, roleName: string): boolean {
    if (!user) return false
    return user.roles.some(r => r.name === roleName)
  }

  canManageFile(user: User | null, action: 'read' | 'write' | 'delete' | 'share'): boolean {
    if (!user) return false
    if (user.is_superuser) return true
    return this.hasPermission(user, `file:${action}`)
  }
}

export const rbacService = new RbacService()

export function useRbac() {
  return {
    initialize: rbacService.initialize.bind(rbacService),
    createUser: rbacService.createUser.bind(rbacService),
    getUser: rbacService.getUser.bind(rbacService),
    assignRole: rbacService.assignRole.bind(rbacService),
    getUserPermissions: rbacService.getUserPermissions.bind(rbacService),
    getRoles: rbacService.getRoles.bind(rbacService),
    createRole: rbacService.createRole.bind(rbacService),
    getRolePermissions: rbacService.getRolePermissions.bind(rbacService),
    assignPermission: rbacService.assignPermission.bind(rbacService),
    getPermissions: rbacService.getPermissions.bind(rbacService),
    grantFileAccess: rbacService.grantFileAccess.bind(rbacService),
    checkFileAccess: rbacService.checkFileAccess.bind(rbacService),
    getFileAccessList: rbacService.getFileAccessList.bind(rbacService),
    revokeFileAccess: rbacService.revokeFileAccess.bind(rbacService),
    hasPermission: rbacService.hasPermission.bind(rbacService),
    hasRole: rbacService.hasRole.bind(rbacService),
    canManageFile: rbacService.canManageFile.bind(rbacService)
  }
}
