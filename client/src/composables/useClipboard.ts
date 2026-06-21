import { ref, type Ref } from 'vue'
import { useCleanup } from '@/composables/useCleanup'

type ClipboardItemLike = {
  types: string[]
  getData: (type: string) => unknown
}

type ClipboardAPILike = {
  read: () => Promise<ClipboardItemLike[]>
  write: (data: any[]) => Promise<void>
}

export interface UseClipboardOptions {
  source?: string
  read?: boolean
}

export interface UseClipboardReturn {
  text: Ref<string>
  copied: Ref<boolean>
  isSupported: boolean
  copy: (text?: string) => Promise<void>
  read: () => Promise<string>
}

export function useClipboard(options: UseClipboardOptions = {}): UseClipboardReturn {
  const { source = '', read: enableRead = false } = options
  const cleanup = useCleanup()

  const text = ref(source) as Ref<string>
  const copied = ref(false)
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  const isSupported = typeof navigator !== 'undefined' && 'clipboard' in navigator

  const copy = async (value?: string) => {
    const textToCopy = value ?? text.value
    if (!isSupported) {
      text.value = textToCopy
      copied.value = true
      if (timeoutId) clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        copied.value = false
      }, 1500)
      return
    }

    try {
      await navigator.clipboard.writeText(textToCopy)
      text.value = textToCopy
      copied.value = true
      if (timeoutId) clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        copied.value = false
      }, 1500)
    } catch {
      text.value = textToCopy
      copied.value = true
      if (timeoutId) clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        copied.value = false
      }, 1500)
    }
  }

  const readText = async (): Promise<string> => {
    if (!isSupported || !enableRead) {
      return text.value
    }

    try {
      const result = await navigator.clipboard.readText()
      text.value = result
      return result
    } catch {
      return text.value
    }
  }

  cleanup.add(() => {
    if (timeoutId) clearTimeout(timeoutId)
  })

  return {
    text,
    copied,
    isSupported,
    copy,
    read: readText,
  }
}

export function useClipboardItems(): {
  items: Ref<unknown[]>
  isSupported: boolean
  read: () => Promise<unknown[]>
} {
  const items = ref<unknown[]>([]) as Ref<unknown[]>

  const isSupported = typeof navigator !== 'undefined' && 'clipboard' in navigator && 'read' in navigator.clipboard

  const read = async (): Promise<unknown[]> => {
    if (!isSupported) {
      throw new Error('Clipboard API is not supported')
    }

    try {
      const clipboardItems = await (navigator.clipboard as unknown as ClipboardAPILike).read()
      const allItems: any[] = []
      clipboardItems.forEach((item) => {
        item.types.forEach((type) => {
          const dataItem = item.getData(type)
          if (dataItem) {
            allItems.push(dataItem)
          }
        })
      })
      items.value = allItems
      return allItems
    } catch (error) {
      throw new Error(`Failed to read clipboard items: ${error}`)
    }
  }

  return {
    items,
    isSupported,
    read,
  }
}
