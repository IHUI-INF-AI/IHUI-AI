'use client'
/* eslint-disable jsx-a11y/no-static-element-interactions -- 桌面端窗口控制(拖拽/resize/双击最大化)是鼠标专用交互,不适用于键盘/屏幕阅读器 */

import * as React from 'react'
import { Minus, Square, X } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { useDesktop, useSystemTheme, useDesktopEvents } from '@/hooks/use-desktop'
import { useTheme } from '@/hooks/use-theme'
import {
  minimizeWindow,
  toggleMaximizeWindow,
  closeWindow,
  startWindowDrag,
  startResize,
  onMaximizeChange,
} from '@/lib/tauri-bridge'
import { cn } from '@/lib/utils'
import { TagsView } from '@/components/layout/TagsView'

/**
 * MainShell — (main) 路由组的工作区面板容器
 *
 * 2026-07-28 第十一次修订(窗口交互深度优化版):
 * - 修复 8 方向 resize 区域与窗口控制按钮 z-index 冲突(原 z-9999/10000 压过按钮)
 * - 修复拖拽三重触发(data-tauri-drag-region + onMouseDown + 冒泡),改用 sidebar 已验证的 setTimeout 模式
 * - 修复双击最大化失效(原 mousedown 立即拖拽,浏览器无法识别 dblclick)
 * - 修复最大化时 resize 区域仍然可点击
 * - 删除嵌套 data-tauri-drag-region + 删除 beforeunload 死代码 + 删除双重 restore_window_state
 * - cursor 体系优化:顶栏 cursor-default,TagsView 标签 cursor-pointer,空白处显式 cursor-move
 *
 * 桌面端(Tauri)能力(仅 isDesktop 时启用):
 * - P0-1:8 方向 Resize 边缘缩放(4 边 + 4 角,透明 fixed,z-index 最高)
 *   - 仅 !isMaximized 时渲染(最大化时禁用 resize,符合 Windows 原生行为)
 *   - 4 边内缩 8px 避开角落 + 4 角 8x8 像素
 *   - z-[9999] 边,z-[10000] 角,窗口控制按钮 z-[10001] 始终最上
 * - P0-2:最大化按钮图标切换(onMaximizeChange 监听 onResized)
 * - 窗口拖拽:setTimeout 250ms 延迟模式(短按视为点击,长按触发拖拽)
 *   - 250ms 内第二次 mousedown → 取消拖拽 + 触发双击最大化
 *   - 250ms 内 mouseup → 取消拖拽(纯点击场景)
 * - P1-7:系统主题跟随(useSystemTheme hook + next-themes setTheme 联动)
 * - 窗口位置记忆由 Rust 端 setup 统一处理(删除前端 restoreWindowState 调用,避免双重恢复导致启动抖动)
 *
 * 布局:
 *   <div pt-2 mb-2 mr-2>                  ← 外层 wrapper(顶栏 + 工作区卡片)
 *     <Resize 8 方向 fixed>                ← 仅桌面端 !isMaximized
 *     <div h-[32px]>                      ← 顶栏(cursor-default + 拖拽监听)
 *       <TagsView flex-1 />                ← 页面标签容器
 *       <Min|Max|Close z-[10001] />        ← 仅桌面端 isDesktop
 *     </div>
 *     <div bg-shell-panel rounded-xl mt-2 flex-1>  ← 工作区卡片
 *       <main p-4>{children}</main>
 *     </div>
 *   </div>
 */
export function MainShell({ children }: { children: React.ReactNode }) {
  // 显式订阅以触发 (main) 路由组的认证态变化
  useAuthStore((s) => s.isAuthenticated)

  const { isDesktop } = useDesktop()
  const { setTheme } = useTheme()
  const systemTheme = useSystemTheme()
  // 监听 Rust 端托盘菜单 + 系统级快捷键事件(2026-07-29)
  useDesktopEvents()

  // 最大化状态:用 onMaximizeChange 监听 Tauri onResized 事件
  // 不再使用 useDesktop().isMaximized(它走浏览器 resize 事件,比 Tauri 事件慢一帧)
  const [isMaximized, setIsMaximized] = React.useState(false)

  // 拖拽 + 双击最大化统一状态机(参考 sidebar.tsx 已验证的 setTimeout 模式)
  // - dragTimer: mousedown 启动 250ms timer,到期触发 startWindowDrag
  // - dragArmed: 标记当前是否处于"等待拖拽"状态
  // - lastMouseDownAt: 上次 mousedown 时间戳,用于检测双击
  const dragTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastMouseDownAt = React.useRef<number>(0)
  const DOUBLE_CLICK_MS = 250 // 双击窗口期(也是拖拽延迟),与 sidebar 一致

  // P0-2:监听 Tauri 窗口最大化状态变化
  React.useEffect(() => {
    if (!isDesktop) return
    let cancelled = false
    const unlisten = onMaximizeChange((maximized) => {
      if (!cancelled) setIsMaximized(maximized)
    })
    return () => {
      cancelled = true
      unlisten()
    }
  }, [isDesktop])

  // P1-7:系统主题跟随(OS 切换深色/浅色时自动同步)
  React.useEffect(() => {
    if (!isDesktop || !systemTheme) return
    setTheme(systemTheme)
  }, [isDesktop, systemTheme, setTheme])

  // 2026-07-29:监听 Rust 端托盘菜单 + 系统级快捷键转发的 CustomEvent
  // useDesktopEvents 已把 Rust emit 转为 CustomEvent,这里统一处理业务逻辑
  React.useEffect(() => {
    if (!isDesktop) return
    const onThemeToggle = () => setTheme(document.documentElement.classList.contains('dark') ? 'light' : 'dark')
    const onOpenSettings = () => window.location.assign('/settings')
    const onCheckUpdate = () => window.dispatchEvent(new CustomEvent('global-shortcut:check-update'))
    const onQuickScreenshot = () => window.dispatchEvent(new CustomEvent('global-shortcut:quick-screenshot'))
    window.addEventListener('desktop-theme-toggle', onThemeToggle)
    window.addEventListener('desktop-open-settings', onOpenSettings)
    window.addEventListener('desktop-check-update', onCheckUpdate)
    window.addEventListener('desktop-quick-screenshot', onQuickScreenshot)
    return () => {
      window.removeEventListener('desktop-theme-toggle', onThemeToggle)
      window.removeEventListener('desktop-open-settings', onOpenSettings)
      window.removeEventListener('desktop-check-update', onCheckUpdate)
      window.removeEventListener('desktop-quick-screenshot', onQuickScreenshot)
    }
  }, [isDesktop, setTheme])

  // 清理拖拽 timer(组件卸载时)
  React.useEffect(() => {
    return () => {
      if (dragTimer.current) {
        clearTimeout(dragTimer.current)
        dragTimer.current = null
      }
    }
  }, [])

  const handleMinimize = async () => {
    await minimizeWindow()
  }
  const handleToggleMax = async () => {
    const next = await toggleMaximizeWindow()
    setIsMaximized(next)
  }
  const handleClose = async () => {
    await closeWindow()
  }

  /**
   * 顶栏空白区域鼠标按下:启动延迟拖拽 + 双击最大化检测。
   *
   * 状态机(参考 sidebar.tsx:1881 已验证模式):
   * - 第一次 mousedown:启动 250ms timer,到期触发 startWindowDrag
   * - 250ms 内 mouseup:取消 timer(纯点击,不拖拽)
   * - 250ms 内第二次 mousedown:取消 timer + 触发 toggleMaximizeWindow(双击最大化)
   * - 250ms 后第二次 mousedown:已是拖拽中,系统接管,不处理
   *
   * 该模式同时解决:
   * - 原 P0-2:拖拽三重触发(删除 data-tauri-drag-region,仅 JS 处理)
   * - 原 P0-3:双击最大化失效(mousedown 立即拖拽,浏览器无法识别 dblclick)
   */
  const handleDragRegionMouseDown = (e: React.MouseEvent) => {
    if (!isDesktop || e.button !== 0) return
    const target = e.target as HTMLElement
    // 跳过交互元素(标签/按钮/输入框),让它们的点击正常触发
    if (target.closest('a, button, [role="button"], input, textarea, select')) return
    // 跳过工作区卡片(只在顶栏空白处拖拽)
    if (target.closest('[data-workspace-card]')) return

    const now = Date.now()
    const sinceLast = now - lastMouseDownAt.current

    // 250ms 内第二次 mousedown = 双击 → 取消拖拽 + 触发最大化
    if (sinceLast < DOUBLE_CLICK_MS && dragTimer.current) {
      clearTimeout(dragTimer.current)
      dragTimer.current = null
      lastMouseDownAt.current = 0 // 重置,避免三次点击连续触发
      void handleToggleMax()
      return
    }

    // 第一次 mousedown → 启动延迟拖拽
    lastMouseDownAt.current = now
    if (dragTimer.current) clearTimeout(dragTimer.current)
    dragTimer.current = setTimeout(() => {
      void startWindowDrag()
      dragTimer.current = null
    }, DOUBLE_CLICK_MS)
  }

  // mouseup/leave 时取消拖拽 timer(纯点击场景,不触发拖拽)
  const cancelDragTimer = () => {
    if (dragTimer.current) {
      clearTimeout(dragTimer.current)
      dragTimer.current = null
    }
  }

  return (
    // 外层 wrapper:顶栏 + 工作区卡片垂直排列
    // pt-2 mb-2 mr-2:顶部 8px 间距在 wrapper 内部(可响应鼠标事件)
    // 注意:不再在外层加 cursor-move(原实现让 TagsView 标签也显示 move 光标,误导用户)
    <div
      className="relative flex min-h-0 flex-1 flex-col pt-2 mb-2 mr-2"
      onMouseDown={handleDragRegionMouseDown}
      onMouseUp={cancelDragTimer}
      onMouseLeave={cancelDragTimer}
    >
      {/* P0-1:8 方向 resize 区域(仅桌面端 + 非最大化状态)
          - 4 边:上/下/左/右(h-1/w-1=4px,内缩 8px 避开角落)
          - 4 角:左上/右上/左下/右下(w-2 h-2=8px,z 更高覆盖边交叉点)
          - z-[9999] 边,z-[10000] 角,窗口控制按钮 z-[10001] 始终最上(防止按钮被遮挡)
          - 最大化时不渲染(Windows 原生行为:最大化窗口不可 resize) */}
      {isDesktop && !isMaximized && (
        <>
          <div
            onMouseDown={(e) => {
              if (e.button === 0) void startResize('n')
            }}
            className="fixed top-0 left-8 right-8 h-1 z-[9999] cursor-n-resize"
          />
          <div
            onMouseDown={(e) => {
              if (e.button === 0) void startResize('s')
            }}
            className="fixed bottom-0 left-8 right-8 h-1 z-[9999] cursor-s-resize"
          />
          <div
            onMouseDown={(e) => {
              if (e.button === 0) void startResize('w')
            }}
            className="fixed left-0 top-8 bottom-8 w-1 z-[9999] cursor-w-resize"
          />
          <div
            onMouseDown={(e) => {
              if (e.button === 0) void startResize('e')
            }}
            className="fixed right-0 top-8 bottom-8 w-1 z-[9999] cursor-e-resize"
          />
          <div
            onMouseDown={(e) => {
              if (e.button === 0) void startResize('nw')
            }}
            className="fixed top-0 left-0 w-2 h-2 z-[10000] cursor-nw-resize"
          />
          <div
            onMouseDown={(e) => {
              if (e.button === 0) void startResize('ne')
            }}
            className="fixed top-0 right-0 w-2 h-2 z-[10000] cursor-ne-resize"
          />
          <div
            onMouseDown={(e) => {
              if (e.button === 0) void startResize('sw')
            }}
            className="fixed bottom-0 left-0 w-2 h-2 z-[10000] cursor-sw-resize"
          />
          <div
            onMouseDown={(e) => {
              if (e.button === 0) void startResize('se')
            }}
            className="fixed bottom-0 right-0 w-2 h-2 z-[10000] cursor-se-resize"
          />
        </>
      )}

      {/* 顶栏:TagsView 在 MainShell 卡片外面上方(兄弟节点结构)
          - 高度 h-[32px]
          - 无卡片背景(透明),TagsView 自带 bg-muted/70 rounded-lg 独立呈现
          - cursor-default:覆盖外层(避免 TagsView 标签继承 cursor-move 误导)
          - onMouseDown/onMouseUp/onMouseLeave:统一拖拽状态机(见 handleDragRegionMouseDown)
          - 已删除 data-tauri-drag-region(原实现三重触发 + 注释明确说不生效) */}
      <div
        className="flex h-[32px] shrink-0 items-center gap-2 select-none cursor-default"
        onMouseDown={handleDragRegionMouseDown}
        onMouseUp={cancelDragTimer}
        onMouseLeave={cancelDragTimer}
      >
        <React.Suspense fallback={null}>
          {/* 包装层:flex-1 让 TagsView 占满中间区域,与右侧按钮同一排
              已删除 data-tauri-drag-region(避免与父 div 嵌套重复处理) */}
          <div className="flex h-full min-w-0 flex-1 items-center overflow-hidden">
            <TagsView />
          </div>
        </React.Suspense>

        {/* 右侧:窗口控制按钮(Min/Max/Close),仅桌面端 isDesktop 显示
            z-[10001]:高于 8 方向 resize 区域(z-9999/10000),防止按钮被透明 resize 遮挡 */}
        {isDesktop && (
          <div
            className="relative z-[10001] flex h-6 shrink-0 items-center gap-0.5 rounded-md"
            data-window-controls
          >
            <WindowControlButton
              onClick={handleMinimize}
              ariaLabel="最小化"
              icon={<Minus className="h-3.5 w-3.5" />}
            />
            <WindowControlButton
              onClick={handleToggleMax}
              ariaLabel={isMaximized ? '还原' : '最大化'}
              icon={
                isMaximized ? (
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
        )}
      </div>

      {/* 工作区卡片:只包含 main 内容,mt-2 与顶栏分隔 8px
          - bg-shell-panel rounded-xl 保持卡片视觉
          - flex-1 + min-h-0 填充剩余高度
          - overflow-hidden 裁剪子元素溢出 + 保持圆角不被覆盖
          - cursor-default:覆盖外层(工作区内是默认光标) */}
      <div
        className="bg-shell-panel relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl mt-2 cursor-default"
        data-workspace-card
      >
        <main
          id="main"
          tabIndex={-1}
          className="no-scrollbar flex-1 overflow-y-auto p-4 md:p-6 lg:p-8"
        >
          {children}
        </main>
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
        'inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-sm',
        'text-foreground/80 transition-colors',
        'hover:bg-accent hover:text-foreground',
        'focus:outline-none focus-visible:bg-accent',
        variant === 'close' && 'hover:bg-red-500/15 hover:text-red-600 dark:hover:text-red-400',
      )}
    >
      {icon}
    </button>
  )
}

/** 还原图标(用 lucide-react 的 `Copy` 不可表达,自绘最小实现) */
function RestoreIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1" {...props}>
      <rect x="2.5" y="2.5" width="6" height="6" rx="1" />
      <path d="M4 0.5 H10.5 V7" />
    </svg>
  )
}

export default MainShell
