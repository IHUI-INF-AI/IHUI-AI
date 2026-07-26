// 修复说明(2026-07-26):Taro 4.2.0 Vite runner 会把 `import { create } from 'zustand'`
// 错误归并为 `taro.react_production_min.create`(React 上无此函数),运行时抛
// `TypeError: taro.react_production_min.create is not a function`。
// 改用 `zustand/vanilla` 的 `createStore` + React 18 的 `useSyncExternalStore`
// 绕过 Taro Vite 的归并逻辑,与 stores/invite.ts 的修复方案保持一致。
import { useSyncExternalStore, useCallback } from 'react'
import { createStore, type StoreApi } from 'zustand/vanilla'
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

type UseVipStore = {
  (): VipState
  <U>(selector: (state: VipState) => U): U
  getState: () => VipState
  setState: StoreApi<VipState>['setState']
  subscribe: StoreApi<VipState>['subscribe']
}

const identity = <T>(s: T): T => s

function useVipStoreImpl<U>(selector: (state: VipState) => U = identity as (state: VipState) => U): U {
  return useSyncExternalStore(
    vipStoreApi.subscribe,
    useCallback(() => selector(vipStoreApi.getState()), [selector]),
    useCallback(() => selector(vipStoreApi.getInitialState()), [selector]),
  )
}

const useVipStore = Object.assign(useVipStoreImpl, {
  getState: vipStoreApi.getState,
  setState: vipStoreApi.setState,
  subscribe: vipStoreApi.subscribe,
}) as UseVipStore

export { useVipStore }

export function getVipStatus(): { isVip: boolean; level: number; expireTime: string } {
  const stored = loadStoredVip()
  return {
    isVip: isVipActive(stored.vipExpireTime || ''),
    level: stored.vipLevel || 0,
    expireTime: stored.vipExpireTime || '',
  }
}
