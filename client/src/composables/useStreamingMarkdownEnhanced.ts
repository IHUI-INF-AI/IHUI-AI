/**
 * 增强的流式 Markdown 处理 Composable
 * 提供完整的流式输出功能：自动滚动、错误处理、进度指示、断线重连等
 */

import { ref, computed, watch, nextTick } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { logger } from '@/utils/logger'
import { useSmartScroll, debounceScroll } from '@/utils/streaming'

export interface StreamingMarkdownEnhancedOptions {
  /** 是否自动滚动到底部 */
  autoScroll?: boolean
  /** 滚动容器引用 */
  scrollContainer?: HTMLElement | null
  /** 滚动阈值（距离底部多少像素时触发滚动） */
  scrollThreshold?: number
  /** 是否启用智能滚动（只在用户未手动滚动时自动滚动） */
  smartScroll?: boolean
  /** 滚动防抖延迟（毫秒） */
  scrollDebounceDelay?: number
  /** 是否显示进度指示 */
  showProgress?: boolean
  /** 是否启用断线重连 */
  enableReconnect?: boolean
  /** 重连最大次数 */
  maxReconnectAttempts?: number
  /** 重连延迟（毫秒） */
  reconnectDelay?: number
}

/**
 * 增强的流式 Markdown Composable
 */
export function useStreamingMarkdownEnhanced(options: StreamingMarkdownEnhancedOptions = {}) {
  const {
    autoScroll = true,
    scrollContainer = null,
    scrollThreshold = 100,
    smartScroll = true,
    scrollDebounceDelay = 100,
    showProgress = true,
    enableReconnect = false,
    maxReconnectAttempts = 3,
    reconnectDelay = 1000,
  } = options

  const content = ref('')
  const isStreaming = ref(false)
  const isPaused = ref(false)
  const error = ref<Error | null>(null)
  const progress = ref(0) // 0-100
  const reconnectAttempts = ref(0)
  const isReconnecting = ref(false)

  let smartScrollInstance: ReturnType<typeof useSmartScroll> | null = null
  let debouncedScrollFn: (() => void) | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let scrollRafId: number | null = null

  const cleanup = useCleanup()
  cleanup.add(() => {
    if (reconnectTimer) clearTimeout(reconnectTimer)
    if (scrollRafId !== null) {
      cancelAnimationFrame(scrollRafId)
      scrollRafId = null
    }
    smartScrollInstance = null
    debouncedScrollFn = null
  })

  // 初始化智能滚动
  const initSmartScroll = () => {
    if (scrollContainer && smartScroll) {
      smartScrollInstance = useSmartScroll(scrollContainer, scrollThreshold)
      debouncedScrollFn = debounceScroll(() => {
        if (smartScrollInstance?.shouldAutoScroll()) {
          scrollToBottom()
        }
      }, scrollDebounceDelay)
    }
  }

  // 初始化
  if (scrollContainer) {
    void nextTick(() => {
      initSmartScroll()
    })
  }

  // 监听容器变化
  watch(
    () => scrollContainer,
    newContainer => {
      if (newContainer) {
        void nextTick(() => {
          initSmartScroll()
        })
      } else {
        smartScrollInstance = null
        debouncedScrollFn = null
      }
    }
  )

  /**
   * 追加内容
   */
  const appendContent = (chunk: string) => {
    if (!chunk || isPaused.value) return

    content.value += chunk
    isStreaming.value = true
    error.value = null

    // 更新进度（基于内容长度估算）
    if (showProgress) {
      // 简单的进度估算，实际应该由调用方提供
      progress.value = Math.min(95, (content.value.length / 1000) * 100)
    }

    // 自动滚动
    if (autoScroll && scrollContainer) {
      if (smartScroll && debouncedScrollFn) {
        debouncedScrollFn()
      } else {
        if (scrollRafId !== null) cancelAnimationFrame(scrollRafId)
        scrollRafId = requestAnimationFrame(() => {
          scrollRafId = null
          scrollToBottom()
        })
      }
    }
  }

  /**
   * 设置完整内容
   */
  const setContent = (newContent: string) => {
    content.value = newContent
    isStreaming.value = false
    isPaused.value = false
    error.value = null
    progress.value = 100
  }

  /**
   * 重置内容
   */
  const reset = () => {
    content.value = ''
    isStreaming.value = false
    isPaused.value = false
    error.value = null
    progress.value = 0
    reconnectAttempts.value = 0
    isReconnecting.value = false

    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
  }

  /**
   * 完成流式输入
   */
  const finish = () => {
    isStreaming.value = false
    isPaused.value = false
    progress.value = 100
    reconnectAttempts.value = 0
    isReconnecting.value = false

    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }

    if (autoScroll && scrollContainer) {
      void nextTick(() => {
        scrollToBottom()
      })
    }
  }

  /**
   * 暂停流式输入
   */
  const pause = () => {
    isPaused.value = true
  }

  /**
   * 恢复流式输入
   */
  const resume = () => {
    isPaused.value = false
  }

  /**
   * 设置错误
   */
  const setError = (err: Error) => {
    error.value = err
    isStreaming.value = false
    isPaused.value = false
    logger.error('Streaming Markdown error:', err)
  }

  /**
   * 清除错误
   */
  const clearError = () => {
    error.value = null
  }

  /**
   * 滚动到底部
   */
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (!scrollContainer) return

    if (smartScrollInstance) {
      smartScrollInstance.scrollToBottom()
    } else {
      scrollContainer.scrollTo({
        top: scrollContainer.scrollHeight,
        behavior,
      })
    }
  }

  /**
   * 滚动到顶部
   */
  const scrollToTop = (behavior: ScrollBehavior = 'smooth') => {
    if (!scrollContainer) return
    scrollContainer.scrollTo({
      top: 0,
      behavior,
    })
  }

  /**
   * 检查是否在底部
   */
  const isAtBottom = computed(() => {
    if (!scrollContainer || !smartScrollInstance) return true
    return smartScrollInstance.shouldAutoScroll()
  })

  /**
   * 获取内容长度
   */
  const contentLength = computed(() => content.value.length)

  /**
   * 获取内容行数
   */
  const contentLines = computed(() => content.value.split('\n').length)

  /**
   * 断线重连（需要外部提供重连函数）
   */
  const attemptReconnect = async (reconnectFn: () => Promise<void>): Promise<boolean> => {
    if (!enableReconnect || reconnectAttempts.value >= maxReconnectAttempts) {
      setError(new Error('重连次数已达上限'))
      return false
    }

    isReconnecting.value = true
    reconnectAttempts.value++

    return new Promise<boolean>(resolve => {
      reconnectTimer = setTimeout(async () => {
        try {
          await reconnectFn()
          reconnectAttempts.value = 0
          isReconnecting.value = false
          resolve(true)
        } catch (error) {
          logger.error(`Reconnection failed (attempt ${reconnectAttempts.value}):`, error)
          if (reconnectAttempts.value < maxReconnectAttempts) {
            // 继续重连
            const result = await attemptReconnect(reconnectFn)
            resolve(result)
          } else {
            setError(new Error('重连失败，已达到最大重试次数'))
            isReconnecting.value = false
            resolve(false)
          }
        }
      }, reconnectDelay)
    })
  }

  return {
    // 状态
    content,
    isStreaming,
    isPaused,
    error,
    progress,
    reconnectAttempts,
    isReconnecting,

    // 方法
    appendContent,
    setContent,
    reset,
    finish,
    pause,
    resume,
    setError,
    clearError,
    scrollToBottom,
    scrollToTop,
    attemptReconnect,

    // 计算属性
    isAtBottom,
    contentLength,
    contentLines,
  }
}
