// 修复说明(2026-07-26):Taro 4.2.0 Vite runner 会把 `import { create } from 'zustand'`
// 错误归并为 `taro.react_production_min.create`(React 上无此函数),运行时抛
// `TypeError: taro.react_production_min.create is not a function`。
// 改用 `zustand/vanilla` 的 `createStore` + React 18 的 `useSyncExternalStore`
// 绕过 Taro Vite 的归并逻辑,与 stores/user.ts 的修复方案保持一致。
import { useSyncExternalStore, useCallback } from 'react'
import { createStore, type StoreApi } from 'zustand/vanilla'
import { getStorageSync, setStorageSync, removeStorageSync } from '@tarojs/taro'

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

type UseInviteStore = {
  (): InviteState
  <U>(selector: (state: InviteState) => U): U
  getState: () => InviteState
  setState: StoreApi<InviteState>['setState']
  subscribe: StoreApi<InviteState>['subscribe']
}

const identity = <T>(s: T): T => s

function useInviteStoreImpl<U>(selector: (state: InviteState) => U = identity as (state: InviteState) => U): U {
  return useSyncExternalStore(
    inviteStoreApi.subscribe,
    useCallback(() => selector(inviteStoreApi.getState()), [selector]),
    useCallback(() => selector(inviteStoreApi.getInitialState()), [selector]),
  )
}

const useInviteStore = Object.assign(useInviteStoreImpl, {
  getState: inviteStoreApi.getState,
  setState: inviteStoreApi.setState,
  subscribe: inviteStoreApi.subscribe,
}) as UseInviteStore

export { useInviteStore }

export function getInviteCode(): string {
  return getStorageSync(INVITE_CODE_KEY) || ''
}

export function setInviteCode(code: string): void {
  setStorageSync(INVITE_CODE_KEY, code)
}
