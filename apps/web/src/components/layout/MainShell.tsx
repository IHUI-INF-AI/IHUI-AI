'use client'

import * as React from 'react'
import { Minus, Square, X } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { useDesktop } from '@/hooks/use-desktop'
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
  onSystemThemeChange,
} from '@/lib/tauri-bridge'
import { cn } from '@/lib/utils'
import { TagsView } from '@/components/layout/TagsView'

/**
 * MainShell — (main) 路由组的工作区面板容器
 *
 * 2026-07-26 用户反馈(第九次修订):
 * - TagsView 放到 MainShell 卡片容器**外面、上方**(不再是容器内部最顶部子元素)
 * - 顶栏(h-[44px])与工作区卡片(rounded-xl bg-shell-panel)是兄弟节点,垂直排列
 * - 总顶部 = my-2(8px) + 44px = 52px(用户要求"统一减52"给标签组件)
 * - 顶栏无卡片背景(透明),让 TagsView 自身 bg-muted/70 圆角样式独立呈现
 * - 工作区卡片 mt-2 与顶栏分隔 8px,只包含 main 内容
 * - 窗口控制按钮(Min/Max/Close)仅桌面端 isDesktop 显示,与 TagsView 同一排
 *
 * 布局:
 *   <div my-2 mr-2 flex flex-col>     ← 外层 wrapper(顶栏 + 工作区卡片)
 *     <div h-[44px] drag-region>      ← 顶栏(独立,无卡片背景)
 *       <TagsView flex-1 />            ← 页面标签容器(自带 bg-muted/70 rounded-lg)
 *       <Min|Max|Close />              ← 仅桌面端 isDesktop
 *     </div>
 *     <div bg-shell-panel rounded-xl mt-2 flex-1>  ← 工作区卡片(只含 main)
 *       <main p-4>{children}</main>
 *     </div>
 *   </div>
 */
export function MainShell({ children }: { children: React.ReactNode }) {
  // 显式订阅以触发 (main) 路由组的认证态变化
  useAuthStore((s) => s.isAuthenticated)

  const { isDesktop, isMaximized } = useDesktop()
  const { setTheme } = useTheme()
  const [localMaximized, setLocalMaximized] = React.useState(isMaximized)

  React.useEffect(() => {
    setLocalMaximized(isMaximized)
  }, [isMaximized])

  // P0-2: 监听窗口最大化状态变化(Tauri onResized 事件,2026-07-27 立)
  // 补充 useDesktop 里的浏览器 window.resize 监听:Tauri 最大化时 webview resize 事件可能不触发,
  // 用 Tauri 原生 onResized 更可靠。两条监听都 setLocalMaximized,收敛到同一值不冲突。
  React.useEffect(() => {
    if (!isDesktop) return
    const cleanup = onMaximizeChange(setLocalMaximized)
    return cleanup
  }, [isDesktop])

  // P1-7: 系统主题跟随(桌面端监听 OS 主题变化,自动切换应用主题,2026-07-27 立)
  // next-themes 的 prefers-color-scheme 在 Tauri WebView 中可能不响应 OS 主题切换,
  // 用 Tauri onThemeChanged 事件主动推送,调用 setTheme 强制更新应用主题。
  React.useEffect(() => {
    if (!isDesktop) return
    const cleanup = onSystemThemeChange((t) => setTheme(t))
    return cleanup
  }, [isDesktop, setTheme])

  // P1-8: 窗口位置记忆(挂载时恢复 + 卸载/关闭时保存,2026-07-27 立)
  // restoreWindowState 在 Rust 端启动时已自动调用,此处前端再调一次作双保险。
  // saveWindowState 在组件卸载 + beforeunload 时保存,确保位置/尺寸/最大化状态持久化。
  React.useEffect(() => {
    if (!isDesktop) return
    void restoreWindowState()
    const handleBeforeUnload = () => {
      void saveWindowState()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
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
  const handleClose = async () => {
    await closeWindow()
  }

  return (
    // 外层 wrapper:顶栏 + 工作区卡片垂直排列
    // 2026-07-26:my-2 -> pt-2 mb-2,让顶部 8px 间距在 wrapper 内部(可响应鼠标事件)
    // 加 onMouseDown/onDoubleClick/cursor-move:顶部间距区域也可拖拽窗口 + 双击最大化
    <div
      className="relative flex min-h-0 flex-1 flex-col pt-2 mb-2 mr-2 cursor-move"
      onMouseDown={handleDragRegionMouseDown}
      onDoubleClick={handleDragRegionDoubleClick}
    >
      {/* P0-1: 8 个透明 resize 区域(4 边 + 4 角,2026-07-27 立)
          - fixed 定位相对于窗口(非文档),z-index 9999/10000 在所有内容之上
          - 4 边:h-1/w-1(4px)细长条,内缩 8px(left-2/right-2/top-2/bottom-2)避免挡角落
          - 4 角:w-2 h-2(8px)小方块,在窗口四角方便抓取
          - 鼠标移到边缘显示对应方向 resize 光标(cursor-n-resize 等)
          - 仅桌面端 isDesktop 显示;左键按下(e.button===0)才触发 startResize
          - 顶栏右侧窗口控制按钮在 resize 区域之上(按钮 z-index 更高,且 resize 仅 4-8px 不挡按钮中心) */}
      {isDesktop && (
        <>
          {/* 4 边:上/下/左/右 */}
          <div
            onMouseDown={(e) => { if (e.button === 0) void startResize('n') }}
            className="fixed top-0 left-2 right-2 h-1 z-[9999] cursor-n-resize"
            aria-hidden="true"
          />
          <div
            onMouseDown={(e) => { if (e.button === 0) void startResize('s') }}
            className="fixed bottom-0 left-2 right-2 h-1 z-[9999] cursor-s-resize"
            aria-hidden="true"
          />
          <div
            onMouseDown={(e) => { if (e.button === 0) void startResize('w') }}
            className="fixed left-0 top-2 bottom-2 w-1 z-[9999] cursor-w-resize"
            aria-hidden="true"
          />
          <div
            onMouseDown={(e) => { if (e.button === 0) void startResize('e') }}
            className="fixed right-0 top-2 bottom-2 w-1 z-[9999] cursor-e-resize"
            aria-hidden="true"
          />
          {/* 4 角:左上/右上/左下/右下(z-10000 比边更高,覆盖边的交叉点) */}
          <div
            onMouseDown={(e) => { if (e.button === 0) void startResize('nw') }}
            className="fixed top-0 left-0 w-2 h-2 z-[10000] cursor-nw-resize"
            aria-hidden="true"
          />
          <div
            onMouseDown={(e) => { if (e.button === 0) void startResize('ne') }}
            className="fixed top-0 right-0 w-2 h-2 z-[10000] cursor-ne-resize"
            aria-hidden="true"
          />
          <div
            onMouseDown={(e) => { if (e.button === 0) void startResize('sw') }}
            className="fixed bottom-0 left-0 w-2 h-2 z-[10000] cursor-sw-resize"
            aria-hidden="true"
          />
          <div
            onMouseDown={(e) => { if (e.button === 0) void startResize('se') }}
            className="fixed bottom-0 right-0 w-2 h-2 z-[10000] cursor-se-resize"
            aria-hidden="true"
          />
        </>
      )}
      {/* 顶栏:TagsView 在 MainShell 卡片外面上方(2026-07-26 第九次修订)
          - 高度 h-[44px],总顶部 = my-2(8px) + 44px = 52px(用户要求"统一减52")
          - 无卡片背景(透明),TagsView 自带 bg-muted/70 rounded-lg 独立呈现
          - 桌面端 data-tauri-drag-region 作为 Tauri 拖拽区
          - 历史教训:之前 TagsView 在 MainShell 卡片内部最顶部,用户反馈
            "div 应该在右侧工作展示区容器的外面 上面 而不是包含在里头放到最顶部",
            改为兄弟节点结构(顶栏在外,工作区卡片在下) */}
      <div
        data-tauri-drag-region
        data-is-desktop={isDesktop ? 'true' : 'false'}
        onMouseDown={handleDragRegionMouseDown}
        onDoubleClick={handleDragRegionDoubleClick}
        className="flex h-[32px] shrink-0 items-center gap-2 select-none"
      >
        <React.Suspense fallback={null}>
          {/* 包装层:flex-1 让 TagsView 占满中间区域,与右侧按钮同一排
              2026-07-26 加 data-tauri-drag-region:标签栏空白区域(标签右侧)也可拖拽窗口,
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
          - overflow-hidden 裁剪子元素溢出 + 保持圆角不被覆盖 */}
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
