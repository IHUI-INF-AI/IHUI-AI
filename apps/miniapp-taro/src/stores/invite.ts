// 修复说明(2026-07-26):Taro 4.2.0 Vite runner 会把 `import { create } from 'zustand'`
// 错误归并为 `taro.react_production_min.create`(React 上无此函数),运行时抛
// `TypeError: taro.react_production_min.create is not a function`。
// 改用 `zustand/vanilla` 的 `createStore` + React 18 的 `useSyncExternalStore`
// 绕过 Taro Vite 的归并逻辑,与 stores/user.ts 的修复方案保持一致。
// 2026-07-28:useSyncExternalStore + Object.assign 模式已抽取到
// `./helpers/create-taro-zustand-hook`,与 user.ts/vip.ts 共用。
import { createStore } from 'zustand/vanilla'
import { getStorageSync, setStorageSync, removeStorageSync } from '@tarojs/taro'
import { createTaroZustandHook } from './helpers/create-taro-zustand-hook'

const INVITE_CODE_KEY = 'ihui_invite_code'

interface InviteState {
  inviteCode: string
  setInviteCode: (code: string) => void
  getInviteCode: () => string
  clearInviteCode: () => void
}

const inviteStoreApi = createStore<InviteState>((set, get) => ({
  inviteCode: getStorageSync(INVITE_CODE_KEY) || '',
  setInviteCode: (code) => {
    setStorageSync(INVITE_CODE_KEY, code)
    set({ inviteCode: code })
  },
  getInviteCode: () => get().inviteCode,
  clearInviteCode: () => {
    removeStorageSync(INVITE_CODE_KEY)
    set({ inviteCode: '' })
  },
}))

export const useInviteStore = createTaroZustandHook(inviteStoreApi)

export function getInviteCode(): string {
  return getStorageSync(INVITE_CODE_KEY) || ''
}

export function setInviteCode(code: string): void {
  setStorageSync(INVITE_CODE_KEY, code)
}
