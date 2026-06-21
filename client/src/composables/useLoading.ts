import { useLoadingStore } from '@/stores/loading'
import { onUnmounted } from 'vue'

/**
 * 加载状态管理Composable
 * 提供便捷的加载状态管理方法
 */
export function useLoading(key?: string) {
  const loadingStore = useLoadingStore()

  // 如果有key，使用局部加载；否则使用全局加载
  const start = (text?: string) => {
    if (key) {
      loadingStore.startLocalLoading(key, text)
    } else {
      loadingStore.startGlobalLoading(text)
    }
  }

  const stop = () => {
    if (key) {
      loadingStore.stopLocalLoading(key)
    } else {
      loadingStore.stopGlobalLoading()
    }
  }

  const isLoading = () => {
    if (key) {
      return loadingStore.isLocalLoading(key)
    }
    return loadingStore.globalLoading
  }

  const getText = () => {
    if (key) {
      return loadingStore.getLocalLoadingText(key)
    }
    return loadingStore.globalLoadingText
  }

  // 自动清理：组件卸载时停止加载
  if (key) {
    onUnmounted(() => {
      stop()
    })
  }

  // 包装异步函数，自动管理加载状态
  const withLoading = async <T>(asyncFn: () => Promise<T>, text?: string): Promise<T> => {
    try {
      start(text)
      return await asyncFn()
    } finally {
      stop()
    }
  }

  return {
    start,
    stop,
    isLoading,
    getText,
    withLoading,
  }
}
