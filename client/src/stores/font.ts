import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useFontStore = defineStore('font', () => {
  // 状态
  const currentFont = ref('HarmonyOS Sans SC')

  // 强制使用 HarmonyOS Sans SC，不允许系统字体回退
  const harmonyFontStack = "'HarmonyOS Sans SC'"

  // 方法
  function setFont(font: string) {
    currentFont.value = font
    // 保存到本地存储
    localStorage.setItem('font', font)
    // 应用到CSS变量（强制使用 HarmonyOS Sans SC）
    document.documentElement.style.setProperty(
      '--font-family-chinese',
      harmonyFontStack,
      'important'
    )
  }

  function initFont() {
    // 从本地存储读取设置
    const savedFont = localStorage.getItem('font')
    if (savedFont) {
      currentFont.value = savedFont
    }
    // 应用到CSS变量（强制使用 HarmonyOS Sans SC）
    document.documentElement.style.setProperty(
      '--font-family-chinese',
      harmonyFontStack,
      'important'
    )
  }

  return {
    currentFont,
    setFont,
    initFont,
  }
}, {
  // P21: 启用 Pinia 持久化插件 (仅持久化 currentFont)
  persist: {
    paths: ['currentFont'],
    key: 'pinia-font',
    debounce: 200,
  },
})
