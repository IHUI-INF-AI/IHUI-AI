import { ref, type Ref, type ComputedRef, computed } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { logger } from '@/utils/logger'

type StorageLike = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
  clear(): void
  readonly length: number
  key(index: number): string | null
}

export type Serializer<T> = {
  read: (raw: string) => T
  write: (value: T) => string
}

export const defaultSerializer: Serializer<unknown> = {
  read: (raw: string) => {
    try {
      return JSON.parse(raw)
    } catch {
      return raw
    }
  },
  write: (value: any) => JSON.stringify(value),
}

export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
  serializer: Serializer<T> = defaultSerializer as Serializer<T>
): ComputedRef<T> {
  const cleanup = useCleanup()
  const storedValue = localStorage.getItem(key)
  const initialValue = storedValue !== null ? serializer.read(storedValue) as T : defaultValue

  const data = ref<T>(initialValue) as Ref<T>

  const computedData = computed<T>({
    get: () => data.value,
    set: (value: T) => {
      data.value = value
      try {
        localStorage.setItem(key, serializer.write(value))
      } catch (e) {
        logger.error(`Failed to save to localStorage: ${key}`, e)
      }
    },
  })

  const handleStorageChange = (event: StorageEvent) => {
    if (event.key === key && event.newValue !== null) {
      data.value = serializer.read(event.newValue) as T
    }
  }

  cleanup.addEventListener(window, 'storage', handleStorageChange as EventListener)

  return computedData
}

export function useSessionStorage<T>(
  key: string,
  defaultValue: T,
  serializer: Serializer<T> = defaultSerializer as Serializer<T>
): ComputedRef<T> {
  const cleanup = useCleanup()
  const storedValue = sessionStorage.getItem(key)
  const initialValue = storedValue !== null ? serializer.read(storedValue) as T : defaultValue

  const data = ref<T>(initialValue) as Ref<T>

  const computedData = computed<T>({
    get: () => data.value,
    set: (value: T) => {
      data.value = value
      try {
        sessionStorage.setItem(key, serializer.write(value))
      } catch (e) {
        logger.error(`Failed to save to sessionStorage: ${key}`, e)
      }
    },
  })

  const handleStorageChange = (event: StorageEvent) => {
    if (event.key === key && event.newValue !== null) {
      data.value = serializer.read(event.newValue) as T
    }
  }

  cleanup.addEventListener(window, 'storage', handleStorageChange as EventListener)

  return computedData
}

export interface StorageOptions {
  watchDebounce?: number
}

export function useStorage<T>(
  storage: StorageLike,
  key: string,
  defaultValue: T,
  serializer: Serializer<T> = defaultSerializer as Serializer<T>,
  options: StorageOptions = {}
): ComputedRef<T> {
  const cleanup = useCleanup()
  const { watchDebounce = 0 } = options

  const storedValue = storage.getItem(key)
  const initialValue = storedValue !== null ? serializer.read(storedValue) as T : defaultValue

  const data = ref<T>(initialValue) as Ref<T>
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  const saveToStorage = (value: T) => {
    try {
      storage.setItem(key, serializer.write(value))
    } catch (e) {
      logger.error(`Failed to save to storage: ${key}`, e)
    }
  }

  const computedData = computed<T>({
    get: () => data.value,
    set: (value: T) => {
      data.value = value
      if (watchDebounce > 0) {
        if (timeoutId) clearTimeout(timeoutId)
        timeoutId = setTimeout(() => saveToStorage(value), watchDebounce)
      } else {
        saveToStorage(value)
      }
    },
  })

  cleanup.add(() => {
    if (timeoutId) clearTimeout(timeoutId)
  })

  return computedData
}

export function removeStorageItem(key: string, storage: StorageLike = localStorage): void {
  storage.removeItem(key)
}

export function clearStorage(storage: StorageLike = localStorage): void {
  storage.clear()
}

export function getStorageKeys(storage: StorageLike = localStorage): string[] {
  const keys: string[] = []
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)
    if (key) keys.push(key)
  }
  return keys
}
