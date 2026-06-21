import { ref, watch, type Ref, unref } from 'vue'
import { logger } from '@/utils/logger'
import { useCleanup } from '@/composables/useCleanup'

export function useTitle(newTitle?: string | Ref<string>): Ref<string> {
  const title = ref(unref(newTitle) ?? document.title)

  watch(
    () => title.value,
    (newValue) => {
      if (newValue && newValue !== document.title) {
        document.title = newValue
      }
    },
    { immediate: true }
  )

  return title
}

export function useTitleTemplate(template: string | Ref<string>): {
  title: Ref<string>
  setTitle: (newTitle: string) => void
} {
  const templateRef = typeof template === 'string' ? ref(template) : template
  const title = ref('')

  const setTitle = (newTitle: string) => {
    title.value = newTitle
    document.title = templateRef.value.replace('%s', newTitle)
  }

  watch(templateRef, () => {
    if (title.value) {
      document.title = templateRef.value.replace('%s', title.value)
    }
  })

  const cleanup = useCleanup()
  cleanup.add(() => { document.title = '' })

  return { title, setTitle }
}

export function useFavicon(href?: string | Ref<string>): Ref<string> {
  const favicon = ref(unref(href) ?? getFavicon())

  function getFavicon(): string {
    const link = document.querySelector('link[rel="icon"]') as HTMLLinkElement
    return link?.href ?? '/favicon.ico'
  }

  function setFavicon(newHref: string) {
    let link = document.querySelector('link[rel="icon"]') as HTMLLinkElement

    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link)
    }

    link.href = newHref
  }

  watch(
    () => favicon.value,
    (newValue) => {
      if (newValue) {
        setFavicon(newValue)
      }
    },
    { immediate: true }
  )

  return favicon
}

export function useFullscreen(target?: Ref<HTMLElement | null>): {
  isFullscreen: Ref<boolean>
  enter: () => Promise<void>
  exit: () => Promise<void>
  toggle: () => Promise<void>
} {
  const isFullscreen = ref(false)

  const enter = async () => {
    const el = target?.value
    if (!el) return

    try {
      await el.requestFullscreen()
      isFullscreen.value = true
    } catch (error) {
      logger.error('Failed to enter fullscreen:', error)
    }
  }

  const exit = async () => {
    try {
      await document.exitFullscreen()
      isFullscreen.value = false
    } catch (error) {
      logger.error('Failed to exit fullscreen:', error)
    }
  }

  const toggle = async () => {
    if (isFullscreen.value) {
      await exit()
    } else {
      await enter()
    }
  }

  const handleFullscreenChange = () => {
    isFullscreen.value = !!document.fullscreenElement
  }

  const cleanup = useCleanup()
  cleanup.addEventListener(document, 'fullscreenchange', handleFullscreenChange)

  return { isFullscreen, enter, exit, toggle }
}
