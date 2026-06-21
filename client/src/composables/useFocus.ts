import { ref, onMounted, watch, type Ref } from 'vue'
import { useCleanup } from '@/composables/useCleanup'

export interface UseFocusOptions {
  initialValue?: boolean
}

export function useFocus(target: Ref<HTMLElement | null>, options: UseFocusOptions = {}): {
  focused: Ref<boolean>
  focus: () => void
  blur: () => void
} {
  const { initialValue = false } = options
  const focused = ref(initialValue)

  const onFocus = () => {
    focused.value = true
  }

  const onBlur = () => {
    focused.value = false
  }

  const focus = () => {
    target.value?.focus()
  }

  const blur = () => {
    target.value?.blur()
  }

  const bindEvents = () => {
    if (target.value) {
      target.value.addEventListener('focus', onFocus)
      target.value.addEventListener('blur', onBlur)
    }
  }

  const unbindEvents = () => {
    if (target.value) {
      target.value.removeEventListener('focus', onFocus)
      target.value.removeEventListener('blur', onBlur)
    }
  }

  const cleanup = useCleanup()

  watch(() => target.value, (newTarget: HTMLElement | null, oldTarget: HTMLElement | null) => {
    if (oldTarget) {
      oldTarget.removeEventListener('focus', onFocus)
      oldTarget.removeEventListener('blur', onBlur)
    }
    if (newTarget) {
      newTarget.addEventListener('focus', onFocus)
      newTarget.addEventListener('blur', onBlur)
    }
  }, { flush: 'post' })

  onMounted(() => {
    bindEvents()
  })

  cleanup.add(() => unbindEvents())

  return { focused, focus, blur }
}

export function useActiveElement(): Ref<HTMLElement | null> {
  const activeElement = ref<HTMLElement | null>(null)

  const update = () => {
    activeElement.value = document.activeElement as HTMLElement | null
  }

  const cleanup = useCleanup()

  onMounted(() => {
    update()
    cleanup.addEventListener(document, 'focusin', update)
    cleanup.addEventListener(document, 'focusout', update)
  })

  return activeElement
}

export function useFocusTrap(container: Ref<HTMLElement | null>): {
  activate: () => void
  deactivate: () => void
} {
  let isActive = false

  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ')

  const getFocusableElements = (): HTMLElement[] => {
    if (!container.value) return []
    return Array.from(container.value.querySelectorAll(focusableSelectors)) as HTMLElement[]
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!isActive || event.key !== 'Tab') return

    const focusable = getFocusableElements()
    if (focusable.length === 0) return

    const firstElement = focusable[0]
    const lastElement = focusable[focusable.length - 1]

    if (event.shiftKey) {
      if (document.activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      }
    } else {
      if (document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }
  }

  const activate = () => {
    isActive = true
    document.addEventListener('keydown', handleKeyDown)
    const focusable = getFocusableElements()
    if (focusable.length > 0) {
      focusable[0].focus()
    }
  }

  const deactivate = () => {
    isActive = false
    document.removeEventListener('keydown', handleKeyDown)
  }

  const cleanup = useCleanup()
  cleanup.add(() => deactivate())

  return { activate, deactivate }
}
