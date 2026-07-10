import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type Permission = string

export type Role = 'admin' | 'operator' | 'analyst' | 'user'

export interface RoleInfo {
  id: number
  name: string
  code: string
  permissions: Permission[]
}

export const useTourPermissionsStore = defineStore('tourPermissions', () => {
  const roles = ref<RoleInfo[]>([])
  const permissions = ref<Permission[]>([])
  const loading = ref(false)

  const userPermissions = computed<Permission[]>(() => permissions.value)
  const userRole = computed<Role>(() => 'user')
  const hasPermission = computed(() => (perm: Permission) => permissions.value.includes(perm))
  const canManage = computed(() => permissions.value.includes('admin'))

  const loadRoles = async () => {
    loading.value = true
    try {
    } finally {
      loading.value = false
    }
  }

  const loadPermissions = async () => {
    loading.value = true
    try {
    } finally {
      loading.value = false
    }
  }

  return {
    roles,
    permissions,
    loading,
    loadRoles,
    loadPermissions,
    userPermissions,
    userRole,
    hasPermission,
    canManage,
  }
})
