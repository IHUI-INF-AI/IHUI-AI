'use client'

import * as React from 'react'
import { ChevronDown, Minus, Square, X, AppWindow } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from '@/components/ui/dropdown-menu'
import { useDesktop } from '@/hooks/use-desktop'
import { useNativeShortcuts } from '@/hooks/use-native-shortcuts'
import { dispatchMenuAction } from '@/lib/menu-actions'
import {
  minimizeWindow,
  toggleMaximizeWindow,
  closeWindow,
  type MenuActionId,
} from '@/lib/tauri-bridge'
import { cn } from '@/lib/utils'

/**
 * NativeTopBar — Tauri 桌面端自定义标题栏(2026-07-25 立)
 *
 * 设计要点:
 * - 完全自绘:tauri.conf.json 已设 `decorations: false`,系统标题栏消失,本组件顶替之
 * - HTML Dropdown:click 文件/视图/帮助按钮 → Radix DropdownMenu 弹出
 * - 仅桌面端:`isDesktop=false` 时返回 null,web 端浏览器布局完全不变
 *
 * 布局(40px 高,VSCode 风格):
 *   [Logo + 智汇AI] [文件 视图 帮助 dropdown] [flex-1] [Min Max Close]
 *
 * 拖拽:`data-tauri-drag-region` 应用于父容器;
 *      button 子元素天然不参与拖拽(Tauri 2 自动排除)。
 *
 * 与 Rust 端的关系(2026-07-25 修订):
 * - 2026-07-25 前:Rust 端 build_app_menu 构建原生菜单,点击时通过 emit_to("main","menu:click",id)
 *   通知前端 dispatcher(menu-actions.ts)
 * - 2026-07-25 后:原生菜单已删除(避免原生菜单 + HTML 顶栏两层菜单割裂),
 *   菜单 UI 完全由本组件自绘。HTML 顶栏点击 + web 端快捷键(Ctrl+R/F12/Ctrl+Shift+A/Ctrl+Q)
 *   都走同一个 dispatchMenuAction,真正需要 Rust 的能力(F12 devtools / Ctrl+Shift+A
 *   唤起 admin / Ctrl+Q 退出)通过 invoke 命令调用,逻辑保持不变
 *
 * UI 约束(AGENTS.md §4):
 * - 圆角:rounded-md(8px)/rounded-sm(4px),无 rounded-full
 * - 中文字体对齐:globals.css 全局 vcenter 规则 + translate-y 兜底
 * - 颜色:hover bg-accent(灰调),无蓝色发光
 * - 无 <hr> / 分割线;用容器完整描边
 */

interface MenuEntry {
  kind: 'item'
  id: MenuActionId
  label: string
  shortcut?: string
}
interface MenuSeparatorItem {
  kind: 'sep'
}
type MenuItem = MenuEntry | MenuSeparatorItem

const FILE_MENU: MenuItem[] = [
  { kind: 'item', id: 'file.open_admin', label: '打开管理后台…', shortcut: 'Ctrl+Shift+A' },
  { kind: 'sep' },
  { kind: 'item', id: 'file.quit', label: '退出', shortcut: 'Ctrl+Q' },
]
const VIEW_MENU: MenuItem[] = [
  { kind: 'item', id: 'view.reload', label: '刷新', shortcut: 'Ctrl+R' },
  { kind: 'item', id: 'view.devtools', label: '切换开发者工具', shortcut: 'F12' },
]
const HELP_MENU: MenuItem[] = [{ kind: 'item', id: 'help.about', label: '关于 智汇AI' }]

export function NativeTopBar() {
  const { isDesktop, appInfo, isMaximized } = useDesktop()
  const [localMaximized, setLocalMaximized] = React.useState(isMaximized)

  // 同步全局 isMaximized → 本地 state(用于切换 Max vs Restore 图标)
  React.useEffect(() => {
    setLocalMaximized(isMaximized)
  }, [isMaximized])

  // 2026-07-25 修订:用 web 端快捷键监听替代 Rust 端菜单 emit(Rust 端 build_app_menu 已删除,
  // 避免原生菜单 + HTML 顶栏两层菜单割裂)。HTML 顶栏点击 + 快捷键都走 dispatchMenuAction,
  // 单一逻辑源。
  useNativeShortcuts((id) => void dispatchMenuAction(id))

  // 浏览器端不渲染(避免 web 端误显示)
  if (!isDesktop) return null

  const appName = appInfo?.name ?? '智汇AI'

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
      {/* 左侧:Logo + 应用名 */}
      <div
        data-tauri-drag-region
        className="flex h-full items-center gap-2 pl-3 pr-2"
      >
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-foreground/10">
          <AppWindow className="h-3.5 w-3.5 text-foreground/80" />
        </div>
        <span className="text-[13px] font-semibold leading-none text-foreground/90 translate-y-[var(--text-vcenter-offset)]">
          {appName}
        </span>
      </div>

      {/* 中间:菜单 dropdown(文件 / 视图 / 帮助) */}
      <nav
        aria-label="应用菜单"
        className="flex h-full items-center gap-0.5 pl-1"
      >
        <TopBarDropdown label="文件" items={FILE_MENU} />
        <TopBarDropdown label="视图" items={VIEW_MENU} />
        <TopBarDropdown label="帮助" items={HELP_MENU} />
      </nav>

      {/* 中间弹性区(可拖拽) */}
      <div data-tauri-drag-region className="flex-1 h-full" />

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

/** 单个菜单 dropdown(文件/视图/帮助) */
function TopBarDropdown({
  label,
  items,
}: {
  label: string
  items: MenuItem[]
}) {
  const handleSelect = async (id: MenuActionId) => {
    await dispatchMenuAction(id)
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'group inline-flex h-7 items-center gap-1 rounded-md px-2.5',
          'text-[13px] font-medium leading-none text-foreground/80',
          'transition-colors hover:bg-accent hover:text-foreground',
          'data-[state=open]:bg-accent data-[state=open]:text-foreground',
          'focus:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          '[&>span]:translate-y-[var(--text-vcenter-offset)]',
        )}
      >
        <span>{label}</span>
        <ChevronDown
          className={cn(
            'h-3 w-3 opacity-60 transition-transform',
            'group-data-[state=open]:rotate-180',
          )}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={6}
        className="min-w-[180px] rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg"
      >
        {items.map((item, i) =>
          item.kind === 'sep' ? (
            <DropdownMenuSeparator key={`sep-${i}`} className="my-1 h-px bg-border" />
          ) : (
            <DropdownMenuItem
              key={item.id}
              onSelect={(e) => {
                e.preventDefault()
                void handleSelect(item.id)
              }}
              className="flex h-8 items-center justify-between rounded-sm px-2.5 text-sm transition-colors focus:bg-accent focus:text-accent-foreground"
            >
              <span className="translate-y-[var(--text-vcenter-offset)]">{item.label}</span>
              {item.shortcut && (
                <DropdownMenuShortcut className="ml-3 text-[11px] text-muted-foreground">
                  {item.shortcut}
                </DropdownMenuShortcut>
              )}
            </DropdownMenuItem>
          ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

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
