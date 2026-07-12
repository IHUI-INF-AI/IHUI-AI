import { create } from 'zustand'
import { getStorageSync, setStorageSync } from '@tarojs/taro'
import { getVipInfo } from '../api'
import type { VipInfo } from '../api'

const VIP_STORAGE_KEY = 'ihui_vip_info'

interface VipState {
  isVip: boolean
  vipLevel: number
  vipExpireTime: string
  vipName: string
  privileges: string[]
  setVip: (info: Partial<VipState>) => void
  checkVipStatus: () => Promise<boolean>
  clearVip: () => void
}

function loadStoredVip(): Partial<VipState> {
  return getStorageSync(VIP_STORAGE_KEY) || {}
}

function isVipActive(expireTime: string): boolean {
  if (!expireTime) return false
  return new Date(expireTime).getTime() > Date.now()
}

export const useVipStore = create<VipState>((set) => ({
  isVip: false,
  vipLevel: 0,
  vipExpireTime: '',
  vipName: '',
  privileges: [],
  setVip: (info) => {
    const next = {
      isVip: info.isVip,
      vipLevel: info.vipLevel,
      vipExpireTime: info.vipExpireTime,
      vipName: info.vipName,
      privileges: info.privileges,
    }
    setStorageSync(VIP_STORAGE_KEY, next)
    set(next)
  },
  checkVipStatus: async () => {
    try {
      const info: VipInfo = await getVipInfo()
      const active = isVipActive(info.expireTime || '')
      const next = {
        isVip: active,
        vipLevel: info.level,
        vipExpireTime: info.expireTime || '',
        vipName: info.name,
        privileges: info.privileges || [],
      }
      setStorageSync(VIP_STORAGE_KEY, next)
      set(next)
      return active
    } catch {
      return false
    }
  },
  clearVip: () => {
    setStorageSync(VIP_STORAGE_KEY, null)
    set({
      isVip: false,
      vipLevel: 0,
      vipExpireTime: '',
      vipName: '',
      privileges: [],
    })
  },
}))

export function getVipStatus(): { isVip: boolean; level: number; expireTime: string } {
  const stored = loadStoredVip()
  return {
    isVip: isVipActive(stored.vipExpireTime || ''),
    level: stored.vipLevel || 0,
    expireTime: stored.vipExpireTime || '',
  }
}
