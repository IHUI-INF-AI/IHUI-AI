/**
 * Admin Mobile Responsive Utilities
 * 管理端移动端适配工具
 */

import { ref, computed, onMounted } from 'vue'
import { useCleanup } from '@/composables/useCleanup'

/** 断点配置 */
export const BREAKPOINTS = {
  xs: 480,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  xxl: 1536,
} as const

/** 设备类型检测 */
export function useDevice() {
  const cleanup = useCleanup()
  const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1280)

  const isMobile = computed(() => windowWidth.value < BREAKPOINTS.md)
  const isTablet = computed(() => windowWidth.value >= BREAKPOINTS.md && windowWidth.value < BREAKPOINTS.lg)
  const isDesktop = computed(() => windowWidth.value >= BREAKPOINTS.lg)
  const isSmallMobile = computed(() => windowWidth.value < BREAKPOINTS.sm)

  let resizeRafId: number | null = null
  cleanup.add(() => { if (resizeRafId !== null) cancelAnimationFrame(resizeRafId) })
  function onResize() {
    if (resizeRafId !== null) return
    resizeRafId = requestAnimationFrame(() => {
      resizeRafId = null
      windowWidth.value = window.innerWidth
    })
  }

  onMounted(() => {
    cleanup.addEventListener(window, 'resize', onResize as EventListener, { passive: true })
  })

  return { windowWidth, isMobile, isTablet, isDesktop, isSmallMobile }
}

/** 侧边栏状态（移动端） */
export function useAdminSidebar() {
  const drawerVisible = ref(false)

  function openDrawer() {
    drawerVisible.value = true
  }

  function closeDrawer() {
    drawerVisible.value = false
  }

  function toggleDrawer() {
    drawerVisible.value = !drawerVisible.value
  }

  return { drawerVisible, openDrawer, closeDrawer, toggleDrawer }
}
