/**
 * 全局 AI 对话 Composable
 * 抽离自 App.vue 的 openGlobalChat / closeGlobalChat 逻辑
 *
 * 暴露:
 *  - open(options): 打开 AI 对话,可附带初始文本/模式
 *  - close(): 关闭
 *  - isOpen: 当前打开状态 ref
 *  - install(): 挂到 window.openGlobalChat / window.closeGlobalChat
 *
 * 与 useAiPanel 的协作（2026-06-28 重构）:
 *  - open() 会同时调用 useAiPanel.open() 打开右侧面板容器
 *  - 面板可见性由 useAiPanel 管理（持久化、移动端检测）
 *  - 本 composable 仅负责"对话内容初始化"（initialText/mode/agent 等）
 */

import { ref, nextTick, onUnmounted } from 'vue'
import { useAiPanel } from '@/composables/useAiPanel'

export interface OpenChatOptions {
  sessionId?: string
  initialText?: string
  mode?: string
}

interface FloatingChatRef {
  openDialog?: () => void
  focusInput?: () => void
  setInitialText?: (text: string) => void
  setInitialAgentTag?: (name: string, avatar?: string) => void
  switchMode?: (mode: string) => void
  selectAgent?: (agent: unknown) => void
  selectModel?: (model: unknown) => void
  [key: string]: unknown
}

export interface GlobalChat {
  isOpen: import('vue').Ref<boolean>
  open: (options?: OpenChatOptions) => Promise<void>
  close: () => void
  /** 由 App.vue 注入 ref,组件挂载后调用 setRef 写入 */
  setFloatingChatRef: (ref: FloatingChatRef | null) => void
  install: () => void
  dispose: () => void
}

export function useGlobalChat(): GlobalChat {
  const isOpen = ref(false)
  let chatRef: FloatingChatRef | null = null

  // 复用单例面板状态：open() 时同步打开右侧面板
  const aiPanel = useAiPanel()

  const setFloatingChatRef = (r: FloatingChatRef | null) => {
    chatRef = r
  }

  const open = async (options?: OpenChatOptions) => {
    if (typeof window === 'undefined') return
    isOpen.value = true
    ;(window as Window & { isGlobalChatOpen?: boolean }).isGlobalChatOpen = true

    // 同步打开左侧 AI 面板（桌面端生效，移动端由 AIChatLegacy 浮窗接管）
    aiPanel.open()
    // 外部调用 open() 即视为用户要进入对话，跳过空文件夹占位态
    aiPanel.enterWorkspace()

    await nextTick()
    if (!chatRef) return

    if (options?.initialText && chatRef.setInitialText) {
      chatRef.setInitialText(options.initialText)
    }
    chatRef.focusInput?.()
    chatRef.openDialog?.()

    if (options?.mode) {
      const openFn = (window as Window & { openFloatingChat?: (o: unknown) => void }).openFloatingChat
      if (openFn) openFn({ initialText: options.initialText, mode: options.mode })
    }
  }

  const close = () => {
    isOpen.value = false
    if (typeof window !== 'undefined') {
      ;(window as Window & { isGlobalChatOpen?: boolean }).isGlobalChatOpen = false
    }
  }

  const install = () => {
    if (typeof window === 'undefined') return
    ;(window as Window & { openGlobalChat?: typeof open }).openGlobalChat = open
    ;(window as Window & { closeGlobalChat?: typeof close }).closeGlobalChat = close
  }

  const dispose = () => {
    if (typeof window === 'undefined') return
    delete (window as Window & { openGlobalChat?: typeof open }).openGlobalChat
    delete (window as Window & { closeGlobalChat?: typeof close }).closeGlobalChat
  }

  onUnmounted(() => dispose())

  return { isOpen, open, close, setFloatingChatRef, install, dispose }
}
