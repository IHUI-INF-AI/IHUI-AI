import { defineStore } from 'pinia'
import { useUser as useSharedUser, useVip as useSharedVip } from '@/composables/shared-logic'

interface UserInfo {
  isLoggedIn?: boolean
  username?: string
  isVip?: boolean
  userId?: string
  avatarUrl?: string
  phone?: string
  identityTypy?: string
  vipExpireTime?: string
  [key: string]: unknown
}

interface UserState {
  isLoggedIn: boolean
  token: string
  userInfo: UserInfo | null
  inviteCode: string
  vipFeatures: string[]
}

export const useUserStore = defineStore('user', {
  state: (): UserState => ({
    isLoggedIn: false,
    token: '',
    userInfo: null,
    inviteCode: '123',
    vipFeatures: [],
  }),

  getters: {
    getToken: (state) => state.token,
    getUserInfo: (state) => state.userInfo,
    getInviteCode: (state) => state.inviteCode,
    isLoggedIn: (state) => state.isLoggedIn,
    getVipFeatures: (state) => state.vipFeatures,
  },

  actions: {
    setInviteCode(code: string) {
      this.inviteCode = code
    },

    setLoginState(isLoggedIn: boolean) {
      this.isLoggedIn = isLoggedIn
    },

    setToken(token: string) {
      this.token = token
      const { setToken: sharedSetToken } = useSharedUser()
      sharedSetToken(token)
    },

    setUserInfo(userInfo: UserInfo) {
      this.userInfo = userInfo
      const { updateUserInfo } = useSharedUser()
      updateUserInfo(userInfo as any)
    },

    setVipStatus(status: boolean) {
      if (this.userInfo) {
        this.userInfo.isVip = status
      }
    },

    setVipExpireTime(time: string) {
      if (this.userInfo) {
        this.userInfo.vipExpireTime = time
      }
    },

    setVipFeatures(features: string[]) {
      this.vipFeatures = features
    },

    async purchaseVip(planId?: string) {
      // 调用 shared-logic 的 useVip 完成购买
      // planId 可选：若调用方未传，尝试从存储中取当前选中套餐
      const { purchaseVip: sharedPurchaseVip } = useSharedVip()
      const id = planId || uni.getStorageSync('currentPlanId') || ''
      if (!id) {
        throw new Error('purchaseVip: 缺少 planId')
      }
      const result = await sharedPurchaseVip(id, 'wechat')
      // 购买成功后刷新 VIP 状态
      if (this.userInfo) {
        this.userInfo.isVip = true
      }
      return result
    },

    clearUserData() {
      this.isLoggedIn = false
      this.token = ''
      this.userInfo = null
      const { clearUser } = useSharedUser()
      clearUser()
    },

    logout() {
      const { logout: sharedLogout } = useSharedUser()
      sharedLogout().catch(() => {})
      this.clearUserData()
    },

    async checkLoginStatus(): Promise<boolean> {
      try {
        const { fetchUserInfo, isLoggedIn } = useSharedUser()
        if (!isLoggedIn.value) {
          this.clearUserData()
          return false
        }

        const userInfo = await fetchUserInfo()
        if (userInfo) {
          this.setUserInfo(userInfo)
          this.setLoginState(true)
          return true
        }

        this.clearUserData()
        return false
      } catch (error) {
        this.clearUserData()
        return false
      }
    },

    async wxLogin(code: string): Promise<boolean> {
      try {
        const { login } = useSharedUser()
        const result = await login({ wxCode: code })
        if (result) {
          this.setToken(result.token)
          this.setUserInfo(result.userInfo)
          this.setLoginState(true)
          return true
        }
        return false
      } catch (error) {
        return false
      }
    },
  },
})
