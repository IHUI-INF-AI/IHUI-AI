/**
 * useSidebar - 侧边栏状态 Composable（模块级单例）
 *
 * 整合 Sidebar/WorkspaceHeader/App.vue 共享的侧边栏状态：
 *   - isCollapsed：折叠状态（localStorage 持久化，key: 'sidebar-collapsed'）
 *   - width：展开态宽度（localStorage 持久化，key: 'sidebar-width'，范围 60-110）
 *   - isMobile：移动端检测（window.innerWidth < 768，防抖 resize）
 *   - isMobileOpen：移动端抽屉开关
 *   - toggleCollapse / openMobile / closeMobile / setWidth：状态变更方法
 *
 * 设计要点：
 *   - 模块级 ref：所有组件共享同一响应式源，消除 Sidebar/WorkspaceHeader 重复检测
 *   - 单个 resize 监听（带防抖），替代原先两组件各自的监听
 *   - 状态通过方法变更（toggleCollapse/openMobile/closeMobile/setWidth），外部不应直接改 ref
 *   - SSR 安全：window/localStorage 访问均加 typeof guard
 *   - 配置版本迁移：MIN_WIDTH/DEFAULT_WIDTH/COLLAPSE_THRESHOLD/MAX_WIDTH 调整时通过 CURRENT_CONFIG_VERSION
 *     自动清掉旧 width（避免用户在升级后看到 "旧持久化宽度 ≠ 新默认" 的体验割裂）
 */
import { ref, type Ref } from 'vue'

const STORAGE_KEY_COLLAPSED = 'sidebar-collapsed'
const STORAGE_KEY_WIDTH = 'sidebar-width'
const STORAGE_KEY_CONFIG_VERSION = 'sidebar-config-version'
const MOBILE_BREAKPOINT = 768

// 持久化配置版本号（用于 MIN_WIDTH/DEFAULT_WIDTH/COLLAPSE_THRESHOLD/MAX_WIDTH 调整时强制刷新用户本地缓存）
//   v1: COLLAPSE_THRESHOLD=120, DEFAULT_WIDTH=100, MAX_WIDTH=360
//   v2: COLLAPSE_THRESHOLD=100, DEFAULT_WIDTH=100, MAX_WIDTH=360
//   v3: COLLAPSE_THRESHOLD=100, DEFAULT_WIDTH=100, MAX_WIDTH=100（固定 100px）
//   v4: COLLAPSE_THRESHOLD=100, DEFAULT_WIDTH=100, MAX_WIDTH=120（可拉伸到 120）
//   v5: COLLAPSE_THRESHOLD=80, DEFAULT_WIDTH=80, MAX_WIDTH=180（紧凑→展开 80-180）
//   v6: COLLAPSE_THRESHOLD=80, DEFAULT_WIDTH=80, MAX_WIDTH=140（max 从 180 收紧到 140，4 字 label 完整）
//   v7: COLLAPSE_THRESHOLD=80, DEFAULT_WIDTH=140, MAX_WIDTH=140（默认宽屏 140，可向左拖到 80 紧凑 / 60 折叠）
//   v8: COLLAPSE_THRESHOLD=60, DEFAULT_WIDTH=100, MAX_WIDTH=100（紧凑默认 100，可向左拖到 60 紧凑 / <60 折叠到 60）
//   v9: COLLAPSE_THRESHOLD=60, DEFAULT_WIDTH=120, MAX_WIDTH=120（默认紧凑 120，可向左拖到 60 紧凑 / <60 折叠到 60）
//   v10: COLLAPSE_THRESHOLD=60, DEFAULT_WIDTH=110, MAX_WIDTH=110（默认紧凑 110，可向左拖到 60 紧凑 / <60 折叠到 60）
//   v11: COLLAPSE_THRESHOLD=60, DEFAULT_WIDTH=116, MAX_WIDTH=116（默认紧凑 116，可向左拖到 60 紧凑 / <60 折叠到 60）
// 升级时清掉 STORAGE_KEY_WIDTH，让新 DEFAULT_WIDTH 立即生效，
// 避免用户在升级后看到 "旧持久化宽度 ≠ 新默认" 的体验割裂
const CURRENT_CONFIG_VERSION = 11

// ── 宽度范围（展开态固定 116，可向左拖到 60 紧凑 / <60 折叠到 60）──
// min 60: 紧凑布局；text-overflow: ellipsis 已保证不破版
// max 116: 4 字中文 label 完整，5 字截断
// default 116: 首次打开默认紧凑（DEFAULT=MAX，向左拖可压缩；向右无空间）
const MIN_WIDTH = 60
const MAX_WIDTH = 116
// 默认 116px：紧凑布局（4 字 label 完整，5 字截断）
const DEFAULT_WIDTH = 116
// 拖拽折叠阈值：向左拖到此处以下自动进入折叠态（图标-only 60px），
// 向右拖超过此处自动展开。60 = MIN_WIDTH，触底即折叠。
const COLLAPSE_THRESHOLD = 60

// ── 模块级单例状态（所有组件共享） ──
const isCollapsed = ref(false)
const width = ref(DEFAULT_WIDTH)
const isMobile = ref(typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false)
const isMobileOpen = ref(false)

let initialized = false
let resizeTimeout: ReturnType<typeof setTimeout> | null = null

const migratePersistedConfig = (): void => {
  // 配置版本不匹配：清掉旧持久化 width，让新 DEFAULT_WIDTH 生效
  // 例：v1 (COLLAPSE_THRESHOLD=120, MIN_WIDTH=100) 时代存了 200，升级到 v2 后 200 仍在合法范围，
  //     但用户期望看到新默认 100，所以强制清掉
  try {
    const versionStr = localStorage.getItem(STORAGE_KEY_CONFIG_VERSION)
    const version = versionStr ? Number(versionStr) : 1
    if (Number.isNaN(version) || version < CURRENT_CONFIG_VERSION) {
      localStorage.removeItem(STORAGE_KEY_WIDTH)
      localStorage.setItem(STORAGE_KEY_CONFIG_VERSION, String(CURRENT_CONFIG_VERSION))
    }
  } catch {
    // localStorage 不可用（隐私模式等）
  }
}

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
  // 顺序很重要：先迁移（清掉旧版本持久化的 width），再读取（应用新 DEFAULT_WIDTH）
  migratePersistedConfig()
  loadPersisted()
  checkMobile()
  window.addEventListener('resize', handleResize, { passive: true })
}

export interface UseSidebarReturn {
  /** 侧边栏折叠状态（持久化） */
  isCollapsed: Ref<boolean>
  /** 展开态宽度（持久化，范围 60-116，默认 116） */
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
      // 主动写入 width 时同步写入 config version，避免下次迁移误判
      // （migrate 只在 version < CURRENT 时清 width，version === CURRENT 时不干预）
      localStorage.setItem(STORAGE_KEY_CONFIG_VERSION, String(CURRENT_CONFIG_VERSION))
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
