'use client'

/**
 * NativeTopBar — Tauri 桌面端自定义顶栏(2026-07-25 重写)
 *
 * 设计目的(摘自 GlobalShell.tsx 138-141 行注释 + 用户 2026-07-25 反馈):
 * - 仅 isDesktop=true(Tauri 客户端)时渲染,内部守卫保证 web 端不显示
 * - 横跨 Sidebar + 内容区,统一处理拖拽 + 窗口控制 + 菜单 dropdown
 * - 40px 高,半透明毛玻璃背景 + 底边 1px,与 sidebar 视觉融为一体
 * - **菜单与程序名同行**(用户 2026-07-25 要求):文件/视图/帮助 紧跟 logo + appName,
 *   整排显示,不再独立成行;菜单 dropdown 与 macOS 风格一致
 *
 * 与 Rust 端 build_app_menu 的关系:
 * - Rust 端依然构建原生菜单(顶栏 + 标准 Alt-key 触发),点击时通过 emit_to("main","menu:click",id)
 *   通知前端 dispatcher(menu-actions.ts)
 * - HTML 顶栏是**视觉呈现层**,点击后调用同一个 dispatcher(open_admin_window / toggle_devtools / reload / quit),
 *   保证原生菜单快捷键(Ctrl+R/F12/Ctrl+Shift+A/Ctrl+Q)与 HTML 菜单点击行为一致
 * - HTML 顶栏的菜单内容(文件/视图/帮助)只是原生菜单的"视觉镜像",真正的快捷键/平台菜单仍由 Rust 提供
 *
 * 子组件:
 * - TopBarDropdown: Radix UI DropdownMenu 包装,统一 hover/active 样式
 * - WindowControlButton: 窗口控制按钮(最小化/最大化/关闭),关闭按钮 hover 变红
 *
 * 拖拽行为:
 * - 整条顶栏 `data-tauri-drag-region`(Tauri WebView 自动接管鼠标按下/移动/释放)
 * - 菜单/按钮区域需要 `onMouseDown` e.preventDefault() 阻止冒泡,
 *   否则点菜单会误触发拖拽
 */
import * as React from 'react'
import Image from 'next/image'
import { ChevronDown, Minus, Square, X, Info, RotateCw, Code2, Settings2, LogOut } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from '@/components/ui/dropdown-menu'
import { useDesktop } from '@/hooks/use-desktop'
import { useNativeMenu } from '@/hooks/use-native-menu'
import { dispatchMenuAction } from '@/lib/menu-actions'
import {
  getLocalizedAppName,
  type MenuActionId,
} from '@/lib/tauri-bridge'
import { cn } from '@/lib/utils'

interface MenuEntry {
  kind: 'item'
  id: MenuActionId
  label: string
  shortcut?: string
  icon?: React.ReactNode
}
interface MenuSeparatorItem {
  kind: 'sep'
}
type MenuItem = MenuEntry | MenuSeparatorItem

// 菜单项定义(与 Rust 端 build_app_menu ID 一一对应)
// 用 lucide 图标让 dropdown 视觉更精致(用户 2026-07-25 "美化样式"要求)
const FILE_MENU: MenuItem[] = [
  {
    kind: 'item',
    id: 'file.open_admin',
    label: '打开管理后台',
    shortcut: 'Ctrl+Shift+A',
    icon: <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />,
  },
  { kind: 'sep' },
  {
    kind: 'item',
    id: 'file.quit',
    label: '退出',
    shortcut: 'Ctrl+Q',
    icon: <LogOut className="h-3.5 w-3.5 text-muted-foreground" />,
  },
]

const VIEW_MENU: MenuItem[] = [
  {
    kind: 'item',
    id: 'view.reload',
    label: '刷新',
    shortcut: 'Ctrl+R',
    icon: <RotateCw className="h-3.5 w-3.5 text-muted-foreground" />,
  },
  {
    kind: 'item',
    id: 'view.devtools',
    label: '开发者工具',
    shortcut: 'F12',
    icon: <Code2 className="h-3.5 w-3.5 text-muted-foreground" />,
  },
]

const HELP_MENU: MenuItem[] = [
  {
    kind: 'item',
    id: 'help.about',
    label: '关于',
    icon: <Info className="h-3.5 w-3.5 text-muted-foreground" />,
  },
]

/**
 * 阻止 mousedown 冒泡到 drag region(否则点击菜单会误触发窗口拖拽)。
 * Tauri 的 data-tauri-drag-region 监听 mousedown 事件,需要主动 preventDefault。
 */
function stopDragPropagation(e: React.MouseEvent | React.PointerEvent) {
  e.stopPropagation()
}

export function NativeTopBar() {
  const { isDesktop, appInfo, isMaximized, minimize, toggleMaximize, close } = useDesktop()
  useNativeMenu((id) => void dispatchMenuAction(id))

  // SSR + web 端:完全不渲染
  if (typeof window === 'undefined') return null
  if (!isDesktop) return null

  // 优先用 Rust 端权威名(由 system UI language 决定);前端 getLocalizedAppName 作 fallback
  const appName = appInfo?.name ?? getLocalizedAppName()

  return (
    <div
      data-tauri-drag-region
      className={cn(
        'relative z-sticky flex h-10 shrink-0 items-center select-none',
        // 半透明毛玻璃 + 底边 1px,与 sidebar 视觉融为一体
        'bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60',
        'border-b border-border/80',
      )}
    >
      {/* === 左侧:Logo + App Name(整段可拖拽) === */}
      <div
        data-tauri-drag-region
        className="flex h-full shrink-0 items-center gap-2 pl-3 pr-1"
      >
        <Image
          src="/images/logo.png?v=20260719-unify"
          alt={appName}
          width={20}
          height={20}
          className="h-5 w-5 select-none rounded"
          draggable={false}
          unoptimized
          priority
        />
        <span className="text-[13px] font-semibold leading-none text-foreground/90 translate-y-[var(--text-vcenter-offset)]">
          {appName}
        </span>
      </div>

      {/* === 中间偏左:菜单 dropdown(文件/视图/帮助,与程序名同行) === */}
      <nav
        aria-label="应用菜单"
        // 用 mousedown 阻止冒泡,防止点菜单误触拖拽
        onMouseDown={stopDragPropagation}
        onPointerDown={stopDragPropagation}
        className="flex h-full shrink-0 items-center gap-0.5 pl-1"
      >
        <TopBarDropdown label="文件" items={FILE_MENU} />
        <TopBarDropdown label="视图" items={VIEW_MENU} />
        <TopBarDropdown label="帮助" items={HELP_MENU} />
      </nav>

      {/* === 中间:flex-1 spacer(整段可拖拽) === */}
      <div data-tauri-drag-region className="h-full flex-1" />

      {/* === 右侧:窗口控制(不可拖拽) === */}
      <div
        className="flex h-full shrink-0 items-center"
        onMouseDown={stopDragPropagation}
        onPointerDown={stopDragPropagation}
        onDoubleClick={stopDragPropagation}
      >
        <WindowControlButton
          onClick={minimize}
          ariaLabel="最小化"
          icon={<Minus className="h-3.5 w-3.5" />}
        />
        <WindowControlButton
          onClick={toggleMaximize}
          ariaLabel={isMaximized ? '还原' : '最大化'}
          icon={isMaximized ? <RestoreIcon /> : <Square className="h-3 w-3" />}
        />
        <WindowControlButton
          onClick={close}
          ariaLabel="关闭"
          icon={<X className="h-3.5 w-3.5" />}
          variant="close"
        />
      </div>
    </div>
  )
}

// ================== TopBarDropdown ==================

interface TopBarDropdownProps {
  label: string
  items: MenuItem[]
}

/**
 * 顶栏菜单 dropdown — 与 macOS / Windows 原生菜单视觉一致:
 * - 触发按钮:hover 浅色高亮,open 态持续高亮
 * - dropdown 内容:8px 圆角 + shadow + 半透明背景,与 popover 体系统一
 * - 菜单项:左侧 icon + 文字 + 右侧快捷键 hint,hover 浅色高亮
 */
function TopBarDropdown({ label, items }: TopBarDropdownProps) {
  const handleSelect = (id: MenuActionId) => {
    void dispatchMenuAction(id)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          // 布局:icon + 文字 + chevron 同行
          'group inline-flex h-7 items-center gap-1 rounded-md px-2.5',
          // 字体:与 appName 一致的 13px,但中量级,与 dropdown 项视觉层级一致
          'text-[13px] font-medium leading-none text-foreground/80',
          // hover 态:bg-accent 高亮 + 文字加深
          'transition-colors',
          'hover:bg-accent hover:text-accent-foreground',
          // open 态:持续高亮
          'data-[state=open]:bg-accent data-[state=open]:text-accent-foreground',
          // a11y:focus 环
          'focus:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          // 中文 + 图标垂直对齐
          '[&>span]:translate-y-[var(--text-vcenter-offset)]',
        )}
      >
        <span>{label}</span>
        <ChevronDown
          className={cn(
            'h-3 w-3 opacity-60 transition-transform duration-150',
            'group-data-[state=open]:rotate-180 group-data-[state=open]:opacity-90',
          )}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={4}
        className={cn(
          // 6px 圆角 + 阴影 + 半透明,与全局 Popover 体系一致
          'min-w-[200px] rounded-md border border-border/80 bg-popover/95 p-1',
          'text-popover-foreground shadow-lg backdrop-blur',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        )}
      >
        {items.map((item, i) =>
          item.kind === 'sep' ? (
            <DropdownMenuSeparator
              key={`sep-${i}`}
              className="-mx-1 my-1 h-px bg-border/60"
            />
          ) : (
            <DropdownMenuItem
              key={item.id}
              onSelect={(e) => {
                e.preventDefault()
                handleSelect(item.id)
              }}
              className={cn(
                // 布局:icon + label + shortcut 三段,flex 均匀分布
                'flex h-8 cursor-pointer items-center gap-2 rounded-sm px-2.5',
                // 文字:14px,中文 span 垂直对齐
                'text-sm text-popover-foreground',
                // hover/focus 态:bg-accent 高亮
                'transition-colors focus:bg-accent focus:text-accent-foreground',
                'data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground',
                'outline-none',
              )}
            >
              {item.icon && <span className="shrink-0">{item.icon}</span>}
              <span className="flex-1 translate-y-[var(--text-vcenter-offset)]">
                {item.label}
              </span>
              {item.shortcut && (
                <DropdownMenuShortcut className="ml-auto text-[11px] font-normal text-muted-foreground/80 tracking-normal">
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

// ================== WindowControlButton ==================

interface WindowControlButtonProps {
  onClick: () => void
  ariaLabel: string
  icon: React.ReactNode
  variant?: 'close'
}

/**
 * 窗口控制按钮(最小化/最大化/关闭)。
 * 关闭按钮 hover 变红(macOS 风格,但用项目 destructive 色 + 透明背景,不刺眼)。
 * 11px icon 容器,40px 高,完美贴合 40px 顶栏高度。
 */
function WindowControlButton({
  onClick,
  ariaLabel,
  icon,
  variant,
}: WindowControlButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        // 11 * 40 = 440px,正好 3 个按钮
        'inline-flex h-full w-11 items-center justify-center',
        // 默认:文字色(与顶栏其他文字保持一致)
        'text-foreground/70 transition-colors',
        // hover:浅色高亮
        'hover:bg-accent hover:text-foreground',
        // a11y:focus
        'focus:outline-none focus-visible:bg-accent',
        // 关闭按钮:hover 变红(macOS 风格)
        variant === 'close' &&
          'hover:bg-red-500/15 hover:text-red-600 dark:hover:text-red-400',
      )}
    >
      {icon}
    </button>
  )
}

// ================== RestoreIcon ==================

/**
 * 还原按钮图标(双框叠加,表示从最大化还原)。
 * 用内联 SVG 避免 lucide 找不到完全匹配的图标。
 */
function RestoreIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect x="3.5" y="3.5" width="6" height="6" rx="1" />
      <path d="M2.5 8.5 V2.5 H8.5" />
    </svg>
  )
}

export default NativeTopBar
