import { ref, onMounted, type Ref } from 'vue'
import { useCleanup } from '@/composables/useCleanup'

export interface ScrollPosition {
  x: Ref<number>
  y: Ref<number>
  isScrolling: Ref<boolean>
  arrivedState: {
    left: Ref<boolean>
    right: Ref<boolean>
    top: Ref<boolean>
    bottom: Ref<boolean>
  }
  directions: {
    left: Ref<boolean>
    right: Ref<boolean>
    top: Ref<boolean>
    bottom: Ref<boolean>
  }
}

export function useScroll(target?: Ref<HTMLElement | null | Window>): ScrollPosition {
  const cleanup = useCleanup()
  const x = ref(0)
  const y = ref(0)
  const isScrolling = ref(false)
  const lastScrollX = ref(0)
  const lastScrollY = ref(0)

  const arrivedLeft = ref(false)
  const arrivedRight = ref(false)
  const arrivedTop = ref(false)
  const arrivedBottom = ref(false)

  const directionLeft = ref(false)
  const directionRight = ref(false)
  const directionTop = ref(false)
  const directionBottom = ref(false)

  let scrollTimeout: ReturnType<typeof setTimeout> | null = null
  let scrollRafId: number | null = null

  const update = () => {
    const element = target?.value || window
    let scrollX = 0
    let scrollY = 0
    let scrollWidth = 0
    let scrollHeight = 0
    let clientWidth = 0
    let clientHeight = 0

    if (element === window) {
      scrollX = window.scrollX
      scrollY = window.scrollY
      scrollWidth = document.documentElement.scrollWidth
      scrollHeight = document.documentElement.scrollHeight
      clientWidth = document.documentElement.clientWidth
      clientHeight = document.documentElement.clientHeight
    } else if (element && 'scrollLeft' in element) {
      scrollX = element.scrollLeft
      scrollY = element.scrollTop
      scrollWidth = element.scrollWidth
      scrollHeight = element.scrollHeight
      clientWidth = element.clientWidth
      clientHeight = element.clientHeight
    }

    x.value = scrollX
    y.value = scrollY

    arrivedLeft.value = scrollX <= 0
    arrivedTop.value = scrollY <= 0
    arrivedRight.value = scrollX + clientWidth >= scrollWidth
    arrivedBottom.value = scrollY + clientHeight >= scrollHeight

    directionLeft.value = scrollX < lastScrollX.value
    directionRight.value = scrollX > lastScrollX.value
    directionTop.value = scrollY < lastScrollY.value
    directionBottom.value = scrollY > lastScrollY.value

    lastScrollX.value = scrollX
    lastScrollY.value = scrollY

    isScrolling.value = true
    if (scrollTimeout) clearTimeout(scrollTimeout)
    scrollTimeout = setTimeout(() => {
      isScrolling.value = false
    }, 100)
  }

  // rAF 节流：滚动事件每秒触发几十次，用 rAF 限制到每帧最多执行一次
  const onScrollUpdate = () => {
    if (scrollRafId !== null) return
    scrollRafId = requestAnimationFrame(() => {
      scrollRafId = null
      update()
    })
  }

  onMounted(() => {
    const element = target?.value || window
    cleanup.addEventListener(element, 'scroll', onScrollUpdate as EventListener)
    update()
  })

  cleanup.add(() => {
    if (scrollRafId !== null) {
      cancelAnimationFrame(scrollRafId)
      scrollRafId = null
    }
    if (scrollTimeout) clearTimeout(scrollTimeout)
  })

  return {
    x,
    y,
    isScrolling,
    arrivedState: {
      left: arrivedLeft,
      right: arrivedRight,
      top: arrivedTop,
      bottom: arrivedBottom,
    },
    directions: {
      left: directionLeft,
      right: directionRight,
      top: directionTop,
      bottom: directionBottom,
    },
  }
}

export function useScrollTo(target?: Ref<HTMLElement | null | Window>) {
  const scrollTo = (options: { x?: number; y?: number; behavior?: ScrollBehavior }) => {
    const element = target?.value || window
    const { x, y, behavior = 'smooth' } = options

    if (element === window) {
      window.scrollTo({ left: x, top: y, behavior })
    } else if (element && 'scrollTo' in element) {
      element.scrollTo({ left: x, top: y, behavior })
    }
  }

  const scrollToTop = (behavior: ScrollBehavior = 'smooth') => {
    scrollTo({ y: 0, behavior })
  }

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    const element = target?.value
    if (element && 'scrollHeight' in element) {
      scrollTo({ y: element.scrollHeight, behavior })
    }
  }

  const scrollToLeft = (behavior: ScrollBehavior = 'smooth') => {
    scrollTo({ x: 0, behavior })
  }

  const scrollToRight = (behavior: ScrollBehavior = 'smooth') => {
    const element = target?.value
    if (element && 'scrollWidth' in element) {
      scrollTo({ x: element.scrollWidth, behavior })
    }
  }

  return {
    scrollTo,
    scrollToTop,
    scrollToBottom,
    scrollToLeft,
    scrollToRight,
  }
}
