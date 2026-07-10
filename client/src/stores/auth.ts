import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('token'))
  const user = ref<Record<string, any> | null>(null)
  
  const isLoggedIn = computed(() => !!token.value)
  
  const setToken = (newToken: string | null) => {
    token.value = newToken
    if (newToken) {
      localStorage.setItem('token', newToken)
    } else {
      localStorage.removeItem('token')
    }
  }
  
  const setUser = (newUser: Record<string, any> | null) => {
    user.value = newUser
  }
  
  const logout = () => {
    setToken(null)
    setUser(null)
  }
  
  return { token, user, isLoggedIn, setToken, setUser, logout }
})
