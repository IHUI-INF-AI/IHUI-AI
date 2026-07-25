'use client'

import * as React from 'react'
import { Minus, Square, X } from 'lucide-react'
import { useDesktop } from '@/hooks/use-desktop'
import { useNativeShortcuts } from '@/hooks/use-native-shortcuts'
import { dispatchMenuAction } from '@/lib/menu-actions'
import {
  minimizeWindow,
  toggleMaximizeWindow,
  closeWindow,
} from '@/lib/tauri-bridge'
import { cn } from '@/lib/utils'

/**
 * NativeTopBar — Tauri 桌面端自定义标题栏(2026-07-25 立)
 *
 * 设计要点:
 * - 完全自绘:tauri.conf.json 已设 `decorations: false`,系统标题栏消失,本组件顶替之
 * - 仅保留窗口控制三按钮(2026-07-25 用户反馈:左侧 Logo / 应用名 / 文件-视图-帮助 dropdown 全部移除)
 * - 仅桌面端:`isDesktop=false` 时返回 null,web 端浏览器布局完全不变
 *
 * 布局(40px 高):
 *   [可拖拽空白区 flex-1] [Min Max Close]
 *
 * 拖拽:`data-tauri-drag-region` 应用于父容器;
 *      button 子元素天然不参与拖拽(Tauri 2 自动排除)。
 *
 * 与 Rust 端的关系(2026-07-25 修订):
 * - 2026-07-25 前:Rust 端 build_app_menu 构建原生菜单 + HTML 顶栏 dropdown,两层菜单割裂
 * - 2026-07-25 后:Rust 端原生菜单已删除,菜单 UI 也从顶栏移除(纯按钮栏)。
 *   快捷键(Ctrl+R / F12 / Ctrl+Shift+A / Ctrl+Q)由 web 端 useNativeShortcuts 监听 keydown,
 *   通过 dispatchMenuAction 走同一个 dispatcher,真正需要 Rust 的能力(F12 devtools /
 *   Ctrl+Shift+A 唤起 admin / Ctrl+Q 退出)通过 invoke 命令调用,逻辑保持不变
 *
 * UI 约束(AGENTS.md §4):
 * - 圆角:rounded-md(8px)/rounded-sm(4px),无 rounded-full
 * - 中文字体对齐:globals.css 全局 vcenter 规则 + translate-y 兜底
 * - 颜色:hover bg-accent(灰调),无蓝色发光
 * - 无 <hr> / 分割线;用容器完整描边
 */

export function NativeTopBar() {
  const { isDesktop, isMaximized } = useDesktop()
  const [localMaximized, setLocalMaximized] = React.useState(isMaximized)

  // 同步全局 isMaximized → 本地 state(用于切换 Max vs Restore 图标)
  React.useEffect(() => {
    setLocalMaximized(isMaximized)
  }, [isMaximized])

  // 2026-07-25 修订:用 web 端快捷键监听替代 Rust 端菜单 emit(Rust 端 build_app_menu 已删除,
  // 避免原生菜单 + HTML 顶栏两层菜单割裂)。顶栏已无 UI 菜单,只剩快捷键入口,
  // 都走 dispatchMenuAction,单一逻辑源。
  useNativeShortcuts((id) => void dispatchMenuAction(id))

  // 浏览器端不渲染(避免 web 端误显示)
  if (!isDesktop) return null

  const handleMinimize = async () => {
    await minimizeWindow()
  }
  const handleToggleMax = async () => {
    const next = await toggleMaximizeWindow()
    setLocalMaximized(next)
  }
  const handleClose = async () => {
    await closeWindow()
  }

  return (
    <div
      data-tauri-drag-region
      className={cn(
        'relative z-sticky flex h-10 shrink-0 items-center select-none',
        'bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80',
        'border-b border-border',
      )}
    >
      {/* 左侧:整段可拖拽空白区(2026-07-25 用户反馈:不要 Logo / 应用名 / 菜单) */}
      <div data-tauri-drag-region className="h-full flex-1" />

      {/* 右侧:窗口控制按钮 */}
      <div className="flex h-full items-center">
        <WindowControlButton
          onClick={handleMinimize}
          ariaLabel="最小化"
          icon={<Minus className="h-3.5 w-3.5" />}
        />
        <WindowControlButton
          onClick={handleToggleMax}
          ariaLabel={localMaximized ? '还原' : '最大化'}
          icon={
            localMaximized ? (
              <RestoreIcon className="h-3 w-3" />
            ) : (
              <Square className="h-3 w-3" />
            )
          }
        />
        <WindowControlButton
          onClick={handleClose}
          ariaLabel="关闭"
          icon={<X className="h-3.5 w-3.5" />}
          variant="close"
        />
      </div>
    </div>
  )
}

// ================== 子组件 ==================

/** 窗口控制按钮(Min/Max/Close) */
function WindowControlButton({
  onClick,
  ariaLabel,
  icon,
  variant,
}: {
  onClick: () => void | Promise<void>
  ariaLabel: string
  icon: React.ReactNode
  variant?: 'close'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        'inline-flex h-full w-11 items-center justify-center',
        'text-foreground/80 transition-colors',
        'hover:bg-accent hover:text-foreground',
        'focus:outline-none focus-visible:bg-accent',
        variant === 'close' &&
          'hover:bg-red-500/15 hover:text-red-600 dark:hover:text-red-400',
      )}
    >
      {icon}
    </button>
  )
}

/** 还原图标(用 lucide-react 的 `Copy` 不可表达,自绘最小实现) */
function RestoreIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      {...props}
    >
      <rect x="2.5" y="2.5" width="6" height="6" rx="1" />
      <path d="M4 0.5 H10.5 V7" />
    </svg>
  )
}

export default NativeTopBar
