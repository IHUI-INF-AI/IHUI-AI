/**
 * 全局通知 Composable
 * 抽离自 App.vue 的 showGlobalNotification + window 挂载
 *
 * 暴露:
 *  - notification: 当前 ref<ErrorInfo | null>
 *  - show(message, type): 显示一条全局通知
 *  - install(): 将 show 方法挂到 window.showGlobalNotification
 *  - dispose(): 清理定时器
 */

import { ref, onUnmounted } from 'vue'
import type { ErrorInfo } from '@/components/ErrorNotification.vue'

const DEFAULT_DURATIONS: Record<'error' | 'warning' | 'info', number> = {
  error: 5000,
  warning: 3000,
  info: 2000,
}

export interface GlobalNotification {
  notification: import('vue').Ref<ErrorInfo | null>
  show: (message: string, type?: 'error' | 'warning' | 'info') => void
  install: () => void
  dispose: () => void
}

export function useGlobalNotification(): GlobalNotification {
  const notification = ref<ErrorInfo | null>(null)
  const timers = new Set<ReturnType<typeof setTimeout>>()

  const show = (message: string, type: 'error' | 'warning' | 'info' = 'error') => {
    notification.value = { message, type }
    const timeout = DEFAULT_DURATIONS[type]
    const timer = setTimeout(() => {
      timers.delete(timer)
      // 同一消息才清,避免被新通知覆盖
      if (notification.value?.message === message) {
        notification.value = null
      }
    }, timeout)
    timers.add(timer)
  }

  const install = () => {
    if (typeof window === 'undefined') return
    ;(window as Window & { showGlobalNotification?: typeof show }).showGlobalNotification = show
  }

  const dispose = () => {
    timers.forEach(t => clearTimeout(t))
    timers.clear()
  }

  onUnmounted(() => dispose())

  return { notification, show, install, dispose }
}
