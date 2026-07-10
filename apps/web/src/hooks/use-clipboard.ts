'use client'

import * as React from 'react'

export interface UseClipboardReturn {
  copied: boolean
  copy: (text: string) => Promise<boolean>
}

/** 剪贴板 Hook，含 execCommand 降级方案 */
export function useClipboard(): UseClipboardReturn {
  const [copied, setCopied] = React.useState(false)

  const copy = React.useCallback(async (text: string): Promise<boolean> => {
    if (typeof window === 'undefined') return false

    // 现代 API
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
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
      if (ok) {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
      return ok
    } catch {
      return false
    }
  }, [])

  return { copied, copy }
}
