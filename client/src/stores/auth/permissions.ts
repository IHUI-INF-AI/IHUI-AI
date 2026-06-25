import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useUserStore } from './user'
import { useTokenStore } from './token'
import { useWalletStore } from './wallet'
import { useVipStore } from './vip'
import { logger } from '@/utils/logger'

export const usePermissionsStore = defineStore('permissions', () => {
  // 2026-06-25 修复: 顶层 4 个子 store 全部包 try/catch + 懒加载,
  // 与 stores/auth/index.ts 同步处理, 防止 HMR 抖动期 setup 失败.
  let userStore: ReturnType<typeof useUserStore> | null = null
  let tokenStore: ReturnType<typeof useTokenStore> | null = null
  let walletStore: ReturnType<typeof useWalletStore> | null = null
  let vipStore: ReturnType<typeof useVipStore> | null = null

  try {
    userStore = useUserStore()
  } catch (e) {
    logger.debug('[PermissionsStore] userStore unavailable on init, will lazy load:', e)
  }
  try {
    tokenStore = useTokenStore()
  } catch (e) {
    logger.debug('[PermissionsStore] tokenStore unavailable on init, will lazy load:', e)
  }
  try {
    walletStore = useWalletStore()
  } catch (e) {
    logger.debug('[PermissionsStore] walletStore unavailable on init, will lazy load:', e)
  }
  try {
    vipStore = useVipStore()
  } catch (e) {
    logger.debug('[PermissionsStore] vipStore unavailable on init, will lazy load:', e)
  }

  const getUserStore = (): ReturnType<typeof useUserStore> | null => {
    if (userStore) return userStore
    try {
      userStore = useUserStore()
      return userStore
    } catch (e) {
      logger.debug('[PermissionsStore] userStore lazy load failed:', e)
      return null
    }
  }
  const getTokenStore = (): ReturnType<typeof useTokenStore> | null => {
    if (tokenStore) return tokenStore
    try {
      tokenStore = useTokenStore()
      return tokenStore
    } catch (e) {
      logger.debug('[PermissionsStore] tokenStore lazy load failed:', e)
      return null
    }
  }
  const getWalletStore = (): ReturnType<typeof useWalletStore> | null => {
    if (walletStore) return walletStore
    try {
      walletStore = useWalletStore()
      return walletStore
    } catch (e) {
      logger.debug('[PermissionsStore] walletStore lazy load failed:', e)
      return null
    }
  }
  const getVipStore = (): ReturnType<typeof useVipStore> | null => {
    if (vipStore) return vipStore
    try {
      vipStore = useVipStore()
      return vipStore
    } catch (e) {
      logger.debug('[PermissionsStore] vipStore lazy load failed:', e)
      return null
    }
  }

  const isLoggedIn = computed(() => {
    const ts = getTokenStore()
    const us = getUserStore()
    if (!ts || !us) return false
    return !!ts.token && !!us.user && !ts.isTokenExpired
  })

  const hasPermission = computed(() => (permission: string) => {
    const us = getUserStore()
    if (!us?.user) return false
    if (us.user.status === 0) return false
    if (permission === 'vip' && !us.isVip) return false
    return true
  })

  const hasRole = computed(() => (role: string) => {
    const us = getUserStore()
    const vs = getVipStore()
    if (!us?.user) return false
    const adminOverride = import.meta.env.VITE_ADMIN_OVERRIDE === 'true'
    switch (role) {
      case 'admin': {
        const userRoles = (us.user as { roles?: string[] })?.roles
        if (Array.isArray(userRoles) && userRoles.includes('admin')) return true
        if (adminOverride && us.user?.status === 1) {
          const overrideUuid = import.meta.env.VITE_ADMIN_OVERRIDE_UUID
          const overridePhone = import.meta.env.VITE_ADMIN_OVERRIDE_PHONE
          if (overrideUuid && us.user.uuid === overrideUuid) return true
          if (overridePhone) {
            const userPhone = (us.user.phone || '').replace(/[\s+-]/g, '')
            if (userPhone === overridePhone || userPhone.endsWith(overridePhone)) return true
          }
        }
        return us.user?.uuid === 'admin' || us.user?.username === 'admin' || false
      }
      case 'vip': {
        return !!(us.isVip && vs?.isVipActive)
      }
      case 'user':
        return us.user.status === 1
      default:
        return false
    }
  })

  const canUseFeature = computed(() => (feature: string) => {
    if (!isLoggedIn.value) return false
    const us = getUserStore()
    const vs = getVipStore()
    const ws = getWalletStore()
    if (!us) return false

    switch (feature) {
      case 'chat':
        return us.user?.status === 1
      case 'agent_create':
        return us.user?.status === 1 && (us.isVip || (ws?.balance ?? 0) > 0)
      case 'premium_features':
        return !!(us.isVip && vs?.isVipActive)
      case 'developer_tools':
        return us.user?.status === 1 && (us.isVip || hasRole.value('admin'))
      case 'advanced_analytics':
        return !!(us.isVip && vs?.isVipActive)
      default:
        return true
    }
  })

  const checkPermission = (permission: string): boolean => {
    return hasPermission.value(permission)
  }

  const checkFeatureAccess = (feature: string): boolean => {
    return canUseFeature.value(feature)
  }

  return {
    isLoggedIn,
    hasPermission,
    hasRole,
    canUseFeature,
    checkPermission,
    checkFeatureAccess,
  }
})
