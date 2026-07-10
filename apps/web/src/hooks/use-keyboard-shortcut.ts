'use client'

import * as React from 'react'

/**
 * 键盘快捷键 Hook。
 *
 * 支持组合键：Ctrl+S, Cmd+K, Shift+?, Alt+F4 等。
 * "mod" 为跨平台修饰符（Mac→Cmd, Windows/Linux→Ctrl）。
 *
 * @param key       快捷键描述，如 "Ctrl+S"、"Cmd+K"、"mod+K"
 * @param callback  触发回调
 * @param deps      回调依赖项（透传给 useEffect）
 */
export function useKeyboardShortcut(
  key: string,
  callback: () => void,
  deps: React.DependencyList = [],
): void {
  const callbackRef = React.useRef(callback)
  callbackRef.current = callback

  React.useEffect(() => {
    if (typeof window === 'undefined') return

    const isMac =
      typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform)

    const handler = (event: KeyboardEvent) => {
      const parts = key.toLowerCase().split('+')
      const targetKey = parts.pop()
      if (!targetKey) return

      const wantCtrl = parts.includes('ctrl')
      const wantCmd = parts.includes('cmd') || parts.includes('meta')
      const wantShift = parts.includes('shift')
      const wantAlt = parts.includes('alt')
      const wantMod = parts.includes('mod')

      // mod: Mac→Cmd, 其他→Ctrl
      if (wantMod) {
        if (isMac ? !event.metaKey : !event.ctrlKey) return
      }
      if (wantCtrl && !event.ctrlKey) return
      if (wantCmd && !event.metaKey) return
      if (wantShift && !event.shiftKey) return
      if (wantAlt && !event.altKey) return

      if (event.key.toLowerCase() !== targetKey) return

      event.preventDefault()
      callbackRef.current()
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [key, ...deps])
}
