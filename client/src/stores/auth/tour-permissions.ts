import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useUserStore } from './user'
import { useTokenStore } from './token'
import { useVipStore } from './vip'

export type Permission = 
  | 'tour:view'
  | 'tour:create'
  | 'tour:edit'
  | 'tour:delete'
  | 'tour:publish'
  | 'monitoring:view'
  | 'monitoring:config'
  | 'monitoring:alert'
  | 'recommendation:view'
  | 'recommendation:config'
  | 'recommendation:abtest'
  | 'platform:view'
  | 'platform:config'

export type Role = 'admin' | 'operator' | 'analyst' | 'user'

interface RolePermissions {
  [key: string]: Permission[]
}

const ROLE_PERMISSIONS: RolePermissions = {
  admin: [
    'tour:view', 'tour:create', 'tour:edit', 'tour:delete', 'tour:publish',
    'monitoring:view', 'monitoring:config', 'monitoring:alert',
    'recommendation:view', 'recommendation:config', 'recommendation:abtest',
    'platform:view', 'platform:config'
  ],
  operator: [
    'tour:view', 'tour:create', 'tour:edit',
    'monitoring:view', 'monitoring:alert',
    'recommendation:view',
    'platform:view'
  ],
  analyst: [
    'tour:view',
    'monitoring:view',
    'recommendation:view', 'recommendation:abtest',
    'platform:view'
  ],
  user: [
    'tour:view'
  ]
}

export const useTourPermissionsStore = defineStore('tourPermissions', () => {
  const userStore = useUserStore()
  const tokenStore = useTokenStore()
  const vipStore = useVipStore()

  const isLoggedIn = computed(() => !!tokenStore.token && !!userStore.user && !tokenStore.isTokenExpired)

  const userRoles = computed((): Role[] => {
    if (!userStore.user) return ['user']
    
    const roles: Role[] = ['user']
    const user = userStore.user as { roles?: string[]; status?: number; uuid?: string; phone?: string }
    
    if (Array.isArray(user.roles)) {
      if (user.roles.includes('admin')) roles.push('admin')
      if (user.roles.includes('operator')) roles.push('operator')
      if (user.roles.includes('analyst')) roles.push('analyst')
    }
    
    if (user.status === 1 && vipStore.isVipActive) {
      if (!roles.includes('analyst')) roles.push('analyst')
    }
    
    const adminOverride = import.meta.env.VITE_ADMIN_OVERRIDE === 'true'
    if (adminOverride && user.status === 1) {
      const overrideUuid = import.meta.env.VITE_ADMIN_OVERRIDE_UUID
      const overridePhone = import.meta.env.VITE_ADMIN_OVERRIDE_PHONE
      if (overrideUuid && user.uuid === overrideUuid) {
        if (!roles.includes('admin')) roles.push('admin')
      }
      if (overridePhone) {
        const userPhone = (user.phone || '').replace(/[\s+-]/g, '')
        if (userPhone === overridePhone || userPhone.endsWith(overridePhone)) {
          if (!roles.includes('admin')) roles.push('admin')
        }
      }
    }
    
    return roles
  })

  const allPermissions = computed((): Permission[] => {
    const permissions = new Set<Permission>()
    userRoles.value.forEach(role => {
      ROLE_PERMISSIONS[role]?.forEach(p => permissions.add(p))
    })
    return Array.from(permissions)
  })

  const hasPermission = computed(() => (permission: Permission): boolean => {
    if (!isLoggedIn.value) return false
    return allPermissions.value.includes(permission)
  })

  const hasAnyPermission = computed(() => (permissions: Permission[]): boolean => {
    return permissions.some(p => hasPermission.value(p))
  })

  const hasAllPermissions = computed(() => (permissions: Permission[]): boolean => {
    return permissions.every(p => hasPermission.value(p))
  })

  const hasRole = computed(() => (role: Role): boolean => {
    return userRoles.value.includes(role)
  })

  const canManageTours = computed(() => hasAnyPermission.value(['tour:create', 'tour:edit', 'tour:delete']))
  const canManageMonitoring = computed(() => hasAnyPermission.value(['monitoring:config', 'monitoring:alert']))
  const canManageRecommendations = computed(() => hasAnyPermission.value(['recommendation:config', 'recommendation:abtest']))
  const canManagePlatforms = computed(() => hasPermission.value('platform:config'))

  const checkPermission = (permission: Permission): boolean => {
    return hasPermission.value(permission)
  }

  const checkAnyPermission = (permissions: Permission[]): boolean => {
    return hasAnyPermission.value(permissions)
  }

  return {
    isLoggedIn,
    userRoles,
    allPermissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    canManageTours,
    canManageMonitoring,
    canManageRecommendations,
    canManagePlatforms,
    checkPermission,
    checkAnyPermission
  }
})
