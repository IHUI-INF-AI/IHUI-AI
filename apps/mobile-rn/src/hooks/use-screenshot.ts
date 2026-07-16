import { useCallback, useState } from 'react'
import type { View } from 'react-native'
import { captureRef } from 'react-native-view-shot'
import type ViewShot from 'react-native-view-shot'

export function useScreenshot() {
  const [lastUri, setLastUri] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const capture = useCallback(async (ref: React.RefObject<View | ViewShot>) => {
    if (!ref.current) return null
    setBusy(true)
    try {
      const uri = await captureRef(ref as unknown as React.RefObject<View>, {
        format: 'png',
        quality: 0.9,
      })
      setLastUri(uri)
      return uri
    } finally {
      setBusy(false)
    }
  }, [])

  return { lastUri, busy, capture }
}
