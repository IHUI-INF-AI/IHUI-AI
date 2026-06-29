/**
 * useAiPanel - 左侧 AI 对话面板状态 Composable（模块级单例）
 *
 * 参考 Trae Work 风格的左侧 AI 助手面板（紧贴 Sidebar 右侧）：
 *   - isOpen：面板开关（localStorage 持久化，key: 'ai-panel-open'）
 *   - width：面板宽度（localStorage 持久化，key: 'ai-panel-width'）
 *   - toggle / open / close / setWidth：状态变更方法
 *
 * 设计要点：
 *   - 模块级 ref：所有组件共享同一响应式源（App.vue / WorkspaceHeader / Sidebar 等）
 *   - 桌面端默认开启（解决原"AI 对话框未显示"问题）
 *   - 移动端不显示（保持移动端现有体验，由 AIChatLegacy 浮窗接管）
 *   - SSR 安全：window/localStorage 访问均加 typeof guard
 *
 * 与 useGlobalChat 的关系：
 *   - useGlobalChat 控制"对话内容/初始化"（initialText/mode/agent 等）
 *   - useAiPanel 控制"面板容器可见性/尺寸"
 */
import { ref, type Ref } from 'vue'

const STORAGE_KEY_OPEN = 'ai-panel-open'
const STORAGE_KEY_WIDTH = 'ai-panel-width'
const STORAGE_KEY_ENTERED = 'ai-panel-entered'
const MOBILE_BREAKPOINT = 768

const MIN_WIDTH = 320
const MAX_WIDTH = 720
const DEFAULT_WIDTH = 400

// ── 模块级单例状态 ──
const isOpen = ref(false)
const width = ref(DEFAULT_WIDTH)
// 工作区是否已进入：默认 false（空文件夹形态），用户主动进入后置 true 并持久化
const hasEnteredWorkspace = ref(false)
const isMobile = ref(
  typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false,
)

let initialized = false
let resizeTimeout: ReturnType<typeof setTimeout> | null = null

const loadPersisted = (): void => {
  try {
    const savedOpen = localStorage.getItem(STORAGE_KEY_OPEN)
    // 桌面端默认开启；移动端默认关闭
    if (savedOpen !== null) {
      isOpen.value = savedOpen === 'true'
    } else {
      isOpen.value = !isMobile.value
    }
    const savedWidth = localStorage.getItem(STORAGE_KEY_WIDTH)
    if (savedWidth !== null) {
      const w = Number(savedWidth)
      if (!Number.isNaN(w) && w >= MIN_WIDTH && w <= MAX_WIDTH) {
        width.value = w
      }
    }
    const savedEntered = localStorage.getItem(STORAGE_KEY_ENTERED)
    hasEnteredWorkspace.value = savedEntered === 'true'
    // eslint-disable-next-line no-console
    console.log('[useAiPanel] loadPersisted:', {
      savedOpen,
      savedEntered,
      innerWidth: typeof window !== 'undefined' ? window.innerWidth : 'N/A',
      isMobile: isMobile.value,
      isOpen: isOpen.value,
      hasEnteredWorkspace: hasEnteredWorkspace.value,
    })
  } catch {
    // localStorage 不可用（隐私模式等）
  }
}

const checkMobile = (): void => {
  if (typeof window === 'undefined') return
  const mobile = window.innerWidth < MOBILE_BREAKPOINT
  isMobile.value = mobile
  // 移动端自动关闭面板（避免挤压主内容）
  if (mobile && isOpen.value) {
    isOpen.value = false
  }
}

const handleResize = (): void => {
  if (resizeTimeout) clearTimeout(resizeTimeout)
  resizeTimeout = setTimeout(checkMobile, 100)
}

if (typeof window !== 'undefined' && !initialized) {
  initialized = true
  loadPersisted()
  checkMobile()
  window.addEventListener('resize', handleResize, { passive: true })
}

export interface UseAiPanelReturn {
  /** 面板开关（持久化，桌面端默认 true） */
  isOpen: Ref<boolean>
  /** 面板宽度（持久化，范围 320-720） */
  width: Ref<number>
  /** 移动端检测 */
  isMobile: Ref<boolean>
  /** 工作区是否已进入（持久化，默认 false 显示空文件夹形态） */
  hasEnteredWorkspace: Ref<boolean>
  /** 最小/最大宽度常量（供拖拽手柄校验） */
  minWidth: number
  maxWidth: number
  /** 切换面板开关（并持久化） */
  toggle: () => void
  /** 打开面板（并持久化） */
  open: () => void
  /** 关闭面板（并持久化） */
  close: () => void
  /** 设置面板宽度（自动 clamp + 持久化） */
  setWidth: (w: number) => void
  /** 进入工作区（置 true 并持久化，触发 AIChat 渲染） */
  enterWorkspace: () => void
  /** 重置工作区（置 false 并持久化，回到空文件夹形态） */
  resetWorkspace: () => void
}

export function useAiPanel(): UseAiPanelReturn {
  const persist = (): void => {
    try {
      localStorage.setItem(STORAGE_KEY_OPEN, String(isOpen.value))
    } catch {
      // ignore
    }
  }

  const persistEntered = (): void => {
    try {
      localStorage.setItem(STORAGE_KEY_ENTERED, String(hasEnteredWorkspace.value))
    } catch {
      // ignore
    }
  }

  const toggle = (): void => {
    // eslint-disable-next-line no-console
    console.log('[useAiPanel] toggle called, before:', { isMobile: isMobile.value, isOpen: isOpen.value })
    // 移动端不响应（由浮窗接管）
    if (isMobile.value) return
    isOpen.value = !isOpen.value
    persist()
    // eslint-disable-next-line no-console
    console.log('[useAiPanel] toggle after:', { isOpen: isOpen.value })
  }

  const open = (): void => {
    if (isMobile.value) return
    if (isOpen.value) return
    isOpen.value = true
    persist()
  }

  const close = (): void => {
    if (!isOpen.value) return
    isOpen.value = false
    persist()
  }

  const setWidth = (w: number): void => {
    const clamped = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, w))
    width.value = clamped
    try {
      localStorage.setItem(STORAGE_KEY_WIDTH, String(clamped))
    } catch {
      // ignore
    }
  }

  const enterWorkspace = (): void => {
    if (hasEnteredWorkspace.value) return
    hasEnteredWorkspace.value = true
    persistEntered()
  }

  const resetWorkspace = (): void => {
    if (!hasEnteredWorkspace.value) return
    hasEnteredWorkspace.value = false
    persistEntered()
  }

  return {
    isOpen,
    width,
    isMobile,
    hasEnteredWorkspace,
    minWidth: MIN_WIDTH,
    maxWidth: MAX_WIDTH,
    toggle,
    open,
    close,
    setWidth,
    enterWorkspace,
    resetWorkspace,
  }
}

export default useAiPanel
