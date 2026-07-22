import { useCallback, useState } from 'react'
import Clipboard from '@react-native-clipboard/clipboard'

export function useClipboard() {
  const [lastCopied, setLastCopied] = useState<string | null>(null)

  const copy = useCallback((text: string): boolean => {
    try {
      if (Clipboard && Clipboard.setString) {
        Clipboard.setString(text)
        setLastCopied(text)
        return true
      }
      return false
    } catch (err) {
      console.warn('[useClipboard] setString failed:', err)
      return false
    }
  }, [])

  const read = useCallback(async (): Promise<string> => {
    try {
      if (Clipboard && Clipboard.getString) {
        return await Clipboard.getString()
      }
      return ''
    } catch (err) {
      console.warn('[useClipboard] getString failed:', err)
      return ''
    }
  }, [])

  return { copy, read, lastCopied }
}
