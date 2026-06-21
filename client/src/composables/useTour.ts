/**
 * 操作引导 Composable
 * 提供首次使用引导和功能提示
 */

import { ref, computed, onMounted } from 'vue'
import { StorageManager } from '@/utils/storage'

export interface TourStep {
  /** 步骤ID */
  id: string
  /** 目标元素选择器 */
  target: string
  /** 标题 */
  title: string
  /** 内容 */
  content: string
  /** 位置 */
  placement?: 'top' | 'bottom' | 'left' | 'right'
  /** 是否显示跳过按钮 */
  showSkip?: boolean
}

export interface TourOptions {
  /** 引导ID（用于区分不同的引导） */
  tourId: string
  /** 步骤列表 */
  steps: TourStep[]
  /** 是否自动开始 */
  autoStart?: boolean
  /** 存储键前缀 */
  storagePrefix?: string
}

/**
 * 操作引导 Composable
 */
export function useTour(options: TourOptions) {
  const { tourId, steps, autoStart = false, storagePrefix = 'tour_' } = options

  const currentStep = ref(0)
  const isActive = ref(false)
  const isCompleted = ref(false)

  const storageKey = `${storagePrefix}${tourId}_completed`

  // 检查是否已完成
  const checkCompleted = () => {
    const completed = StorageManager.getItem(storageKey)
    isCompleted.value = completed === 'true'
    return isCompleted.value
  }

  // 开始引导
  const start = () => {
    if (checkCompleted()) {
      return false
    }

    isActive.value = true
    currentStep.value = 0
    showStep(0)
    return true
  }

  // 下一步
  const next = () => {
    if (currentStep.value < steps.length - 1) {
      currentStep.value++
      showStep(currentStep.value)
    } else {
      complete()
    }
  }

  // 上一步
  const prev = () => {
    if (currentStep.value > 0) {
      currentStep.value--
      showStep(currentStep.value)
    }
  }

  // 跳过
  const skip = () => {
    complete()
  }

  // 完成引导
  const complete = () => {
    isActive.value = false
    isCompleted.value = true
    StorageManager.setItem(storageKey, 'true')
    hideStep()
  }

  // 重置引导
  const reset = () => {
    StorageManager.removeItem(storageKey)
    isCompleted.value = false
    currentStep.value = 0
    isActive.value = false
  }

  // 显示步骤
  const showStep = (index: number) => {
    const step = steps[index]
    if (!step) return

    const element = document.querySelector(step.target)
    if (!element) {
      return
    }

    // 滚动到目标元素
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest',
    })

    // 高亮目标元素
    highlightElement(element as HTMLElement)
  }

  // 隐藏步骤
  const hideStep = () => {
    // 移除高亮
    const highlighted = document.querySelector('.tour-highlight')
    if (highlighted) {
      highlighted.classList.remove('tour-highlight')
    }
  }

  // 高亮元素
  const highlightElement = (element: HTMLElement) => {
    // 移除之前的高亮
    hideStep()

    // 添加高亮类
    element.classList.add('tour-highlight')
  }

  // 当前步骤信息
  const currentStepInfo = computed(() => {
    return steps[currentStep.value]
  })

  // 是否在第一步
  const isFirstStep = computed(() => currentStep.value === 0)

  // 是否在最后一步
  const isLastStep = computed(() => currentStep.value === steps.length - 1)

  // 进度
  const progress = computed(() => {
    return ((currentStep.value + 1) / steps.length) * 100
  })

  // 初始化
  onMounted(() => {
    checkCompleted()
    if (autoStart && !isCompleted.value) {
      start()
    }
  })

  return {
    steps,
    currentStep,
    isActive,
    isCompleted,
    currentStepInfo,
    isFirstStep,
    isLastStep,
    progress,
    start,
    next,
    prev,
    skip,
    complete,
    reset,
  }
}
