'use client'

import * as React from 'react'
import type { MenuActionId } from '@/lib/tauri-bridge'

/**
 * useNativeShortcuts — Web 端快捷键监听(2026-07-25 立,替代原生菜单 accelerator)
 *
 * 2026-07-25 修订背景:
 * - Rust 端 build_app_menu 已删除(避免原生菜单 + HTML 顶栏两层菜单割裂)
 * - 原菜单 accelerator(Ctrl+R / F12 / Ctrl+Shift+A / Ctrl+Q)失去宿主
 * - 改用 web 端 keydown 监听实现等价快捷键,菜单动作通过同一个
 *   dispatchMenuAction 派发,保持单一逻辑源
 *
 * 快捷键映射(与原 Rust MenuItemBuilder.accelerator 一一对应):
 * - Ctrl+R / F5       → view.reload     (刷新 webview)
 * - F12               → view.devtools   (切换开发者工具)
 * - Ctrl+Shift+A      → file.open_admin (唤起管理后台)
 * - Ctrl+Q            → file.quit       (真退出应用)
 *
 * 兼容性:
 * - 焦点在 input/textarea/contenteditable 时不触发(让用户正常输入)
 * - modifier 严格匹配,避免 Ctrl+R 在中文输入法下误触
 * - 非 Tauri 环境也支持(本地浏览器开发体验)
 */
export function useNativeShortcuts(handler: (id: MenuActionId) => void) {
  const handlerRef = React.useRef(handler)
  React.useEffect(() => {
    handlerRef.current = handler
  }, [handler])

  React.useEffect(() => {
    if (typeof window === 'undefined') return

    const isEditableTarget = (target: EventTarget | null): boolean => {
      const el = target as HTMLElement | null
      if (!el) return false
      const tag = el.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
      if (el.isContentEditable) return true
      return false
    }

    const onKey = (e: KeyboardEvent) => {
      // 焦点在输入控件时不拦截,让用户正常输入
      if (isEditableTarget(e.target)) return

      const key = e.key.toLowerCase()
      const ctrl = e.ctrlKey || e.metaKey // Mac 用 cmd,Windows/Linux 用 ctrl
      const shift = e.shiftKey
      const alt = e.altKey

      // 调试模式:DevTools 自身快捷键 / 浏览器保留
      // Ctrl+Shift+I / F12 都可能冲突,这里只做菜单 dispatcher 的派发
      if (key === 'f12') {
        e.preventDefault()
        handlerRef.current('view.devtools')
        return
      }

      if (ctrl && shift && (key === 'a' || key === 'a')) {
        e.preventDefault()
        handlerRef.current('file.open_admin')
        return
      }

      if (ctrl && !shift && !alt && key === 'r') {
        e.preventDefault()
        handlerRef.current('view.reload')
        return
      }

      if (ctrl && !shift && !alt && key === 'q') {
        e.preventDefault()
        handlerRef.current('file.quit')
        return
      }

      // F5 = 刷新(浏览器自带,但在 Tauri 内可能被 webview 拦截,显式派发)
      if (key === 'f5' && !ctrl && !shift && !alt) {
        e.preventDefault()
        handlerRef.current('view.reload')
        return
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
