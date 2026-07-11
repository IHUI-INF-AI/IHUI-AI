import { create } from 'zustand'

export type ThirdPartyPlatform = 'google' | 'apple' | 'wechat' | 'dingtalk' | 'github'

export interface ThirdPartyAccount {
  id: string
  platform: ThirdPartyPlatform
  nickname: string
  avatar: string | null
  status: 'active' | 'unbound'
  boundAt: string
}

interface AuthThirdPartyState {
  /** 各平台登录中状态 */
  loginStates: Record<ThirdPartyPlatform, 'idle' | 'pending' | 'success' | 'failed'>
  /** 已绑定的第三方账号 */
  boundAccounts: ThirdPartyAccount[]
  setLoginState: (
    platform: ThirdPartyPlatform,
    status: AuthThirdPartyState['loginStates'][ThirdPartyPlatform],
  ) => void
  setBoundAccounts: (accounts: ThirdPartyAccount[]) => void
  addBoundAccount: (account: ThirdPartyAccount) => void
  removeBoundAccount: (id: string) => void
  isBound: (platform: ThirdPartyPlatform) => boolean
  reset: () => void
}

const IDLE_STATES: AuthThirdPartyState['loginStates'] = {
  google: 'idle',
  apple: 'idle',
  wechat: 'idle',
  dingtalk: 'idle',
  github: 'idle',
}

/** 第三方登录状态 Store，管理各平台登录/绑定状态 */
export const useAuthThirdPartyStore = create<AuthThirdPartyState>((set, get) => ({
  loginStates: { ...IDLE_STATES },
  boundAccounts: [],

  setLoginState: (platform, status) =>
    set((s) => ({ loginStates: { ...s.loginStates, [platform]: status } })),

  setBoundAccounts: (boundAccounts) => set({ boundAccounts }),

  addBoundAccount: (account) => set((s) => ({ boundAccounts: [...s.boundAccounts, account] })),

  removeBoundAccount: (id) =>
    set((s) => ({ boundAccounts: s.boundAccounts.filter((a) => a.id !== id) })),

  isBound: (platform) =>
    get().boundAccounts.some((a) => a.platform === platform && a.status === 'active'),

  reset: () => set({ loginStates: { ...IDLE_STATES }, boundAccounts: [] }),
}))
