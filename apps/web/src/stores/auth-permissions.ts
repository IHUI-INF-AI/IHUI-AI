import { create } from 'zustand'

import { fetchApi } from '@/lib/api'

export interface Permission {
  key: string
  label: string
  allowed: boolean
}

interface AuthPermissionsState {
  permissions: Permission[]
  loading: boolean
  error: string | null
  /** 是否拥有某权限 */
  has: (key: string) => boolean
  setPermissions: (permissions: Permission[]) => void
  fetchPermissions: () => Promise<void>
}

/** 权限管理 Store，存储当前用户的功能权限列表 */
export const useAuthPermissionsStore = create<AuthPermissionsState>((set, get) => ({
  permissions: [],
  loading: false,
  error: null,

  has: (key) => get().permissions.some((p) => p.key === key && p.allowed),

  setPermissions: (permissions) => set({ permissions }),

  fetchPermissions: async () => {
    set({ loading: true, error: null })
    const res = await fetchApi<Permission[]>('/auth/permissions')
    if (!res.success) {
      set({ loading: false, error: res.error })
      return
    }
    set({ permissions: res.data, loading: false })
  },
}))
