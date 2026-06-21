import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { logger } from '@/utils/logger'

export interface UseSafeNavigationOptions {
  componentName?: string
  navigationDelay?: number
}

export function useSafeNavigation(options: UseSafeNavigationOptions = {}) {
  const { componentName = 'UnknownComponent', navigationDelay = 300 } = options
  const router = useRouter()
  const isNavigating = ref(false)

  const safeNavigate = async (path: string, event?: MouseEvent) => {
    if (isNavigating.value) {
      logger.warn(`[${componentName}] Navigation already in progress, ignoring request to ${path}`)
      return
    }

    if (event) {
      event.preventDefault()
    }

    isNavigating.value = true
    try {
      await router.push(path)
    } catch (error) {
      logger.error(`[${componentName}] Navigation error:`, error)
      throw error
    } finally {
      setTimeout(() => {
        isNavigating.value = false
      }, navigationDelay)
    }
  }

  return {
    isNavigating,
    safeNavigate,
  }
}
