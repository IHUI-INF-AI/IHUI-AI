import { ref, onMounted, type Ref } from 'vue'
import { useCleanup } from '@/composables/useCleanup'

export function useOnline(): Ref<boolean> {
  const isOnline = ref(true)

  if (typeof navigator === 'undefined') {
    return isOnline
  }

  isOnline.value = navigator.onLine

  const handleOnline = () => {
    isOnline.value = true
  }

  const handleOffline = () => {
    isOnline.value = false
  }

  const cleanup = useCleanup()

  onMounted(() => {
    cleanup.addEventListener(window, 'online', handleOnline)
    cleanup.addEventListener(window, 'offline', handleOffline)
  })

  return isOnline
}

export function useOffline(): Ref<boolean> {
  const _isOnline = useOnline()
  return ref(false) as unknown as Ref<boolean>
}

export interface NetworkInformation {
  effectiveType: 'slow-2g' | '2g' | '3g' | '4g'
  downlink: number
  rtt: number
  saveData: boolean
}

export function useNetwork(): {
  isOnline: Ref<boolean>
  isOffline: Ref<boolean>
  saveData: Ref<boolean>
  effectiveType: Ref<NetworkInformation['effectiveType'] | null>
  downlink: Ref<number | null>
  rtt: Ref<number | null>
} {
  const isOnline = useOnline()
  const isOffline = ref(!isOnline.value)
  const saveData = ref(false)
  const effectiveType = ref<NetworkInformation['effectiveType'] | null>(null)
  const downlink = ref<number | null>(null)
  const rtt = ref<number | null>(null)

  if (typeof navigator === 'undefined') {
    return {
      isOnline,
      isOffline,
      saveData,
      effectiveType,
      downlink,
      rtt,
    }
  }

  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection

  if (connection) {
    saveData.value = connection.saveData || false
    effectiveType.value = connection.effectiveType || null
    downlink.value = connection.downlink || null
    rtt.value = connection.rtt || null

    const handleChange = () => {
      saveData.value = connection.saveData || false
      effectiveType.value = connection.effectiveType || null
      downlink.value = connection.downlink || null
      rtt.value = connection.rtt || null
    }

    const connectionWithListener = connection as NetworkInformation & {
      addEventListener?: (type: string, listener: () => void) => void
      removeEventListener?: (type: string, listener: () => void) => void
    }

    if (connectionWithListener.addEventListener) {
      const cleanup = useCleanup()
      connectionWithListener.addEventListener('change', handleChange)
      cleanup.add(() => connectionWithListener.removeEventListener?.('change', handleChange))
    }
  }

  return {
    isOnline,
    isOffline,
    saveData,
    effectiveType,
    downlink,
    rtt,
  }
}
