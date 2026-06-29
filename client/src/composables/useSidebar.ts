/**
 * useSidebar - 侧边栏状态 Composable（模块级单例）
 *
 * 整合 Sidebar/WorkspaceHeader/App.vue 共享的侧边栏状态：
 *   - isCollapsed：折叠状态（localStorage 持久化，key: 'sidebar-collapsed'）
 *   - width：展开态宽度（localStorage 持久化，key: 'sidebar-width'，范围 120-360）
 *   - isMobile：移动端检测（window.innerWidth < 768，防抖 resize）
 *   - isMobileOpen：移动端抽屉开关
 *   - toggleCollapse / openMobile / closeMobile / setWidth：状态变更方法
 *
 * 设计要点：
 *   - 模块级 ref：所有组件共享同一响应式源，消除 Sidebar/WorkspaceHeader 重复检测
 *   - 单个 resize 监听（带防抖），替代原先两组件各自的监听
 *   - 状态通过方法变更（toggleCollapse/openMobile/closeMobile/setWidth），外部不应直接改 ref
 *   - SSR 安全：window/localStorage 访问均加 typeof guard
 */
import { ref, type Ref } from 'vue'

const STORAGE_KEY_COLLAPSED = 'sidebar-collapsed'
const STORAGE_KEY_WIDTH = 'sidebar-width'
const MOBILE_BREAKPOINT = 768

// ── 宽度范围（展开态可拖拽缩放）──
// min 120: 允许用户拖到默认宽度 133 附近（text-overflow: ellipsis 已保证不破版）；
// max 360: 避免占用过多工作区空间
const MIN_WIDTH = 120
const MAX_WIDTH = 360
// 默认 133 = 200 的 2/3，更紧凑的初始宽度
const DEFAULT_WIDTH = 133
// 拖拽折叠阈值：向左拖到此处以下自动进入折叠态（图标-only 60px），
// 向右拖超过此处自动展开。120 = 折叠宽度 60 + 缓冲 60，避免误触。
const COLLAPSE_THRESHOLD = 120

// ── 模块级单例状态（所有组件共享） ──
const isCollapsed = ref(false)
const width = ref(DEFAULT_WIDTH)
const isMobile = ref(typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false)
const isMobileOpen = ref(false)

let initialized = false
let resizeTimeout: ReturnType<typeof setTimeout> | null = null

const loadPersisted = (): void => {
  try {
    const savedCollapsed = localStorage.getItem(STORAGE_KEY_COLLAPSED)
    if (savedCollapsed !== null) {
      isCollapsed.value = savedCollapsed === 'true'
    }
    const savedWidth = localStorage.getItem(STORAGE_KEY_WIDTH)
    if (savedWidth !== null) {
      const w = Number(savedWidth)
      if (!Number.isNaN(w) && w >= MIN_WIDTH && w <= MAX_WIDTH) {
        width.value = w
      }
    }
  } catch {
    // localStorage 不可用（隐私模式等）
  }
}

const checkMobile = (): void => {
  if (typeof window !== 'undefined') {
    isMobile.value = window.innerWidth < MOBILE_BREAKPOINT
  }
}

const handleResize = (): void => {
  if (resizeTimeout) {
    clearTimeout(resizeTimeout)
  }
  resizeTimeout = setTimeout(checkMobile, 100)
}

// 模块加载时初始化（仅浏览器环境，仅一次）
if (typeof window !== 'undefined' && !initialized) {
  initialized = true
  loadPersisted()
  checkMobile()
  window.addEventListener('resize', handleResize, { passive: true })
}

export interface UseSidebarReturn {
  /** 侧边栏折叠状态（持久化） */
  isCollapsed: Ref<boolean>
  /** 展开态宽度（持久化，范围 180-360） */
  width: Ref<number>
  /** 移动端检测（< 768px） */
  isMobile: Ref<boolean>
  /** 移动端抽屉开关 */
  isMobileOpen: Ref<boolean>
  /** 最小/最大宽度常量（供拖拽手柄校验） */
  minWidth: number
  maxWidth: number
  /** 切换折叠状态（并持久化） */
  toggleCollapse: () => void
  /** 打开移动端抽屉 */
  openMobile: () => void
  /** 关闭移动端抽屉 */
  closeMobile: () => void
  /** 设置展开态宽度（自动 clamp + 持久化） */
  setWidth: (w: number) => void
}

/**
 * 使用侧边栏状态（单例）
 *
 * 多次调用返回同一组响应式状态，适合 Sidebar/WorkspaceHeader/App.vue 共享。
 */
export function useSidebar(): UseSidebarReturn {
  const toggleCollapse = (): void => {
    isCollapsed.value = !isCollapsed.value
    persistCollapsed()
  }

  const openMobile = (): void => {
    isMobileOpen.value = true
  }

  const closeMobile = (): void => {
    isMobileOpen.value = false
  }

  const persistCollapsed = (): void => {
    try {
      localStorage.setItem(STORAGE_KEY_COLLAPSED, String(isCollapsed.value))
    } catch {
      // localStorage 不可用
    }
  }

  const setWidth = (w: number): void => {
    // 拖拽到阈值以下：自动折叠到图标-only（60px），不更新展开宽度
    if (w < COLLAPSE_THRESHOLD) {
      if (!isCollapsed.value) {
        isCollapsed.value = true
        persistCollapsed()
      }
      return
    }
    // 超过阈值：自动展开 + clamp 到 [MIN_WIDTH, MAX_WIDTH]
    if (isCollapsed.value) {
      isCollapsed.value = false
      persistCollapsed()
    }
    const clamped = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, w))
    width.value = clamped
    try {
      localStorage.setItem(STORAGE_KEY_WIDTH, String(clamped))
    } catch {
      // localStorage 不可用
    }
  }

  return {
    isCollapsed,
    width,
    isMobile,
    isMobileOpen,
    minWidth: MIN_WIDTH,
    maxWidth: MAX_WIDTH,
    toggleCollapse,
    openMobile,
    closeMobile,
    setWidth,
  }
}

export default useSidebar
