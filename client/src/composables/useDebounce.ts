import { ref, watch, type Ref, type ComputedRef } from 'vue'
import { useCleanup } from '@/composables/useCleanup'

export interface DebounceOptions {
  immediate?: boolean
}

export function useDebounce<T extends (...args: any[]) => unknown>(
  fn: T,
  delay: number,
  options: DebounceOptions = {}
): { run: (...args: Parameters<T>) => void; cancel: () => void; flush: () => void } {
  const { immediate = false } = options
  const cleanup = useCleanup()
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let lastArgs: Parameters<T> | null = null

  const run = (...args: Parameters<T>) => {
    lastArgs = args
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    if (immediate && !timeoutId) {
      fn(...args)
    }
    timeoutId = setTimeout(() => {
      if (!immediate && lastArgs) {
        fn(...lastArgs)
      }
      timeoutId = null
    }, delay)
  }

  const cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
    lastArgs = null
  }

  const flush = () => {
    if (timeoutId && lastArgs) {
      fn(...lastArgs)
      cancel()
    }
  }

  cleanup.add(() => cancel())

  return { run, cancel, flush }
}

export interface ThrottleOptions {
  leading?: boolean
  trailing?: boolean
}

export function useThrottle<T extends (...args: any[]) => unknown>(
  fn: T,
  delay: number,
  options: ThrottleOptions = {}
): { run: (...args: Parameters<T>) => void; cancel: () => void; flush: () => void } {
  const { leading = true, trailing = false } = options
  const cleanup = useCleanup()
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let lastArgs: Parameters<T> | null = null
  let lastCallTime = 0

  const run = (...args: Parameters<T>) => {
    const now = Date.now()
    lastArgs = args

    if (now - lastCallTime >= delay) {
      if (leading) {
        fn(...args)
        lastCallTime = now
      }
    }

    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    timeoutId = setTimeout(() => {
      if (trailing && lastArgs) {
        fn(...lastArgs)
        lastCallTime = Date.now()
      }
      timeoutId = null
    }, delay)
  }

  const cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
    lastArgs = null
  }

  const flush = () => {
    if (timeoutId && lastArgs) {
      fn(...lastArgs)
      cancel()
    }
  }

  cleanup.add(() => cancel())

  return { run, cancel, flush }
}

export function useDebouncedRef<T>(value: T, delay: number): Ref<T> {
  const cleanup = useCleanup()
  const debouncedValue = ref(value) as Ref<T>
  const timer = ref<ReturnType<typeof setTimeout> | null>(null)

  watch(
    () => value,
    (newValue) => {
      if (timer.value) {
        clearTimeout(timer.value)
      }
      timer.value = setTimeout(() => {
        debouncedValue.value = newValue
      }, delay)
    },
    { immediate: true }
  )

  cleanup.add(() => {
    if (timer.value) {
      clearTimeout(timer.value)
    }
  })

  return debouncedValue
}

export function useThrottledRef<T>(value: T, delay: number): Ref<T> {
  const cleanup = useCleanup()
  const throttledValue = ref(value) as Ref<T>
  const lastCallTime = ref(0)
  const timer = ref<ReturnType<typeof setTimeout> | null>(null)

  watch(
    () => value,
    (newValue) => {
      const now = Date.now()
      if (now - lastCallTime.value >= delay) {
        throttledValue.value = newValue
        lastCallTime.value = now
      } else {
        if (timer.value) {
          clearTimeout(timer.value)
        }
        timer.value = setTimeout(() => {
          throttledValue.value = newValue
          lastCallTime.value = Date.now()
        }, delay - (now - lastCallTime.value))
      }
    },
    { immediate: true }
  )

  cleanup.add(() => {
    if (timer.value) {
      clearTimeout(timer.value)
    }
  })

  return throttledValue
}

export function useDebouncedWatch<T>(
  source: Ref<T> | ComputedRef<T> | (() => T),
  callback: (value: T, oldValue: T) => void,
  delay: number
): void {
  const cleanup = useCleanup()
  let timeoutId: ReturnType<typeof setTimeout> | null = null


  watch(source as any, (value, oldValue) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    timeoutId = setTimeout(() => {
      callback(value as T, oldValue as T)
    }, delay)
  })

  cleanup.add(() => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  })
}
