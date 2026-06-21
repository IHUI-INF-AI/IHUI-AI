import { computed } from 'vue'
import { useTourPermissionsStore, type Permission, type Role } from '@/stores/auth/tour-permissions'

export function useTourPermissions() {
  const store = useTourPermissionsStore()

  const isLoggedIn = computed(() => store.isLoggedIn)
  const userRoles = computed(() => store.userRoles)
  const allPermissions = computed(() => store.allPermissions)

  const hasPermission = (permission: Permission) => store.hasPermission(permission)
  const hasAnyPermission = (permissions: Permission[]) => store.hasAnyPermission(permissions)
  const hasAllPermissions = (permissions: Permission[]) => store.hasAllPermissions(permissions)
  const hasRole = (role: Role) => store.hasRole(role)

  const canManageTours = computed(() => store.canManageTours)
  const canManageMonitoring = computed(() => store.canManageMonitoring)
  const canManageRecommendations = computed(() => store.canManageRecommendations)
  const canManagePlatforms = computed(() => store.canManagePlatforms)

  const isAdmin = computed(() => hasRole('admin'))
  const isOperator = computed(() => hasRole('operator'))
  const isAnalyst = computed(() => hasRole('analyst'))

  const canViewTour = computed(() => hasPermission('tour:view'))
  const canCreateTour = computed(() => hasPermission('tour:create'))
  const canEditTour = computed(() => hasPermission('tour:edit'))
  const canDeleteTour = computed(() => hasPermission('tour:delete'))
  const canPublishTour = computed(() => hasPermission('tour:publish'))

  const canViewMonitoring = computed(() => hasPermission('monitoring:view'))
  const canConfigMonitoring = computed(() => hasPermission('monitoring:config'))
  const canManageAlerts = computed(() => hasPermission('monitoring:alert'))

  const canViewRecommendation = computed(() => hasPermission('recommendation:view'))
  const canConfigRecommendation = computed(() => hasPermission('recommendation:config'))
  const canManageABTest = computed(() => hasPermission('recommendation:abtest'))

  const canViewPlatform = computed(() => hasPermission('platform:view'))
  const canConfigPlatform = computed(() => hasPermission('platform:config'))

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
    isAdmin,
    isOperator,
    isAnalyst,
    canViewTour,
    canCreateTour,
    canEditTour,
    canDeleteTour,
    canPublishTour,
    canViewMonitoring,
    canConfigMonitoring,
    canManageAlerts,
    canViewRecommendation,
    canConfigRecommendation,
    canManageABTest,
    canViewPlatform,
    canConfigPlatform
  }
}
