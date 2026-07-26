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
 * 2026-07-26 用户反馈(第八次修订):
 * - 顶部 TagsView 区域所有端都显示(web + 桌面端统一),高度 h-[44px]
 * - 总顶部 = my-2(8px) + 44px = 52px(用户要求"统一减52"给标签组件)
 * - AISidePanel 所有端统一 top-2(8px),不需要避开 TagsView(AI 面板无标签栏)
 * - 窗口控制按钮(Min/Max/Close)仅桌面端 isDesktop 显示
 * - 顶栏作为 Tauri drag region(桌面端拖拽),TagsView/按钮 占据同一排
 *
 * 布局:
 *   <div bg-shell-panel rounded-xl my-2 mr-2>
 *     <div h-[44px] drag-region>      ← 所有端都有顶栏
 *       <TagsView flex-1 />            ← 页面标签容器
 *       <Min|Max|Close />              ← 仅桌面端 isDesktop
 *     </div>
 *     <main p-4>                       ← 工作区内容
 *       {children}
 *     </main>
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
      {/* 顶部 TagsView 区域:所有端都显示(2026-07-26 修复)
          - 高度 h-[44px],总顶部 = my-2(8px) + 44px = 52px(用户要求"统一减52")
          - TagsView 占据左侧 flex-1,窗口控制按钮(仅桌面端)在右侧
          - 桌面端 data-tauri-drag-region 作为 Tauri 拖拽区
          - 历史教训:之前仅桌面端 isDesktop 渲染顶栏,web 端无 TagsView;
            用户反馈"把标签组件放到这52的区域",改为所有端都渲染,TagsView 统一显示 */}
      <div
        data-tauri-drag-region
        data-is-desktop={isDesktop ? 'true' : 'false'}
        className="flex h-[44px] shrink-0 items-center gap-2 px-2 select-none border-b border-border"
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

        {/* 右侧:窗口控制按钮(Min/Max/Close),仅桌面端 isDesktop 显示 */}
        {isDesktop && (
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
        )}
      </div>

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
