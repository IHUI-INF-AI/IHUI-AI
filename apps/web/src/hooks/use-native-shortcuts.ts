// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { matchesShortcutKeyCode } from '@/lib/keyboard-shortcut-match'
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
 * - Ctrl+Q            → file.quit       (真退出应用)
 *
 * 2026-09-23 移除:Ctrl+Shift+A → file.open_admin
 * - 该分支是从 Tauri 菜单 accelerator 移植来的,而 Rust 端对应 accelerator 早已删除;
 * - 它与 use-ide-shortcuts 的 `Ctrl+Shift+A`(applications 视图)、
 *   注册表 mention-file 三方撞键,一次按下三件事同时发生;
 * - 管理后台在顶栏/设置页均有正常入口,不需要快捷键承载。
 *
 * 兼容性:
 * - 焦点在 input/textarea/contenteditable 时不触发(让用户正常输入)——**唯一例外是 Ctrl+Q**,
 *   理由见下方 quit 分支的 L5782 注释(应用级 accelerator 无视焦点,与 2026-07-25 被删除的
 *   Rust 原生菜单 accelerator 同语义)
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
      const key = e.key.toLowerCase()
      const ctrl = e.ctrlKey || e.metaKey // Mac 用 cmd,Windows/Linux 用 ctrl
      const shift = e.shiftKey
      const alt = e.altKey

      // L5782(2026-10-02 修,桌面端 Ctrl+Q 毫无反应):退出是**应用级 accelerator**,
      // 必须无视焦点。旧实现把这条放在下面 isEditableTarget 的早退之后,而桌面端主界面
      // 常年是聊天输入框(contenteditable / textarea)持有焦点(message-input.tsx 多处
      // inputCoreRef.current?.focus())⇒ 用户最常处的状态下这条键结构上永不触发,
      // 账面表现就是"按了毫无反应"。本键 2026-07-25 前的宿主是 Rust 原生菜单 accelerator,
      // 原生 accelerator 本就无视焦点 —— 头注承诺的"等价快捷键"因此一直欠着,此处补齐。
      // key 匹配复用 keyboard-shortcut-match 那一份实现(e.key 被中文键盘布局/IME 改写时
      // 按物理 code 兜底),不得在本文件再抄一份判据。
      if (ctrl && !shift && !alt && matchesShortcutKeyCode(e, 'q')) {
        e.preventDefault()
        handlerRef.current('file.quit')
        return
      }

      // 焦点在输入控件时不拦截,让用户正常输入(其余键维持原语义)
      if (isEditableTarget(e.target)) return

      // 调试模式:DevTools 自身快捷键 / 浏览器保留
      // Ctrl+Shift+I / F12 都可能冲突,这里只做菜单 dispatcher 的派发
      if (key === 'f12') {
        e.preventDefault()
        handlerRef.current('view.devtools')
        return
      }

      // F11 = 切换全屏(桌面端标配,2026-07-27 立)
      if (key === 'f11' && !ctrl && !shift && !alt) {
        e.preventDefault()
        handlerRef.current('view.fullscreen')
        return
      }

      if (ctrl && !shift && !alt && key === 'r') {
        e.preventDefault()
        handlerRef.current('view.reload')
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
