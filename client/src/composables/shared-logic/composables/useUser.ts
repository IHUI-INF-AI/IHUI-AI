import { ref, computed } from 'vue'
import { getStorage, setStorage, removeStorage } from '../utils/index'
import { request } from '../api/index'

export interface UserInfo {
  id: string
  nickname: string
  avatar: string
  phone: string
  vipLevel: number
  vipExpireTime: string
  [key: string]: any
}

const TOKEN_KEY = 'token'
const USER_KEY = 'userInfo'

const userInfo = ref<UserInfo | null>(null)
const token = ref<string>('')

function initFromStorage() {
  token.value = getStorage(TOKEN_KEY) || ''
  const raw = getStorage(USER_KEY)
  if (raw) {
    try {
      userInfo.value = typeof raw === 'string' ? JSON.parse(raw) : raw
    } catch {
      userInfo.value = null
    }
  }
}

export function useUser() {
  const isLoggedIn = computed(() => !!token.value)

  function setToken(t: string) {
    token.value = t
    setStorage(TOKEN_KEY, t)
  }

  function clearUser() {
    token.value = ''
    userInfo.value = null
    removeStorage(TOKEN_KEY)
    removeStorage(USER_KEY)
  }

  async function login(params: { phone?: string; code?: string; wxCode?: string }) {
    const res = await request({ url: '/api/user/login', method: 'POST', data: params })
    setToken(res.data.token)
    userInfo.value = res.data.userInfo
    setStorage(USER_KEY, JSON.stringify(res.data.userInfo))
    return res.data
  }

  async function logout() {
    try {
      await request({ url: '/api/user/logout', method: 'POST' })
    } finally {
      clearUser()
    }
  }

  async function fetchUserInfo() {
    if (!token.value) return null
    const res = await request({ url: '/api/user/info', method: 'GET' })
    userInfo.value = res.data
    setStorage(USER_KEY, JSON.stringify(res.data))
    return res.data
  }

  function updateUserInfo(info: Partial<UserInfo>) {
    if (userInfo.value) {
      userInfo.value = { ...userInfo.value, ...info }
      setStorage(USER_KEY, JSON.stringify(userInfo.value))
    }
  }

  initFromStorage()

  return {
    userInfo,
    token,
    isLoggedIn,
    login,
    logout,
    fetchUserInfo,
    updateUserInfo,
    setToken,
    clearUser,
  }
}
