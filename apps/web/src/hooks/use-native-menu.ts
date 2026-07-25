'use client'

import * as React from 'react'
import { isTauri, listenToMenuEvents, type MenuActionId } from '@/lib/tauri-bridge'

/**
 * useNativeMenu — 订阅 Rust 菜单 click 事件 hook(2026-07-25 立)
 *
 * 设计:
 * - 用 stable ref 持有 handler,避免 listen 反复注册
 * - 卸载时 unlisten 释放 event listener(避免内存泄漏)
 * - 非 Tauri 环境 no-op,handler 永远不会被调用
 *
 * 用法:
 *   useNativeMenu((id) => dispatchMenuAction(id))
 */
export function useNativeMenu(handler: (id: MenuActionId) => void) {
  const handlerRef = React.useRef(handler)
  React.useEffect(() => {
    handlerRef.current = handler
  }, [handler])

  React.useEffect(() => {
    if (!isTauri()) return
    let unlisten: (() => void) | null = null
    let cancelled = false
    void listenToMenuEvents((id) => handlerRef.current(id)).then((fn) => {
      if (cancelled) fn()
      else unlisten = fn
    })
    return () => {
      cancelled = true
      if (unlisten) unlisten()
    }
  }, [])
}
