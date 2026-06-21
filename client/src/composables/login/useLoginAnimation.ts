/**
 * Login 欢迎文字动画管理 Composable
 *
 * 负责登录页面欢迎文字的动画效果
 *
 * @packageDocumentation
 */

import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCleanup } from '@/composables/useCleanup'

/**
 * useLoginAnimation 配置选项
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface UseLoginAnimationOptions {
  // 注意：isMobile 参数已移除，因为未使用
}

/**
 * Login 欢迎文字动画管理 Composable
 *
 * @param options - 配置选项（目前未使用，保留以保持 API 兼容性）
 * @returns 返回动画状态和方法
 */
export function useLoginAnimation(_options: UseLoginAnimationOptions = {}) {
  const { t } = useI18n()
  const cleanup = useCleanup()

  // 欢迎标题引用
  const welcomeTitleRef = ref<HTMLElement | null>(null)

  // 欢迎标题文本
  const welcomeTitle = computed(() => t('login.welcomeTitle'))

  // 动画定时器
  let animationTimer: ReturnType<typeof setInterval> | null = null
  let welcomeRafId: number | null = null

  /**
   * 处理欢迎文字鼠标悬停
   * 优化：使用 CSS 类而不是直接操作 DOM，提升性能
   */
  const handleWelcomeMouseOver = (): void => {
    if (!welcomeTitleRef.value) return

    const element = welcomeTitleRef.value
    // 检查是否在移动端（通过媒体查询）
    if (window.matchMedia('(max-width: 992px)').matches) return

    const text = element.textContent || ''
    const chars = text.split('')

    // 清空现有内容
    element.textContent = ''

    // 使用 DocumentFragment 批量创建元素，减少重排
    const fragment = document.createDocumentFragment()
    chars.forEach((char, index) => {
      const span = document.createElement('span')
      span.textContent = char
      span.className = 'welcome-char'
      span.style.setProperty('animation', `fadeInUp 0.3s ease ${index * 0.05}s forwards`)
      span.style.setProperty('opacity', '0')
      span.style.setProperty('transform', 'translateY(20px)')
      fragment.appendChild(span)
    })

    element.appendChild(fragment)

    // 使用 requestAnimationFrame 触发动画
    if (typeof window !== 'undefined' && window.requestAnimationFrame) {
      if (welcomeRafId !== null) cancelAnimationFrame(welcomeRafId)
      welcomeRafId = window.requestAnimationFrame(() => {
        welcomeRafId = null
        const spans = element.querySelectorAll('.welcome-char')
        Array.from(spans).forEach((span: Element) => {
          const htmlElement = span as HTMLElement
          if (htmlElement && htmlElement.style) {
            htmlElement.style.setProperty('opacity', '1')
            htmlElement.style.setProperty('transform', 'translateY(0)')
          }
        })
      })
    }
  }

  /**
   * 处理欢迎文字鼠标离开
   * 优化：使用 CSS 类而不是直接操作 DOM，提升性能
   */
  const handleWelcomeMouseLeave = (): void => {
    if (!welcomeTitleRef.value) return

    const element = welcomeTitleRef.value
    // 检查是否在移动端（通过媒体查询）
    if (window.matchMedia('(max-width: 992px)').matches) return

    if (animationTimer) {
      clearInterval(animationTimer)
      animationTimer = null
    }

    const spans = element.querySelectorAll('.welcome-char')
    Array.from(spans).forEach((span: Element, index: number) => {
      const htmlElement = span as HTMLElement
      if (htmlElement && htmlElement.style) {
        htmlElement.style.setProperty(
          'animation',
          `fadeOutDown 0.3s ease ${index * 0.02}s forwards`
        )
      }
    })

    // 恢复原始文本
    setTimeout(() => {
      if (element) {
        element.textContent = welcomeTitle.value
        // 清理所有子元素
        while (element.firstChild) {
          element.removeChild(element.firstChild)
        }
        const textNode = document.createTextNode(welcomeTitle.value)
        element.appendChild(textNode)
      }
    }, 300)
  }

  onMounted(() => {
    // 初始化欢迎标题
    if (welcomeTitleRef.value) {
      welcomeTitleRef.value.textContent = welcomeTitle.value
    }
  })

  cleanup.add(() => {
    if (animationTimer) {
      clearInterval(animationTimer)
      animationTimer = null
    }
    if (welcomeRafId !== null) {
      cancelAnimationFrame(welcomeRafId)
      welcomeRafId = null
    }
  })

  return {
    // 状态
    welcomeTitleRef,
    welcomeTitle,

    // 方法
    handleWelcomeMouseOver,
    handleWelcomeMouseLeave,
  }
}
