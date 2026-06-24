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

/**
 * @param onMount 组件挂载触发回调(由 App.vue 注入,用于将 showAIChat 置 true 以渲染 AIChat 组件)
 *   首次 open() 时 AIChat 尚未挂载(v-if=false),需通过此回调触发挂载;
 *   组件挂载后若 isOpen 仍为 true,setFloatingChatRef 会自动调用 openDialog 展开对话框。
 */
export function useGlobalChat(onMount?: () => void): GlobalChat {
  const isOpen = ref(false)
  let chatRef: FloatingChatRef | null = null

  const setFloatingChatRef = (r: FloatingChatRef | null) => {
    chatRef = r
    // 组件挂载后,若处于打开状态(open() 先于挂载完成),自动展开对话框
    if (r && isOpen.value) {
      r.openDialog?.()
      r.focusInput?.()
    }
  }

  const open = async (options?: OpenChatOptions) => {
    if (typeof window === 'undefined') return
    isOpen.value = true
    // 触发外部挂载 AIChat 组件(首次打开时 v-if 由 false→true)
    onMount?.()
    ;(window as Window & { isGlobalChatOpen?: boolean }).isGlobalChatOpen = true

    await nextTick()
    if (!chatRef) return // 组件尚未挂载,挂载后由 setFloatingChatRef 自动展开

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
