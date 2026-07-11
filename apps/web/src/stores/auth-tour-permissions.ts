import { create } from 'zustand'

export interface TourPermission {
  canView: boolean
  canBook: boolean
  canComment: boolean
  canManage: boolean
  reasons: string[]
}

interface AuthTourPermissionsState {
  permission: TourPermission | null
  loading: boolean
  setPermission: (permission: TourPermission | null) => void
  setLoading: (loading: boolean) => void
  reset: () => void
}

const DEFAULT_PERMISSION: TourPermission = {
  canView: true,
  canBook: false,
  canComment: false,
  canManage: false,
  reasons: [],
}

/** 引导权限 Store，存储旅游/引导功能的可用操作权限（默认未登录态） */
export const useAuthTourPermissionsStore = create<AuthTourPermissionsState>((set) => ({
  permission: null,
  loading: false,

  setPermission: (permission) => set({ permission }),

  setLoading: (loading) => set({ loading }),

  reset: () => set({ permission: DEFAULT_PERMISSION, loading: false }),
}))
