'use client'

import * as React from 'react'
import { Minus, Square, X } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { useDesktop } from '@/hooks/use-desktop'
import { minimizeWindow, toggleMaximizeWindow, closeWindow } from '@/lib/tauri-bridge'
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
    // 外层 wrapper:顶栏 + 工作区卡片垂直排列,my-2 mr-2 与 Sidebar/AISidePanel 对齐
    <div className="relative flex min-h-0 flex-1 flex-col my-2 mr-2">
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
        className="flex h-[36px] shrink-0 items-center gap-2 select-none"
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

      {/* 工作区卡片:只包含 main 内容,mt-2 与顶栏分隔 8px
          - bg-shell-panel rounded-xl 保持卡片视觉
          - flex-1 + min-h-0 填充剩余高度
          - overflow-hidden 裁剪子元素溢出 + 保持圆角不被覆盖 */}
      <div className="bg-shell-panel relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl mt-2">
        <main
          id="main"
          tabIndex={-1}
          className="thin-scroll flex-1 overflow-y-auto p-4 md:p-6 lg:p-8"
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
        'inline-flex h-full w-11 items-center justify-center',
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
