// 修复说明(2026-07-26):Taro 4.2.0 Vite runner 会把 `import { create } from 'zustand'`
// 错误归并为 `taro.react_production_min.create`(React 上无此函数),运行时抛
// `TypeError: taro.react_production_min.create is not a function`。
// 改用 `zustand/vanilla` 的 `createStore` + createTaroZustandHook
// 绕过 Taro Vite 的归并逻辑,与 stores/user.ts 的修复方案保持一致。
// 2026-07-28 P0-1: 复用 stores/helpers/create-taro-zustand-hook.ts,消除三处重复实现。
// 2026-07-28 P0-3: storage key 迁移 'ihui_invite_code'(下划线) → 'ihui-invite-code'(连字符),
//   与 @ihui/shared/constants INVITE_CODE_STORAGE_KEY 对齐,保证切端状态一致。
// 2026-07-28 抽离:迁移逻辑改用 @ihui/shared migrateLegacyStorageKey 通用工具,消除端内重复。
import { createStore } from 'zustand/vanilla'
import { getStorageSync, setStorageSync, removeStorageSync } from '@tarojs/taro'
import { createTaroZustandHook } from './helpers/create-taro-zustand-hook'
import { INVITE_CODE_STORAGE_KEY } from '@/constants/storage'
import { migrateLegacyStorageKey } from '@ihui/shared'
import { createSyncTransport } from '@ihui/shared/stores'

// 历史遗留 key(下划线),仅用于一次性迁移到连字符 key
const LEGACY_INVITE_CODE_KEY = 'ihui_invite_code'

// store 初始化前执行迁移(模块加载时一次性执行)
migrateLegacyStorageKey(
  createSyncTransport({
    getItem: (key) => getStorageSync(key) || null,
    setItem: (key, value) => setStorageSync(key, value),
    removeItem: (key) => removeStorageSync(key),
  }),
  LEGACY_INVITE_CODE_KEY,
  INVITE_CODE_STORAGE_KEY,
)

interface InviteState {
  inviteCode: string
  setInviteCode: (code: string) => void
  getInviteCode: () => string
  clearInviteCode: () => void
}

const inviteStoreApi = createStore<InviteState>((set, get) => ({
  inviteCode: getStorageSync(INVITE_CODE_STORAGE_KEY) || '',
  setInviteCode: (code) => {
    setStorageSync(INVITE_CODE_STORAGE_KEY, code)
    set({ inviteCode: code })
  },
  getInviteCode: () => get().inviteCode,
  clearInviteCode: () => {
    removeStorageSync(INVITE_CODE_STORAGE_KEY)
    set({ inviteCode: '' })
  },
}))

const useInviteStore = createTaroZustandHook(inviteStoreApi)

export { useInviteStore }

export function getInviteCode(): string {
  return getStorageSync(INVITE_CODE_STORAGE_KEY) || ''
}

export function setInviteCode(code: string): void {
  setStorageSync(INVITE_CODE_STORAGE_KEY, code)
}
