import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useDarkModeStore = defineStore('darkMode', () => {
  const isDark = ref(document.documentElement.classList.contains('dark'))

  const isDarkMode = computed<boolean>(() => isDark.value)
  const themeMode = computed<'dark' | 'light'>(() => (isDark.value ? 'dark' : 'light'))

  const toggle = () => {
    isDark.value = !isDark.value
    if (isDark.value) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('darkMode', String(isDark.value))
  }

  const setDark = (value: boolean) => {
    isDark.value = value
    if (value) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('darkMode', String(value))
  }

  // 初始化时从 localStorage 读取
  const saved = localStorage.getItem('darkMode')
  if (saved !== null) {
    setDark(saved === 'true')
  }

  return { isDark, isDarkMode, themeMode, toggle, setDark }
})
