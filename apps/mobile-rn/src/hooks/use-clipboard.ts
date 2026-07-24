import { createUseClipboard } from '@ihui/shared/hooks/use-clipboard'
import Clipboard from '@react-native-clipboard/clipboard'

/**
 * 剪贴板 Hook(mobile-rn 平台实现)
 *
 * 注入 @react-native-clipboard/clipboard 到 @ihui/shared 工厂,
 * 返回统一的 { copy, read, lastCopied } 接口。
 */
export const useClipboard = createUseClipboard({
  writeText: (text: string): boolean => {
    try {
      if (Clipboard && Clipboard.setString) {
        Clipboard.setString(text)
        return true
      }
      return false
    } catch (err) {
      console.warn('[useClipboard] setString failed:', err)
      return false
    }
  },
  readText: async (): Promise<string> => {
    try {
      if (Clipboard && Clipboard.getString) {
        return await Clipboard.getString()
      }
      return ''
    } catch (err) {
      console.warn('[useClipboard] getString failed:', err)
      return ''
    }
  },
})
