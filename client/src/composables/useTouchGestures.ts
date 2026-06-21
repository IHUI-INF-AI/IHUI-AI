import { ref, onMounted } from 'vue'
import { useCleanup } from '@/composables/useCleanup'

type TouchListLike = {
  length: number
  [index: number]: { clientX: number; clientY: number }
}

interface TouchState {
  startX: number
  startY: number
  startTime: number
  lastX: number
  lastY: number
  lastTime: number
  distance: number
  direction: 'left' | 'right' | 'up' | 'down' | null
  isSwiping: boolean
  isPinching: boolean
  startDistance: number
  startScale: number
}

export const useTouchGestures = (options: {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  onSwipeUp?: () => void
  onSwipeDown?: () => void
  onPinch?: (scale: number) => void
  onTap?: (x: number, y: number) => void
  onDoubleTap?: (x: number, y: number) => void
  swipeThreshold?: number
  tapThreshold?: number
}) => {
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onPinch,
    onTap,
    onDoubleTap,
    swipeThreshold = 50,
    tapThreshold = 10
  } = options

  const touchState = ref<TouchState>({
    startX: 0,
    startY: 0,
    startTime: 0,
    lastX: 0,
    lastY: 0,
    lastTime: 0,
    distance: 0,
    direction: null,
    isSwiping: false,
    isPinching: false,
    startDistance: 0,
    startScale: 1
  })

  const lastTapTime = ref(0)
  const lastTapX = ref(0)
  const lastTapY = ref(0)

  const getTouchDistance = (touches: TouchListLike): number => {
    if (touches.length < 2) return 0
    const touch0 = touches[0]
    const touch1 = touches[1]
    if (!touch0 || !touch1) return 0
    const dx = touch0.clientX - touch1.clientX
    const dy = touch0.clientY - touch1.clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  const _getTouchCenter = (touches: TouchListLike): { x: number; y: number } => {
    if (touches.length === 0) return { x: 0, y: 0 }
    const touch0 = touches[0]
    if (!touch0) return { x: 0, y: 0 }
    if (touches.length === 1) {
      return { x: touch0.clientX, y: touch0.clientY }
    }
    const touch1 = touches[1]
    if (!touch1) return { x: touch0.clientX, y: touch0.clientY }
    return {
      x: (touch0.clientX + touch1.clientX) / 2,
      y: (touch0.clientY + touch1.clientY) / 2
    }
  }

  const handleTouchStart = (e: TouchEvent) => {
    const touches = e.touches
    
    if (touches.length === 1) {
      touchState.value = {
        ...touchState.value,
        startX: touches[0].clientX,
        startY: touches[0].clientY,
        startTime: Date.now(),
        lastX: touches[0].clientX,
        lastY: touches[0].clientY,
        lastTime: Date.now(),
        distance: 0,
        direction: null,
        isSwiping: false,
        isPinching: false
      }
    } else if (touches.length === 2 && onPinch) {
      touchState.value.isPinching = true
      touchState.value.startDistance = getTouchDistance(Array.from(touches) as unknown as TouchListLike)
      touchState.value.startScale = 1
    }
  }

  // touchmove 节流 rAF ID
  let touchMoveRafId: number | null = null

  const handleTouchMove = (e: TouchEvent) => {
    if (touchMoveRafId !== null) return
    const touches = e.touches
    // rAF 是异步的，先把需要的 clientX/clientY 存起来
    const touch0X = touches[0]?.clientX ?? 0
    const touch0Y = touches[0]?.clientY ?? 0
    const touch1X = touches[1]?.clientX ?? 0
    const touch1Y = touches[1]?.clientY ?? 0
    const touchLength = touches.length
    touchMoveRafId = requestAnimationFrame(() => {
      touchMoveRafId = null

      if (touchLength === 1 && !touchState.value.isPinching) {
        const deltaX = touch0X - touchState.value.startX
        const deltaY = touch0Y - touchState.value.startY
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

        touchState.value.distance = distance
        touchState.value.lastX = touch0X
        touchState.value.lastY = touch0Y
        touchState.value.lastTime = Date.now()

        if (distance > swipeThreshold) {
          touchState.value.isSwiping = true

          if (Math.abs(deltaX) > Math.abs(deltaY)) {
            touchState.value.direction = deltaX > 0 ? 'right' : 'left'
          } else {
            touchState.value.direction = deltaY > 0 ? 'down' : 'up'
          }
        }
      } else if (touchLength === 2 && touchState.value.isPinching && onPinch) {
        const dx = touch0X - touch1X
        const dy = touch0Y - touch1Y
        const currentDistance = Math.sqrt(dx * dx + dy * dy)
        const scale = currentDistance / touchState.value.startDistance
        touchState.value.startScale = scale
        onPinch(scale)
      }
    })
  }

  const handleTouchEnd = (_e: TouchEvent) => {
    const { isSwiping, direction, distance, startX, startY, isPinching } = touchState.value
    const duration = Date.now() - touchState.value.startTime
    
    if (isPinching) {
      touchState.value.isPinching = false
      return
    }
    
    if (isSwiping && direction) {
      switch (direction) {
        case 'left':
          onSwipeLeft?.()
          break
        case 'right':
          onSwipeRight?.()
          break
        case 'up':
          onSwipeUp?.()
          break
        case 'down':
          onSwipeDown?.()
          break
      }
    } else if (distance < tapThreshold && duration < 300) {
      const now = Date.now()
      const timeDiff = now - lastTapTime.value
      const xDiff = Math.abs(startX - lastTapX.value)
      const yDiff = Math.abs(startY - lastTapY.value)
      
      if (timeDiff < 300 && xDiff < 30 && yDiff < 30 && onDoubleTap) {
        onDoubleTap(startX, startY)
        lastTapTime.value = 0
      } else if (onTap) {
        onTap(startX, startY)
        lastTapTime.value = now
        lastTapX.value = startX
        lastTapY.value = startY
      }
    }
    
    touchState.value.isSwiping = false
    touchState.value.direction = null
    touchState.value.distance = 0
  }

  const elementRef = ref<HTMLElement | null>(null)

  const bindEvents = (el: HTMLElement) => {
    elementRef.value = el
    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchmove', handleTouchMove, { passive: true })
    el.addEventListener('touchend', handleTouchEnd, { passive: true })
  }

  const unbindEvents = () => {
    if (elementRef.value) {
      elementRef.value.removeEventListener('touchstart', handleTouchStart)
      elementRef.value.removeEventListener('touchmove', handleTouchMove)
      elementRef.value.removeEventListener('touchend', handleTouchEnd)
    }
    if (touchMoveRafId !== null) {
      cancelAnimationFrame(touchMoveRafId)
      touchMoveRafId = null
    }
  }

  return {
    touchState,
    bindEvents,
    unbindEvents,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd
  }
}

export const useMobileDetection = () => {
  const cleanup = useCleanup()
  const isMobile = ref(false)
  const isTablet = ref(false)
  const isTouchDevice = ref(false)
  const screenWidth = ref(0)
  const screenHeight = ref(0)
  const orientation = ref<'portrait' | 'landscape'>('portrait')

  let resizeRafId: number | null = null
  const updateDeviceInfo = () => {
    if (resizeRafId !== null) return
    resizeRafId = requestAnimationFrame(() => {
      resizeRafId = null
      screenWidth.value = window.innerWidth
      screenHeight.value = window.innerHeight
      orientation.value = screenWidth.value > screenHeight.value ? 'landscape' : 'portrait'

      isMobile.value = screenWidth.value < 768
      isTablet.value = screenWidth.value >= 768 && screenWidth.value < 1024
      isTouchDevice.value = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    })
  }

  onMounted(() => {
    updateDeviceInfo()
    cleanup.addEventListener(window, 'resize', updateDeviceInfo as EventListener)
    cleanup.addEventListener(window, 'orientationchange', updateDeviceInfo as EventListener)
  })

  cleanup.add(() => {
    if (resizeRafId !== null) {
      cancelAnimationFrame(resizeRafId)
      resizeRafId = null
    }
  })

  return {
    isMobile,
    isTablet,
    isTouchDevice,
    screenWidth,
    screenHeight,
    orientation
  }
}
