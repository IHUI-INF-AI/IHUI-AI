import request from '@/utils/request'

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
    await request.post(`${API_BASE}/init`)
  }

  async createUser(data: {
    username: string
    email?: string
    password?: string
    display_name?: string
  }): Promise<User> {
    try {
      const response = await request.post(`${API_BASE}/user/create`, data)
      return response.data.user
    } catch {
      throw new Error('Failed to create user')
    }
  }

  async getUser(userId: string): Promise<User | null> {
    try {
      const response = await request.get(`${API_BASE}/user/${userId}`)
      return response.data.user
    } catch {
      return null
    }
  }

  async assignRole(userId: string, roleId: string, assignedBy?: string): Promise<void> {
    const url = `${API_BASE}/user/${userId}/role/${roleId}${assignedBy ? `?assigned_by=${assignedBy}` : ''}`
    try {
      await request.post(url)
    } catch {
      throw new Error('Failed to assign role')
    }
  }

  async getUserPermissions(userId: string): Promise<Permission[]> {
    try {
      const response = await request.get(`${API_BASE}/user/${userId}/permissions`)
      return response.data.permissions
    } catch {
      return []
    }
  }

  async getRoles(): Promise<Role[]> {
    try {
      const response = await request.get(`${API_BASE}/roles`)
      return response.data.roles
    } catch {
      return []
    }
  }

  async createRole(data: {
    name: string
    display_name: string
    description?: string
  }): Promise<Role> {
    try {
      const response = await request.post(`${API_BASE}/role/create`, data)
      return response.data.role
    } catch {
      throw new Error('Failed to create role')
    }
  }

  async getRolePermissions(roleId: string): Promise<Permission[]> {
    try {
      const response = await request.get(`${API_BASE}/role/${roleId}/permissions`)
      return response.data.permissions
    } catch {
      return []
    }
  }

  async assignPermission(roleId: string, permissionId: string): Promise<void> {
    try {
      await request.post(`${API_BASE}/role/${roleId}/permission/${permissionId}`)
    } catch {
      throw new Error('Failed to assign permission')
    }
  }

  async getPermissions(): Promise<Permission[]> {
    try {
      const response = await request.get(`${API_BASE}/permissions`)
      return response.data.permissions
    } catch {
      return []
    }
  }

  async grantFileAccess(data: {
    file_id: string
    user_id: string
    permission: string
    expires_in_hours?: number
  }, grantedBy?: string): Promise<FileAccess> {
    const url = `${API_BASE}/access/grant${grantedBy ? `?granted_by=${grantedBy}` : ''}`
    try {
      const response = await request.post(url, data)
      return response.data.access
    } catch {
      throw new Error('Failed to grant access')
    }
  }

  async checkFileAccess(fileId: string, userId: string, permission: string): Promise<{
    has_access: boolean
    direct_access: boolean
    role_access: boolean
  }> {
    try {
      const response = await request.get(
        `${API_BASE}/access/check?file_id=${fileId}&user_id=${userId}&permission=${permission}`
      )
      return response.data
    } catch {
      return { has_access: false, direct_access: false, role_access: false }
    }
  }

  async getFileAccessList(fileId: string): Promise<FileAccess[]> {
    try {
      const response = await request.get(`${API_BASE}/access/file/${fileId}`)
      return response.data.access_list
    } catch {
      return []
    }
  }

  async revokeFileAccess(fileId: string, userId: string): Promise<void> {
    await request.delete(`${API_BASE}/access/file/${fileId}/user/${userId}`)
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
