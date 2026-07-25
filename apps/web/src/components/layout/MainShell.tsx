'use client'

import * as React from 'react'
import { Minus, Square, X } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { useDesktop } from '@/hooks/use-desktop'
import {
  minimizeWindow,
  toggleMaximizeWindow,
  closeWindow,
} from '@/lib/tauri-bridge'
import { cn } from '@/lib/utils'
import { TagsView } from '@/components/layout/TagsView'

/**
 * MainShell — (main) 路由组的工作区面板容器
 *
 * 2026-07-26 用户反馈(第四次修订):
 * - TagsView + 窗口控制按钮(Min/Max/Close)融合到 MainShell 顶部
 * - 严格匹配右侧工作展示区(main)同宽(在 rounded-xl my-2 mr-2 容器内)
 * - 仅桌面端显示(isDesktop=true)
 * - 顶栏作为 Tauri drag region,TagsView/按钮 占据同一排
 *
 * 布局:
 *   <div bg-shell-panel rounded-xl my-2 mr-2>
 *     <div h-10 drag-region>          ← 桌面端独有顶栏
 *       <TagsView flex-1 />            ← 页面标签容器
 *       <Min|Max|Close />              ← 窗口控制三按钮
 *     </div>
 *     <main p-4>                       ← 工作区内容
 *       {children}
 *     </main>
 *   </div>
 *
 * 工作区面板样式说明:
 * - my-2 mr-2:与 GlobalShell 的 Sidebar 之间留 8px 间距,与视口顶部/底部留 8px 间距
 * - main 的 p-4 md:p-6 lg:p-8:响应式 padding,内容不贴边
 * - main 的 thin-scroll flex-1 overflow-y-auto:细滚动条 + 独立滚动
 */
export function MainShell({ children }: { children: React.ReactNode }) {
  // 显式订阅以触发 (main) 路由组的认证态变化
  useAuthStore((s) => s.isAuthenticated)

  const { isDesktop, isMaximized } = useDesktop()
  const [localMaximized, setLocalMaximized] = React.useState(isMaximized)

  React.useEffect(() => {
    setLocalMaximized(isMaximized)
  }, [isMaximized])

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
    <div className="bg-shell-panel relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl my-2 mr-2">
      {/* 2026-07-26 用户反馈:TagsView + 窗口控制按钮融合到 MainShell 顶部
          - 严格匹配 main 同宽(在 rounded-xl my-2 mr-2 容器内,不会横跨到 WebWorkPanel)
          - 仅桌面端显示(isDesktop=true)
          - 作为 Tauri drag region,TagsView 内部 a/button 由 Tauri 2 自动从 drag region 排除
          - TagsView 顶替"拖拽空白区"占据左侧 flex-1,按钮组在右侧 */}
      {isDesktop && (
        <div
          data-tauri-drag-region
          className="flex h-10 shrink-0 items-center gap-2 px-2 select-none"
        >
          <React.Suspense fallback={null}>
            {/* 包装层:flex-1 让 TagsView 占满中间区域,与右侧按钮同一排 */}
            <div
              className="flex h-full min-w-0 flex-1 items-center overflow-hidden"
              data-tagsview-wrapper
            >
              <TagsView />
            </div>
          </React.Suspense>

          {/* 右侧:窗口控制按钮(Min/Max/Close),在 TagsView 之后 */}
          <div className="flex h-full shrink-0 items-center" data-window-controls>
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
      )}

      <main
        id="main"
        tabIndex={-1}
        className="thin-scroll flex-1 overflow-y-auto p-4 md:p-6 lg:p-8"
      >
        {children}
      </main>
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

export default MainShell
