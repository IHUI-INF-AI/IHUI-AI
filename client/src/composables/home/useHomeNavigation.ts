/**
 * Home 路由导航 Composable
 *
 * 负责管理功能模块的路由跳转
 *
 * @packageDocumentation
 */

import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { logger } from '@/utils/logger'

/**
 * useHomeNavigation 配置选项
 */
export interface UseHomeNavigationOptions {
  /** 导航防抖延迟（毫秒），默认为 300 */
  navigationDelay?: number
}

/**
 * Home 路由导航 Composable
 *
 * @param options - 配置选项
 * @returns 返回导航状态和方法
 */
export function useHomeNavigation(options: UseHomeNavigationOptions = {}) {
  const { navigationDelay = 300 } = options

  const router = useRouter()
  const isNavigating = ref(false)

  const safeNavigate = async (path: string, event?: MouseEvent) => {
    if (isNavigating.value) {
      return
    }

    if (event) {
      event.preventDefault()
    }

    isNavigating.value = true
    try {
      await router.push(path)
    } catch (error) {
      logger.error('[useHomeNavigation] Navigation error:', error)
    } finally {
      setTimeout(() => {
        isNavigating.value = false
      }, navigationDelay)
    }
  }

  /**
   * 跳转到需求页面
   */
  const goToXuqiu = (event?: MouseEvent) => {
    void safeNavigate('/xuqiu', event)
  }

  /**
   * 跳转到学习页面
   */
  const goToLearnAI = (event?: MouseEvent) => {
    void safeNavigate('/learn-ai', event)
  }

  /**
   * 打开 AI 对话的生成模式
   */
  const goToAIGenerationStudio = (_event?: MouseEvent) => {
    window.dispatchEvent(new CustomEvent('open-ai-chat', { detail: { mode: 'generation' } }))
  }

  /**
   * 打开 AI 悬浮窗
   */
  const goToLLMChatCenter = (_event?: MouseEvent) => {
    ;(window as unknown as { openFloatingChat?: () => void }).openFloatingChat?.()
  }

  /**
   * 跳转到文档中心
   */
  const goToDocCenter = (event?: MouseEvent) => {
    void safeNavigate('/support/document-center', event)
  }

  return {
    isNavigating,
    safeNavigate,
    goToXuqiu,
    goToLearnAI,
    goToDocCenter,
    goToAIGenerationStudio,
    goToLLMChatCenter,
  }
}
