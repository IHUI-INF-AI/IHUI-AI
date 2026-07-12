import { create } from 'zustand'
import { getStorageSync, setStorageSync, removeStorageSync } from '@tarojs/taro'

const INVITE_CODE_KEY = 'ihui_invite_code'

interface InviteState {
  inviteCode: string
  setInviteCode: (code: string) => void
  getInviteCode: () => string
  clearInviteCode: () => void
}

export const useInviteStore = create<InviteState>((set, get) => ({
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

export function getInviteCode(): string {
  return getStorageSync(INVITE_CODE_KEY) || ''
}

export function setInviteCode(code: string): void {
  setStorageSync(INVITE_CODE_KEY, code)
}
