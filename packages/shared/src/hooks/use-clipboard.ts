import * as React from 'react'

/**
 * 平台剪贴板实现接口
 *
 * 各端注入自己的实现:
 * - web: navigator.clipboard + execCommand 降级
 * - mobile-rn: @react-native-clipboard/clipboard
 * - miniapp-taro: Taro.setClipboardData(暂未接入)
 */
export interface ClipboardImpl {
  /** 写入剪贴板,返回是否成功 */
  writeText: (text: string) => Promise<boolean> | boolean
  /** 读取剪贴板(可选,平台不支持时省略) */
  readText?: () => Promise<string> | string
}

export interface UseClipboardReturn {
  /** 复制文本,返回是否成功 */
  copy: (text: string) => Promise<boolean>
  /** 读取剪贴板文本 */
  read: () => Promise<string>
  /** 最近一次复制(或读取)的文本 */
  lastCopied: string | null
}

/**
 * 工厂函数:各端注入平台实现,返回统一的 useClipboard hook
 *
 * 用法:
 * ```ts
 * // web
 * export const useClipboard = createUseClipboard({
 *   writeText: async (text) => { await navigator.clipboard.writeText(text); return true },
 * })
 * // mobile-rn
 * export const useClipboard = createUseClipboard({
 *   writeText: (text) => { Clipboard.setString(text); return true },
 *   readText: async () => await Clipboard.getString(),
 * })
 * ```
 */
export function createUseClipboard(impl: ClipboardImpl) {
  return function useClipboard(): UseClipboardReturn {
    const [lastCopied, setLastCopied] = React.useState<string | null>(null)

    const copy = React.useCallback(async (text: string): Promise<boolean> => {
      try {
        const ok = await impl.writeText(text)
        if (ok) setLastCopied(text)
        return ok
      } catch {
        return false
      }
    }, [])

    const read = React.useCallback(async (): Promise<string> => {
      try {
        if (!impl.readText) return ''
        const text = await impl.readText()
        setLastCopied(text)
        return text
      } catch {
        return ''
      }
    }, [])

    return { copy, read, lastCopied }
  }
}
