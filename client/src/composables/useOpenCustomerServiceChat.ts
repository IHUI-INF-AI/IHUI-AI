import { DEFAULT_CUSTOMER_SERVICE_FAQ } from '@/data/customer-service-faq'

declare global {
  interface Window {
    openFloatingChat?: (options?: {
      theme?: 'default' | 'custom-service'
      quickFaqList?: Array<{ id: number; question: string; answer: string }>
      showTicketsEntry?: boolean
      mode?: string
      initialText?: string
    }) => void
  }
}

/** 打开悬浮窗并进入客服模式（客服功能已整合进 AI 对话，不再跳转独立页） */
export function openCustomerServiceChat(options?: { initialText?: string }) {
  if (typeof window === 'undefined') return
  window.openFloatingChat?.({
    theme: 'custom-service',
    quickFaqList: DEFAULT_CUSTOMER_SERVICE_FAQ,
    showTicketsEntry: true,
    mode: 'agent',
    initialText: options?.initialText,
  })
}
