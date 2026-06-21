/**
 * 暗色模式工具函数
 * 提供统一的暗色模式访问接口
 */

import { computed, watch, onMounted, onUnmounted } from 'vue'
import { useDarkModeStore } from '@/stores/darkMode'

/**
 * 暗色模式 composable
 * 提供响应式的暗色模式状态和切换方法
 */
export function useDarkMode() {
  const darkModeStore = useDarkModeStore()

  // 响应式状态
  const isDark = computed(() => darkModeStore.isDarkMode)
  const themeMode = computed(() => darkModeStore.themeMode)
  const isAuto = computed(() => darkModeStore.themeMode === 'auto')

  // 切换方法（均使用即时应用，无过渡延迟）
  const toggle = () => darkModeStore.toggleDarkMode()
  const setLight = () => darkModeStore.setThemeMode('light', 'user', true)
  const setDark = () => darkModeStore.setThemeMode('dark', 'user', true)
  const setAuto = () => darkModeStore.setThemeMode('auto', 'user', true)

  return {
    // 状态
    isDark,
    themeMode,
    isAuto,

    // 方法
    toggle,
    setLight,
    setDark,
    setAuto,
  }
}

/**
 * 监听暗色模式变化
 * @param callback 暗色模式变化时的回调函数
 * @param immediate 是否立即执行一次
 */
export function useDarkModeChange(
  callback: (isDark: boolean) => void,
  immediate = false
) {
  const { isDark } = useDarkMode()

  const stop = watch(
    () => isDark.value,
    (newVal: boolean) => {
      callback(newVal)
    },
    { immediate }
  )

  onUnmounted(() => {
    stop()
  })

  return { stop }
}

/**
 * 根据暗色模式返回不同的值
 * @param lightValue 亮色模式下的值
 * @param darkValue 暗色模式下的值
 */
export function useDarkModeValue<T>(lightValue: T, darkValue: T) {
  const { isDark } = useDarkMode()
  return computed(() => (isDark.value ? darkValue : lightValue))
}

/**
 * 暗色模式 CSS 类名
 * 返回当前应该应用的暗色模式类名
 */
export function useDarkModeClass() {
  const { isDark } = useDarkMode()
  return computed(() => (isDark.value ? 'dark' : ''))
}

/**
 * 获取暗色模式下的图片路径
 * @param lightImage 亮色模式图片路径
 * @param darkImage 暗色模式图片路径
 */
export function useDarkModeImage(lightImage: string, darkImage: string) {
  const { isDark } = useDarkMode()
  return computed(() => (isDark.value ? darkImage : lightImage))
}

/**
 * 暗色模式初始化
 * 在组件挂载时确保暗色模式已正确应用
 */
export function useDarkModeInit() {
  const darkModeStore = useDarkModeStore()

  onMounted(() => {
    // 确保主题已应用
    darkModeStore.syncFromStorage()
  })
}

/**
 * 暗色模式样式变量
 * 返回常用的暗色模式相关 CSS 变量
 */
export function useDarkModeStyles() {
  const { isDark } = useDarkMode()

  return computed(() => ({
    '--current-bg': isDark.value ? 'var(--el-bg-color)' : 'var(--el-bg-color)',
    '--current-text': isDark.value
      ? 'var(--el-text-color-primary)'
      : 'var(--el-text-color-primary)',
    '--current-border': isDark.value
      ? 'var(--el-border-color-lighter)'
      : 'var(--el-border-color-lighter)',
  }))
}
