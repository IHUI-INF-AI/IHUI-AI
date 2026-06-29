/**
 * AI平台全局插件
 * 
 * 初始化所有AI相关模块，提供全局访问能力
 * 
 * @module plugins/ai-platform
 * @version 1.0.0
 */

import type { App, Plugin } from 'vue'
import { useGlobalShortcuts } from '@/composables/useGlobalShortcuts'
import { useGenerationQueue } from '@/services/GenerationQueueService'
import { useNotificationCenter } from '@/composables/useNotificationCenter'
import { logger } from '@/utils/logger'

// ============================================================================
// 类型定义
// ============================================================================

export interface AIPlatformPluginOptions {
  /** 是否启用全局快捷键 */
  enableShortcuts?: boolean
  /** 是否启用生成队列 */
  enableQueue?: boolean
  /** 是否启用通知中心 */
  enableNotifications?: boolean
  /** 生成队列配置 */
  queueConfig?: {
    maxConcurrent?: number
    delayBetweenTasks?: number
    autoRetryOnFailure?: boolean
    maxRetries?: number
    saveProgress?: boolean
  }
  /** 快捷键配置 */
  shortcutsConfig?: {
    scope?: string
  }
}

// ============================================================================
// 默认配置
// ============================================================================

const DEFAULT_OPTIONS: AIPlatformPluginOptions = {
  enableShortcuts: true,
  enableQueue: true,
  enableNotifications: true,
  queueConfig: {
    maxConcurrent: 2,
    delayBetweenTasks: 1000,
    autoRetryOnFailure: true,
    maxRetries: 3,
    saveProgress: true,
  },
  shortcutsConfig: {
    scope: 'global',
  },
}

// ============================================================================
// 插件实现
// ============================================================================

/**
 * AI平台插件
 */
export const AIPlatformPlugin: Plugin = {
  install(app: App, ...args: unknown[]) {
    const options = args[0] as AIPlatformPluginOptions | undefined
    const config = { ...DEFAULT_OPTIONS, ...options }

    // 初始化通知中心
    if (config.enableNotifications) {
      const notification = useNotificationCenter()
      app.provide('notificationCenter', notification)
      app.config.globalProperties.$notify = notification
    }

    // 初始化生成队列
    if (config.enableQueue) {
      const queue = useGenerationQueue()
      
      // 注册默认处理器（如果需要）
      // queue.registerHandler('image', defaultImageHandler)
      // queue.registerHandler('video', defaultVideoHandler)
      
      app.provide('generationQueue', queue)
      app.config.globalProperties.$queue = queue
    }

    // 初始化全局快捷键
    if (config.enableShortcuts) {
      const shortcuts = useGlobalShortcuts()
      
      // 设置默认范围
      if (config.shortcutsConfig?.scope) {
        shortcuts.setScope(config.shortcutsConfig.scope)
      }
      
      // 注册一些默认的全局快捷键
      registerDefaultShortcuts(shortcuts)
      
      app.provide('globalShortcuts', shortcuts)
      app.config.globalProperties.$shortcuts = shortcuts
    }

    // 输出初始化信息
    if (import.meta.env.DEV) {
      logger.info('[AI Platform] Plugin initialized', {
        notifications: config.enableNotifications,
        queue: config.enableQueue,
        shortcuts: config.enableShortcuts,
      })
    }
  },
}

/**
 * 注册默认快捷键
 */
function registerDefaultShortcuts(shortcuts: ReturnType<typeof useGlobalShortcuts>) {
  const { registerShortcut } = shortcuts

  // 打开AI对话
  registerShortcut({
    id: 'global-open-chat',
    key: 'k',
    modifiers: { ctrl: true },
    description: '打开AI对话',
    category: 'general',
    scope: 'global',
    handler: () => {
      window.dispatchEvent(new CustomEvent('ai-platform:open-chat'))
    },
  })

  // 打开搜索
  registerShortcut({
    id: 'global-search',
    key: 'p',
    modifiers: { ctrl: true },
    description: '全局搜索',
    category: 'general',
    scope: 'global',
    handler: () => {
      window.dispatchEvent(new CustomEvent('ai-platform:search'))
    },
  })

  // 新建对话
  registerShortcut({
    id: 'global-new-chat',
    key: 'n',
    modifiers: { ctrl: true, shift: true },
    description: '新建对话',
    category: 'general',
    scope: 'global',
    handler: () => {
      window.dispatchEvent(new CustomEvent('ai-platform:new-chat'))
    },
  })

  // 打开快捷键帮助
  registerShortcut({
    id: 'global-shortcuts-help',
    key: '/',
    modifiers: { ctrl: true },
    description: '快捷键帮助',
    category: 'general',
    scope: 'global',
    handler: () => {
      shortcuts.toggleHelpPanel()
    },
  })

  // 打开短剧编辑器
  registerShortcut({
    id: 'global-open-drama',
    key: 'd',
    modifiers: { ctrl: true, shift: true },
    description: '打开短剧编辑器',
    category: 'drama',
    scope: 'global',
    handler: () => {
      window.dispatchEvent(new CustomEvent('ai-platform:open-drama'))
    },
  })
}

// ============================================================================
// 组合式API Hook
// ============================================================================

/**
 * 获取AI平台注入的服务
 */
export function useAIPlatform() {
  const notification = useNotificationCenter()
  const queue = useGenerationQueue()
  const shortcuts = useGlobalShortcuts()

  return {
    notification,
    queue,
    shortcuts,
    // 便捷方法
    showSuccess: notification.showSuccess,
    showError: notification.showError,
    showProgress: notification.showProgress,
    addTask: queue.addTask,
    setScope: shortcuts.setScope,
    toggleHelpPanel: shortcuts.toggleHelpPanel,
  }
}

// ============================================================================
// 导出
// ============================================================================

export default AIPlatformPlugin
