/**
 * 全局 AI 对话 Composable
 * 抽离自 App.vue 的 openGlobalChat / closeGlobalChat 逻辑
 *
 * 暴露:
 *  - open(options): 打开 AI 对话,可附带初始文本/模式
 *  - close(): 关闭
 *  - isOpen: 当前打开状态 ref
 *  - install(): 挂到 window.openGlobalChat / window.closeGlobalChat
 */

import { ref, nextTick, onUnmounted } from 'vue'

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

  const setFloatingChatRef = (r: FloatingChatRef | null) => {
    chatRef = r
  }

  const open = async (options?: OpenChatOptions) => {
    if (typeof window === 'undefined') return
    isOpen.value = true
    ;(window as Window & { isGlobalChatOpen?: boolean }).isGlobalChatOpen = true

    await nextTick()
    if (!chatRef) return

    if (options?.initialText && chatRef.setInitialText) {
      chatRef.setInitialText(options.initialText)
    }
    chatRef.focusInput?.()
    chatRef.openDialog?.()

    if (options?.mode) {
      const openFn = (window as Window & { openFloatingChat?: (o: any) => void }).openFloatingChat
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
    delete (window as Window & { openGlobalChat?: any }).openGlobalChat
    delete (window as Window & { closeGlobalChat?: any }).closeGlobalChat
  }

  onUnmounted(() => dispose())

  return { isOpen, open, close, setFloatingChatRef, install, dispose }
}
