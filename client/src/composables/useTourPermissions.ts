import { ref, computed } from 'vue'
import type { Ref, ComputedRef } from 'vue'

export function useTourPermissions() {
  const permissions: Ref<Record<string, boolean>> = ref({
    configPlatform: true,
    viewPlatform: true,
    manageAlerts: true,
    viewMonitoring: true,
    configRecommendation: true,
    manageABTest: true,
    viewRecommendation: true,
    manage: true,
  })

  const hasPermission: ComputedRef<(action: string) => boolean> = computed(() => {
    return (action: string) => permissions.value[action] ?? false
  })

  const checkPermission = (action: string): boolean => {
    return permissions.value[action] ?? false
  }

  const canConfigPlatform: ComputedRef<boolean> = computed(() => permissions.value.configPlatform ?? true)
  const canViewPlatform: ComputedRef<boolean> = computed(() => permissions.value.viewPlatform ?? true)
  const canManageAlerts: ComputedRef<boolean> = computed(() => permissions.value.manageAlerts ?? true)
  const canViewMonitoring: ComputedRef<boolean> = computed(() => permissions.value.viewMonitoring ?? true)
  const canConfigRecommendation: ComputedRef<boolean> = computed(() => permissions.value.configRecommendation ?? true)
  const canManageABTest: ComputedRef<boolean> = computed(() => permissions.value.manageABTest ?? true)
  const canViewRecommendation: ComputedRef<boolean> = computed(() => permissions.value.viewRecommendation ?? true)

  return {
    permissions,
    hasPermission,
    checkPermission,
    canConfigPlatform,
    canViewPlatform,
    canManageAlerts,
    canViewMonitoring,
    canConfigRecommendation,
    canManageABTest,
    canViewRecommendation,
  }
}
