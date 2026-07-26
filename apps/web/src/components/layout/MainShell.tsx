'use client'
/* eslint-disable jsx-a11y/no-static-element-interactions -- 桌面端窗口控制(拖拽/resize/双击最大化)是鼠标专用交互,不适用于键盘/屏幕阅读器 */

import * as React from 'react'
import { Minus, Square, X } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { useDesktop, useSystemTheme } from '@/hooks/use-desktop'
import { useTheme } from '@/hooks/use-theme'
import {
  minimizeWindow,
  toggleMaximizeWindow,
  closeWindow,
  startWindowDrag,
  startResize,
  onMaximizeChange,
  restoreWindowState,
  saveWindowState,
} from '@/lib/tauri-bridge'
import { cn } from '@/lib/utils'
import { TagsView } from '@/components/layout/TagsView'

/**
 * MainShell — (main) 路由组的工作区面板容器
 *
 * 2026-07-27 第十次修订(完整桌面端能力版):
 * - TagsView 放到 MainShell 卡片容器**外面、上方**(兄弟节点结构)
 * - 顶栏(h-[32px])与工作区卡片(rounded-xl bg-shell-panel)垂直排列
 * - 顶栏无卡片背景,TagsView 自带 bg-muted/70 圆角样式独立呈现
 * - 工作区卡片 mt-2 与顶栏分隔 8px,只包含 main 内容
 *
 * 桌面端(Tauri)能力(仅 isDesktop 时启用):
 * - P0-1:8 方向 Resize 边缘缩放(4 边 + 4 角,透明 fixed,z-index 最高)
 * - P0-2:最大化按钮图标切换(onMaximizeChange 监听 onResized)
 * - 窗口拖拽:startWindowDrag(标签栏空白区域 + 顶部 8px 间距区域 + 双击最大化)
 * - P1-7:系统主题跟随(useSystemTheme hook + next-themes setTheme 联动)
 * - P1-8:窗口位置记忆(挂载恢复 + beforeunload 保存)
 *
 * 布局:
 *   <div pt-2 mb-2 mr-2 cursor-move>     ← 外层 wrapper(顶栏 + 工作区卡片)
 *     <Resize 8 方向 fixed>                ← 仅桌面端
 *     <div h-[32px] drag-region>          ← 顶栏(独立,无卡片背景)
 *       <TagsView flex-1 />                ← 页面标签容器
 *       <Min|Max|Close />                  ← 仅桌面端 isDesktop
 *     </div>
 *     <div bg-shell-panel rounded-xl mt-2 flex-1>  ← 工作区卡片
 *       <main p-4>{children}</main>
 *     </div>
 *   </div>
 */
export function MainShell({ children }: { children: React.ReactNode }) {
  // 显式订阅以触发 (main) 路由组的认证态变化
  useAuthStore((s) => s.isAuthenticated)

  const { isDesktop, isMaximized } = useDesktop()
  const [localMaximized, setLocalMaximized] = React.useState(isMaximized)

  React.useEffect(() => {
    setLocalMaximized(isMaximized)
  }, [isMaximized])

  // P0-2:监听 Tauri 窗口最大化状态变化(比浏览器 resize 更可靠)
  React.useEffect(() => {
    if (!isDesktop) return
    const unlisten = onMaximizeChange(setLocalMaximized)
    return () => unlisten()
  }, [isDesktop])

  // P1-7:系统主题跟随(OS 切换深色/浅色时自动同步)
  // - useSystemTheme 同时获取初始主题 + 监听变化
  const { setTheme } = useTheme()
  const systemTheme = useSystemTheme()
  React.useEffect(() => {
    if (!isDesktop || !systemTheme) return
    setTheme(systemTheme)
  }, [isDesktop, systemTheme, setTheme])

  // P1-8:窗口位置记忆(启动恢复 + 关闭保存)
  React.useEffect(() => {
    if (!isDesktop) return
    void restoreWindowState()
    const handleClose = () => void saveWindowState()
    window.addEventListener('beforeunload', handleClose)
    return () => {
      window.removeEventListener('beforeunload', handleClose)
      void saveWindowState()
    }
  }, [isDesktop])

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

  // 2026-07-26 立:窗口拖拽 + 双击最大化(用户反馈 data-tauri-drag-region 不生效)
  // - onMouseDown:左键 + 非交互元素(空白区域)时调用 startWindowDrag()
  // - onDoubleClick:非交互元素时调用 toggleMaximizeWindow()
  // - 检查 closest('a,button,[role=button],input,textarea,select') 避免影响子元素交互
  const handleDragRegionMouseDown = (e: React.MouseEvent) => {
    if (!isDesktop || e.button !== 0) return
    const target = e.target as HTMLElement
    if (target.closest('a, button, [role="button"], input, textarea, select')) return
    if (target.closest('[data-workspace-card]')) return
    void startWindowDrag()
  }

  const handleDragRegionDoubleClick = (e: React.MouseEvent) => {
    if (!isDesktop) return
    const target = e.target as HTMLElement
    if (target.closest('a, button, [role="button"], input, textarea, select')) return
    if (target.closest('[data-workspace-card]')) return
    void handleToggleMax()
  }

  return (
    // 外层 wrapper:顶栏 + 工作区卡片垂直排列
    // pt-2 mb-2 mr-2:顶部 8px 间距在 wrapper 内部(可响应鼠标事件)
    // cursor-move + onMouseDown/onDoubleClick:顶部间距区域也可拖拽窗口 + 双击最大化
    <div
      className="relative flex min-h-0 flex-1 flex-col pt-2 mb-2 mr-2 cursor-move"
      onMouseDown={handleDragRegionMouseDown}
      onDoubleClick={handleDragRegionDoubleClick}
    >
      {/* P0-1:8 方向 resize 区域(仅桌面端,透明 fixed 定位,z-index 最高)
          4 边:上/下/左/右(h-1/w-1=4px,内缩 8px 避开角落)
          4 角:左上/右上/左下/右下(w-2 h-2=8px,z 更高覆盖边交叉点)
          每个 onMouseDown 调用 startResize(direction),cursor 显示对应方向 */}
      {isDesktop && (
        <>
          <div onMouseDown={(e) => { if (e.button === 0) void startResize('n') }} className="fixed top-0 left-2 right-2 h-1 z-[9999] cursor-n-resize" />
          <div onMouseDown={(e) => { if (e.button === 0) void startResize('s') }} className="fixed bottom-0 left-2 right-2 h-1 z-[9999] cursor-s-resize" />
          <div onMouseDown={(e) => { if (e.button === 0) void startResize('w') }} className="fixed left-0 top-2 bottom-2 w-1 z-[9999] cursor-w-resize" />
          <div onMouseDown={(e) => { if (e.button === 0) void startResize('e') }} className="fixed right-0 top-2 bottom-2 w-1 z-[9999] cursor-e-resize" />
          <div onMouseDown={(e) => { if (e.button === 0) void startResize('nw') }} className="fixed top-0 left-0 w-2 h-2 z-[10000] cursor-nw-resize" />
          <div onMouseDown={(e) => { if (e.button === 0) void startResize('ne') }} className="fixed top-0 right-0 w-2 h-2 z-[10000] cursor-ne-resize" />
          <div onMouseDown={(e) => { if (e.button === 0) void startResize('sw') }} className="fixed bottom-0 left-0 w-2 h-2 z-[10000] cursor-sw-resize" />
          <div onMouseDown={(e) => { if (e.button === 0) void startResize('se') }} className="fixed bottom-0 right-0 w-2 h-2 z-[10000] cursor-se-resize" />
        </>
      )}

      {/* 顶栏:TagsView 在 MainShell 卡片外面上方(兄弟节点结构)
          - 高度 h-[32px]
          - 无卡片背景(透明),TagsView 自带 bg-muted/70 rounded-lg 独立呈现
          - 桌面端 data-tauri-drag-region 作为 Tauri 拖拽区
          - onMouseDown/onDoubleClick:标签栏空白区域(标签右侧)也可拖拽窗口 + 双击最大化 */}
      <div
        data-tauri-drag-region
        data-is-desktop={isDesktop ? 'true' : 'false'}
        onMouseDown={handleDragRegionMouseDown}
        onDoubleClick={handleDragRegionDoubleClick}
        className="flex h-[32px] shrink-0 items-center gap-2 select-none"
      >
        <React.Suspense fallback={null}>
          {/* 包装层:flex-1 让 TagsView 占满中间区域,与右侧按钮同一排
              data-tauri-drag-region:标签栏空白区域(标签右侧)也可拖拽窗口,
              TagsView 内部 <a>/<button> 是交互元素,Tauri 2 自动识别不触发拖拽 */}
          <div
            className="flex h-full min-w-0 flex-1 items-center overflow-hidden"
            data-tagsview-wrapper
            data-tauri-drag-region
          >
            <TagsView />
          </div>
        </React.Suspense>

        {/* 右侧:窗口控制按钮(Min/Max/Close),仅桌面端 isDesktop 显示 */}
        {isDesktop && (
          <div className="flex h-6 shrink-0 items-center gap-0.5 rounded-md" data-window-controls>
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
        )}
      </div>

      {/* 工作区卡片:只包含 main 内容,mt-2 与顶栏分隔 8px
          - bg-shell-panel rounded-xl 保持卡片视觉
          - flex-1 + min-h-0 填充剩余高度
          - overflow-hidden 裁剪子元素溢出 + 保持圆角不被覆盖
          - cursor-default:覆盖外层 cursor-move,工作区内是默认光标 */}
      <div className="bg-shell-panel relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl mt-2 cursor-default" data-workspace-card>
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
        'inline-flex h-6 w-6 items-center justify-center rounded-sm',
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
