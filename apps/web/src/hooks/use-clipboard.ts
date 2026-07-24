'use client'

import * as React from 'react'
import {
  createUseClipboard,
  type UseClipboardReturn as BaseUseClipboardReturn,
} from '@ihui/shared/hooks/use-clipboard'

const useBaseClipboard = createUseClipboard({
  writeText: async (text: string): Promise<boolean> => {
    if (typeof window === 'undefined') return false

    // 现代 API
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text)
        return true
      } catch {
        /* fall through to legacy */
      }
    }

    // 降级方案
    try {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(textarea)
      return ok
    } catch {
      return false
    }
  },
})

export interface UseClipboardReturn extends BaseUseClipboardReturn {
  /** 兼容别名:复制成功后 2 秒内为 true */
  copied: boolean
}

/** 剪贴板 Hook,基于 @ihui/shared 工厂实现,保留 web 端 {copied} 兼容别名 */
export function useClipboard(): UseClipboardReturn {
  const base = useBaseClipboard()
  const [copied, setCopied] = React.useState(false)
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const originalCopy = base.copy
  const copy = React.useCallback(
    async (text: string): Promise<boolean> => {
      const ok = await originalCopy(text)
      if (ok) {
        setCopied(true)
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => setCopied(false), 2000)
      }
      return ok
    },
    [originalCopy],
  )

  return { ...base, copy, copied }
}
