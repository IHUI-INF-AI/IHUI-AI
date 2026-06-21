import { ref, onMounted, type Ref } from 'vue'
import { useCleanup } from './useCleanup'

export interface MousePosition {
  x: Ref<number>
  y: Ref<number>
  sourceType: Ref<'mouse' | 'touch'>
}

export function useMouse(): MousePosition {
  const x = ref(0)
  const y = ref(0)
  const sourceType = ref<'mouse' | 'touch'>('mouse')

  // mousemove/touchmove 节流 rAF ID（共用）
  let mouseMoveRafId: number | null = null

  const onMouseMove = (event: MouseEvent) => {
    if (mouseMoveRafId !== null) return
    // rAF 是异步的，先把 pageX/pageY 存起来
    const pageX = event.pageX
    const pageY = event.pageY
    mouseMoveRafId = requestAnimationFrame(() => {
      mouseMoveRafId = null
      x.value = pageX
      y.value = pageY
      sourceType.value = 'mouse'
    })
  }

  const onTouchMove = (event: TouchEvent) => {
    if (event.touches.length > 0) {
      if (mouseMoveRafId !== null) return
      // rAF 是异步的，先把 clientX/clientY 存起来
      const clientX = event.touches[0].clientX
      const clientY = event.touches[0].clientY
      mouseMoveRafId = requestAnimationFrame(() => {
        mouseMoveRafId = null
        x.value = clientX
        y.value = clientY
        sourceType.value = 'touch'
      })
    }
  }

  const cleanup = useCleanup()
  cleanup.add(() => { if (mouseMoveRafId !== null) { cancelAnimationFrame(mouseMoveRafId); mouseMoveRafId = null } })

  onMounted(() => {
    cleanup.addEventListener(window, 'mousemove', onMouseMove as EventListener)
    cleanup.addEventListener(window, 'touchmove', onTouchMove as EventListener)
  })

  return { x, y, sourceType }
}

export interface MouseInElement {
  x: Ref<number>
  y: Ref<number>
  isOutside: Ref<boolean>
}

export function useMouseInElement(target: Ref<HTMLElement | null>): MouseInElement {
  const x = ref(0)
  const y = ref(0)
  const isOutside = ref(true)

  // mousemove 节流 rAF ID
  let mouseMoveRafId: number | null = null

  const onMouseMove = (event: MouseEvent) => {
    if (mouseMoveRafId !== null) return
    // rAF 是异步的，先把 clientX/clientY 存起来
    const clientX = event.clientX
    const clientY = event.clientY
    mouseMoveRafId = requestAnimationFrame(() => {
      mouseMoveRafId = null
      if (!target.value) return

      const rect = target.value.getBoundingClientRect()
      x.value = clientX - rect.left
      y.value = clientY - rect.top
      isOutside.value =
        clientX < rect.left ||
        clientX > rect.right ||
        clientY < rect.top ||
        clientY > rect.bottom
    })
  }

  const cleanup = useCleanup()
  cleanup.add(() => { if (mouseMoveRafId !== null) { cancelAnimationFrame(mouseMoveRafId); mouseMoveRafId = null } })

  onMounted(() => {
    cleanup.addEventListener(window, 'mousemove', onMouseMove as EventListener)
  })

  return { x, y, isOutside }
}

export interface MousePressed {
  pressed: Ref<boolean>
  sourceType: Ref<'mouse' | 'touch'>
}

export function useMousePressed(): MousePressed {
  const pressed = ref(false)
  const sourceType = ref<'mouse' | 'touch'>('mouse')

  const onMouseDown = (_event: MouseEvent) => {
    pressed.value = true
    sourceType.value = 'mouse'
  }

  const onMouseUp = () => {
    pressed.value = false
  }

  const onTouchStart = (_event: TouchEvent) => {
    pressed.value = true
    sourceType.value = 'touch'
  }

  const onTouchEnd = () => {
    pressed.value = false
  }

  const cleanup = useCleanup()

  onMounted(() => {
    cleanup.addEventListener(window, 'mousedown', onMouseDown as EventListener)
    cleanup.addEventListener(window, 'mouseup', onMouseUp as EventListener)
    cleanup.addEventListener(window, 'touchstart', onTouchStart as EventListener)
    cleanup.addEventListener(window, 'touchend', onTouchEnd as EventListener)
  })

  return { pressed, sourceType }
}

export function useMouseHover(target: Ref<HTMLElement | null>): Ref<boolean> {
  const isHovered = ref(false)

  const onMouseEnter = () => {
    isHovered.value = true
  }

  const onMouseLeave = () => {
    isHovered.value = false
  }

  const cleanup = useCleanup()

  onMounted(() => {
    if (target.value) {
      cleanup.addEventListener(target.value, 'mouseenter', onMouseEnter)
      cleanup.addEventListener(target.value, 'mouseleave', onMouseLeave)
    }
  })

  return isHovered
}
