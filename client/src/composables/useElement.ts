import { ref, onMounted, watch, type Ref } from 'vue'
import { useCleanup } from '@/composables/useCleanup'

export interface ElementSize {
  width: Ref<number>
  height: Ref<number>
}

export function useElementSize(target: Ref<HTMLElement | null>): ElementSize {
  const cleanup = useCleanup()
  const width = ref(0)
  const height = ref(0)

  let observer: ResizeObserver | null = null

  const updateSize = () => {
    if (target.value) {
      width.value = target.value.offsetWidth
      height.value = target.value.offsetHeight
    }
  }

  const startObserving = () => {
    if (typeof ResizeObserver === 'undefined') return

    observer = new ResizeObserver(() => {
      updateSize()
    })

    if (target.value) {
      observer.observe(target.value)
    }
  }

  const stopObserving = () => {
    if (observer) {
      observer.disconnect()
      observer = null
    }
  }

  watch(target, (newTarget) => {
    stopObserving()
    if (newTarget) {
      updateSize()
      startObserving()
    }
  })

  onMounted(() => {
    updateSize()
    startObserving()
  })

  cleanup.add(() => stopObserving())

  return { width, height }
}

export interface ElementBounding {
  left: Ref<number>
  top: Ref<number>
  right: Ref<number>
  bottom: Ref<number>
  width: Ref<number>
  height: Ref<number>
  x: Ref<number>
  y: Ref<number>
}

export function useElementBounding(target: Ref<HTMLElement | null>): ElementBounding {
  const cleanup = useCleanup()
  const left = ref(0)
  const top = ref(0)
  const right = ref(0)
  const bottom = ref(0)
  const width = ref(0)
  const height = ref(0)
  const x = ref(0)
  const y = ref(0)

  const update = () => {
    if (!target.value) return

    const rect = target.value.getBoundingClientRect()
    left.value = rect.left
    top.value = rect.top
    right.value = rect.right
    bottom.value = rect.bottom
    width.value = rect.width
    height.value = rect.height
    x.value = rect.x
    y.value = rect.y
  }

  // rAF 节流：滚动时每帧最多更新一次位置
  let boundingRafId: number | null = null
  const onScrollUpdate = () => {
    if (boundingRafId !== null) return
    boundingRafId = requestAnimationFrame(() => {
      boundingRafId = null
      update()
    })
  }

  onMounted(() => {
    update()
    cleanup.addEventListener(window, 'resize', onScrollUpdate as EventListener)
    cleanup.addEventListener(window, 'scroll', onScrollUpdate as EventListener, true)
  })

  cleanup.add(() => {
    if (boundingRafId !== null) {
      cancelAnimationFrame(boundingRafId)
      boundingRafId = null
    }
  })

  return { left, top, right, bottom, width, height, x, y }
}

export function useElementVisibility(target: Ref<HTMLElement | null>): Ref<boolean> {
  const cleanup = useCleanup()
  const isVisible = ref(false)

  let observer: IntersectionObserver | null = null

  const startObserving = () => {
    if (typeof IntersectionObserver === 'undefined') return

    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          isVisible.value = entry.isIntersecting
        })
      },
      { threshold: 0.1 }
    )

    if (target.value) {
      observer.observe(target.value)
    }
  }

  const stopObserving = () => {
    if (observer) {
      observer.disconnect()
      observer = null
    }
  }

  watch(target, (newTarget) => {
    stopObserving()
    if (newTarget) {
      startObserving()
    }
  })

  onMounted(() => {
    startObserving()
  })

  cleanup.add(() => stopObserving())

  return isVisible
}
