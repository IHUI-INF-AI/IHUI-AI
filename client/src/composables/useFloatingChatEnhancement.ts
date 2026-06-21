/**
 * AIChat 增强功能 Composable
 * 
 * 为 AIChat 组件提供以下增强：
 * - 智能上下文管理（Token压缩、自动摘要）
 * - 统一通知系统
 * - 全局快捷键支持
 * - 性能优化（虚拟滚动支持）
 * 
 * @module composables/useFloatingChatEnhancement
 * @version 1.0.0
 */

import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { t } from '@/utils/i18n'
import type { Ref } from 'vue'
import { useContextManager } from './useContextManager'
import { useNotificationCenter } from './useNotificationCenter'
import { useGlobalShortcuts } from './useGlobalShortcuts'
import type { ChatMessage } from '@/types/ai-platform.types'

// ============================================================================
// 类型定义
// ============================================================================

export interface ChatEnhancementOptions {
  /** 消息列表引用 */
  messages: Ref<ChatMessage[]>
  /** 输入框引用 */
  inputRef?: Ref<HTMLTextAreaElement | HTMLDivElement | null>
  /** 消息容器引用 */
  containerRef?: Ref<HTMLElement | null>
  /** 是否启用上下文压缩 */
  enableContextCompression?: boolean
  /** 是否启用快捷键 */
  enableShortcuts?: boolean
  /** 是否启用通知增强 */
  enableNotifications?: boolean
  /** 最大Token数 */
  maxTokens?: number
  /** 回调函数 */
  callbacks?: {
    onSend?: () => void
    onNewChat?: () => void
    onClear?: () => void
    onExport?: () => void
    onSearch?: () => void
  }
}

export interface ChatEnhancementReturn {
  // 上下文管理
  contextStats: ReturnType<typeof useContextManager>['getContextStats']
  prepareMessagesForAPI: ReturnType<typeof useContextManager>['prepareMessagesForAPI']
  estimateTokens: ReturnType<typeof useContextManager>['estimateTotalTokens']
  
  // 通知
  showChatNotification: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void
  showSendProgress: (taskId: string) => void
  updateSendProgress: (taskId: string, progress: number, status?: string) => void
  
  // 快捷键
  shortcutsEnabled: Ref<boolean>
  showHelpPanel: Ref<boolean>
  toggleShortcuts: () => void
  
  // 性能优化
  useVirtualScroll: Ref<boolean>
  toggleVirtualScroll: () => void
  
  // 工具方法
  focusInput: () => void
  scrollToBottom: (smooth?: boolean) => void
  getTokenUsageDisplay: () => string
  
  // 清理
  cleanup: () => void
}

// ============================================================================
// Composable 实现
// ============================================================================

export function useFloatingChatEnhancement(
  options: ChatEnhancementOptions
): ChatEnhancementReturn {
  const {
    messages,
    inputRef,
    containerRef,
    enableContextCompression = true,
    enableShortcuts = true,
    enableNotifications = true,
    maxTokens = 4000,
    callbacks = {},
  } = options

  // ============================================================================
  // 初始化子模块
  // ============================================================================

  // 上下文管理
  const {
    getContextStats,
    prepareMessagesForAPI,
    estimateTotalTokens,
    updateConfig: updateContextConfig,
  } = useContextManager()

  // 通知中心
  const {
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showProgress,
    updateProgress,
  } = useNotificationCenter()

  // 快捷键
  const {
    showHelpPanel,
    registerShortcut,
    setScope,
  } = useGlobalShortcuts()

  // ============================================================================
  // 状态
  // ============================================================================

  const shortcutsEnabled = ref(enableShortcuts)
  const useVirtualScroll = ref(false)
  const cleanupFunctions: (() => void)[] = []

  // ============================================================================
  // 配置上下文管理
  // ============================================================================

  if (enableContextCompression) {
    updateContextConfig({
      maxTokens,
      windowSize: 20,
      summarizeThreshold: maxTokens * 0.8,
      preserveSystemMessages: true,
    })
  }

  // ============================================================================
  // 快捷键注册
  // ============================================================================

  const setupShortcuts = () => {
    if (!enableShortcuts) return

    // 设置当前范围为聊天
    setScope('chat')

    // 发送消息 Ctrl+Enter
    const sendShortcut = registerShortcut({
      id: 'chat-send-alt',
      key: 'Enter',
      modifiers: { ctrl: true },
      description: t('text.use_floating_chat_enhancement.发送消息Ctrl'),
      category: 'chat',
      scope: 'chat',
      handler: () => {
        callbacks.onSend?.()
      },
    })
    if (sendShortcut) cleanupFunctions.push(sendShortcut)

    // 新建对话 Ctrl+N
    const newChatShortcut = registerShortcut({
      id: 'chat-new',
      key: 'n',
      modifiers: { ctrl: true },
      description: t('text.use_floating_chat_enhancement.新建对话1'),
      category: 'chat',
      scope: 'chat',
      handler: () => {
        callbacks.onNewChat?.()
      },
    })
    if (newChatShortcut) cleanupFunctions.push(newChatShortcut)

    // 清空对话 Ctrl+Shift+Delete
    const clearShortcut = registerShortcut({
      id: 'chat-clear',
      key: 'Delete',
      modifiers: { ctrl: true, shift: true },
      description: t('text.use_floating_chat_enhancement.清空对话2'),
      category: 'chat',
      scope: 'chat',
      handler: () => {
        callbacks.onClear?.()
      },
    })
    if (clearShortcut) cleanupFunctions.push(clearShortcut)

    // 导出对话 Ctrl+E
    const exportShortcut = registerShortcut({
      id: 'chat-export',
      key: 'e',
      modifiers: { ctrl: true },
      description: t('text.use_floating_chat_enhancement.导出对话3'),
      category: 'chat',
      scope: 'chat',
      handler: () => {
        callbacks.onExport?.()
      },
    })
    if (exportShortcut) cleanupFunctions.push(exportShortcut)

    // 搜索 Ctrl+F
    const searchShortcut = registerShortcut({
      id: 'chat-search',
      key: 'f',
      modifiers: { ctrl: true },
      description: t('text.use_floating_chat_enhancement.搜索消息4'),
      category: 'chat',
      scope: 'chat',
      handler: () => {
        callbacks.onSearch?.()
      },
    })
    if (searchShortcut) cleanupFunctions.push(searchShortcut)

    // 聚焦输入框 /
    const focusShortcut = registerShortcut({
      id: 'chat-focus-input',
      key: '/',
      description: t('text.use_floating_chat_enhancement.聚焦输入框5'),
      category: 'chat',
      scope: 'chat',
      handler: () => {
        focusInput()
      },
    })
    if (focusShortcut) cleanupFunctions.push(focusShortcut)

    // 滚动到底部 Ctrl+End
    const scrollShortcut = registerShortcut({
      id: 'chat-scroll-bottom',
      key: 'End',
      modifiers: { ctrl: true },
      description: t('text.use_floating_chat_enhancement.滚动到底部6'),
      category: 'chat',
      scope: 'chat',
      handler: () => {
        scrollToBottom(true)
      },
    })
    if (scrollShortcut) cleanupFunctions.push(scrollShortcut)
  }

  // ============================================================================
  // 通知方法
  // ============================================================================

  const showChatNotification = (
    type: 'success' | 'error' | 'warning' | 'info',
    message: string
  ) => {
    if (!enableNotifications) return

    const methods = {
      success: showSuccess,
      error: showError,
      warning: showWarning,
      info: showInfo,
    }
    methods[type](message)
  }

  const showSendProgress = (taskId: string) => {
    if (!enableNotifications) return

    showProgress(taskId, {
      title: t('text.use_floating_chat_enhancement.发送中7'),
      progress: 0,
      max: 100,
    })
  }

  const updateSendProgress = (taskId: string, progress: number, status?: string) => {
    if (!enableNotifications) return

    updateProgress(taskId, progress, status)
  }

  // ============================================================================
  // 工具方法
  // ============================================================================

  const focusInput = () => {
    void nextTick(() => {
      inputRef?.value?.focus()
    })
  }

  const scrollToBottom = (smooth = true) => {
    void nextTick(() => {
      if (containerRef?.value) {
        containerRef.value.scrollTo({
          top: containerRef.value.scrollHeight,
          behavior: smooth ? 'smooth' : 'auto',
        })
      }
    })
  }

  const getTokenUsageDisplay = (): string => {
    const stats = getContextStats.value
    if (stats.totalTokens === 0) return '0 tokens'
    
    const percentage = Math.round((stats.totalTokens / maxTokens) * 100)
    let status = '✓'
    if (percentage > 80) status = '⚠'
    if (percentage > 95) status = '❌'
    
    return `${status} ${stats.totalTokens.toLocaleString()} / ${maxTokens.toLocaleString()} tokens (${percentage}%)`
  }

  const toggleShortcuts = () => {
    shortcutsEnabled.value = !shortcutsEnabled.value
  }

  const toggleVirtualScroll = () => {
    useVirtualScroll.value = !useVirtualScroll.value
  }

  // ============================================================================
  // 清理
  // ============================================================================

  const cleanup = () => {
    cleanupFunctions.forEach(fn => fn())
    cleanupFunctions.length = 0
  }

  // ============================================================================
  // 生命周期
  // ============================================================================

  onMounted(() => {
    if (enableShortcuts) {
      setupShortcuts()
    }
  })

  onUnmounted(() => {
    cleanup()
  })

  // ============================================================================
  // 监听消息变化，自动决定是否启用虚拟滚动
  // ============================================================================

  watch(
    () => messages.value.length,
    (length) => {
      // 当消息超过100条时自动启用虚拟滚动
      if (length > 100 && !useVirtualScroll.value) {
        useVirtualScroll.value = true
        showInfo('已自动启用虚拟滚动以优化性能')
      }
    }
  )

  // ============================================================================
  // 返回
  // ============================================================================

  return {
    // 上下文管理
    contextStats: getContextStats,
    prepareMessagesForAPI,
    estimateTokens: estimateTotalTokens,
    
    // 通知
    showChatNotification,
    showSendProgress,
    updateSendProgress,
    
    // 快捷键
    shortcutsEnabled,
    showHelpPanel,
    toggleShortcuts,
    
    // 性能优化
    useVirtualScroll,
    toggleVirtualScroll,
    
    // 工具方法
    focusInput,
    scrollToBottom,
    getTokenUsageDisplay,
    
    // 清理
    cleanup,
  }
}

export default useFloatingChatEnhancement
