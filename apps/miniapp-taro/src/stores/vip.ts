// 修复说明(2026-07-26):Taro 4.2.0 Vite runner 会把 `import { create } from 'zustand'`
// 错误归并为 `taro.react_production_min.create`(React 上无此函数),运行时抛
// `TypeError: taro.react_production_min.create is not a function`。
// 改用 `zustand/vanilla` 的 `createStore` + createTaroZustandHook
// 绕过 Taro Vite 的归并逻辑,与 stores/invite.ts 的修复方案保持一致。
// 2026-07-28 P0-1: 复用 stores/helpers/create-taro-zustand-hook.ts,消除三处重复实现。
// 2026-07-28 P0-3: storage key 迁移 'ihui_vip_info'(下划线) → 'ihui-vip-info'(连字符),
//   与 @ihui/shared/constants VIP_STORAGE_KEY 对齐,保证切端状态一致。
// 2026-07-28 抽离:迁移逻辑改用 @ihui/shared migrateLegacyStorageKey 通用工具;
//   VIP 状态判断改用 @ihui/shared isVipActive + getVipStatusFromSnapshot,消除端内重复。
import { createStore } from 'zustand/vanilla'
import { getStorageSync, setStorageSync, removeStorageSync } from '@tarojs/taro'
import { getVipInfo } from '../api'
import type { VipInfo } from '../api'
import { createTaroZustandHook } from './helpers/create-taro-zustand-hook'
import { VIP_STORAGE_KEY } from '@/constants/storage'
import { migrateLegacyStorageKey, isVipActive, getVipStatusFromSnapshot } from '@ihui/shared'
import { createSyncTransport } from '@ihui/shared/stores'

// 历史遗留 key(下划线),仅用于一次性迁移到连字符 key
const LEGACY_VIP_STORAGE_KEY = 'ihui_vip_info'

// store 初始化前执行迁移(模块加载时一次性执行)
migrateLegacyStorageKey(
  createSyncTransport({
    getItem: (key) => getStorageSync(key) || null,
    setItem: (key, value) => setStorageSync(key, value),
    removeItem: (key) => removeStorageSync(key),
  }),
  LEGACY_VIP_STORAGE_KEY,
  VIP_STORAGE_KEY,
)

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

const vipStoreApi = createStore<VipState>((set) => ({
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

const useVipStore = createTaroZustandHook(vipStoreApi)

export { useVipStore }

export function getVipStatus(): { isVip: boolean; level: number; expireTime: string } {
  return getVipStatusFromSnapshot(loadStoredVip())
}
