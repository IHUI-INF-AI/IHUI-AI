import { defineStore } from 'pinia'
import { useUser as useSharedUser } from '@/composables/shared-logic'

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
}

export const useUserStore = defineStore('user', {
  state: (): UserState => ({
    isLoggedIn: false,
    token: '',
    userInfo: null,
    inviteCode: '123',
  }),

  getters: {
    getToken: (state) => state.token,
    getUserInfo: (state) => state.userInfo,
    getInviteCode: (state) => state.inviteCode,
    isLoggedIn: (state) => state.isLoggedIn,
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
