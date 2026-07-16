import { useCallback, useState } from 'react'
import Clipboard from '@react-native-clipboard/clipboard'

export function useClipboard() {
  const [lastCopied, setLastCopied] = useState<string | null>(null)

  const copy = useCallback((text: string) => {
    Clipboard.setString(text)
    setLastCopied(text)
  }, [])

  const read = useCallback(async (): Promise<string> => {
    return Clipboard.getString()
  }, [])

  return { copy, read, lastCopied }
}
