'use client'

import * as React from 'react'
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  X,
  Plus,
  ExternalLink,
  Loader2,
  Lock,
} from 'lucide-react'
import { cn } from '../lib/utils.js'
import { Input } from './input.js'
import { ResizableHandle } from './resizable.js'

/**
 * 工作展示区容器(通用,跨端共享)。
 * 包含:左侧拖拽手柄 + 工具栏(地址栏/前进后退/刷新/关闭) + Tab 栏 + 内容区。
 *
 * 各端通过 children 注入具体 WebView 实现(web=iframe+降级, desktop=Tauri WebView2)。
 * 纯展示组件,所有状态由外部 store 控制(受控模式)。
 *
 * 样式守门:
 * - 禁用分割线,用 bg 色阶对比区分区域(工具栏 bg-muted/40,内容区 bg-background)
 * - 圆角用 rounded-lg(8px),禁用 rounded-full
 * - 图标+中文同行依赖全局 --text-vcenter-offset 变量自动校正
 */

export interface WorkPanelTabItem {
  id: string
  title: string
  type?: string
}

export interface WorkPanelProps {
  /** 是否展开 */
  open: boolean
  /** 面板宽度(px) */
  width: number
  /** 拖拽调整宽度回调(delta 像素) */
  onResize: (delta: number) => void
  /** 拖拽开始(用于禁用过渡动画) */
  onResizeStart?: () => void
  /** 拖拽结束 */
  onResizeEnd?: () => void
  /** 关闭面板 */
  onClose: () => void
  /** 地址栏值 */
  addressValue: string
  onAddressChange: (v: string) => void
  onAddressSubmit: () => void
  /** 工具栏动作 */
  onBack: () => void
  onForward: () => void
  onReload: () => void
  onStop?: () => void
  onOpenExternal?: () => void
  /** 导航能力 */
  canBack: boolean
  canForward: boolean
  isLoading?: boolean
  /** 当前是否安全连接(https) */
  isSecure?: boolean
  /** Tab 列表 */
  tabs: WorkPanelTabItem[]
  activeTabId: string | null
  onTabChange: (id: string) => void
  onTabClose?: (id: string) => void
  onNewTab?: () => void
  /** 内容区(各端注入 WebViewFrame 或自定义实现) */
  children?: React.ReactNode
  className?: string
}

export const WorkPanel = React.forwardRef<HTMLDivElement, WorkPanelProps>(
  (
    {
      open,
      width,
      onResize,
      onResizeStart,
      onResizeEnd,
      onClose,
      addressValue,
      onAddressChange,
      onAddressSubmit,
      onBack,
      onForward,
      onReload,
      onStop,
      onOpenExternal,
      canBack,
      canForward,
      isLoading,
      isSecure,
      tabs,
      activeTabId,
      onTabChange,
      onTabClose,
      onNewTab,
      children,
      className,
    },
    ref,
  ) => {
    if (!open) return null

    return (
      <div
        ref={ref}
        className={cn(
          'relative flex h-full flex-col border-l border-border bg-card',
          'animate-in slide-in-from-right duration-200',
          className,
        )}
        style={{ width }}
      >
        {/* 左侧拖拽手柄 */}
        <ResizableHandle
          direction="left"
          onResize={onResize}
          onResizeStart={onResizeStart}
          onResizeEnd={onResizeEnd}
        />

        {/* 顶部工具栏:导航按钮 + 地址栏 + 动作 */}
        <div className="flex items-center gap-1 px-2 py-1.5">
          <ToolbarButton onClick={onBack} disabled={!canBack} title="后退">
            <ArrowLeft className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={onForward} disabled={!canForward} title="前进">
            <ArrowRight className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={isLoading ? onStop : onReload}
            title={isLoading ? '停止' : '刷新'}
          >
            {isLoading ? (
              <X className="h-4 w-4" />
            ) : (
              <RotateCw className="h-4 w-4" />
            )}
          </ToolbarButton>

          {/* 地址栏 */}
          <form
            className="flex flex-1 items-center"
            onSubmit={(e) => {
              e.preventDefault()
              onAddressSubmit()
            }}
          >
            <div className="flex w-full items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1">
              {isSecure === false ? null : isSecure ? (
                <Lock className="h-3 w-3 shrink-0 text-emerald-500" />
              ) : null}
              <Input
                type="text"
                value={addressValue}
                onChange={(e) => onAddressChange(e.target.value)}
                placeholder="输入网址或搜索..."
                className="h-5 border-0 bg-transparent px-0 text-xs shadow-none focus-visible:ring-0"
              />
              {isLoading && <Loader2 className="h-3 w-3 shrink-0 animate-spin text-muted-foreground" />}
            </div>
          </form>

          {onOpenExternal && (
            <ToolbarButton onClick={onOpenExternal} title="在外部浏览器打开">
              <ExternalLink className="h-4 w-4" />
            </ToolbarButton>
          )}
          <ToolbarButton onClick={onClose} title="关闭面板">
            <X className="h-4 w-4" />
          </ToolbarButton>
        </div>

        {/* Tab 栏(仅多 Tab 时显示) */}
        {tabs.length > 0 && (
          <div className="flex items-center gap-0.5 px-2 pb-1">
            <div className="flex flex-1 items-center gap-0.5 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onTabChange(tab.id)}
                  className={cn(
                    'group inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors',
                    tab.id === activeTabId
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  <span className="max-w-[120px] truncate">{tab.title}</span>
                  {onTabClose && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation()
                        onTabClose(tab.id)
                      }}
                      className="rounded p-0.5 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </span>
                  )}
                </button>
              ))}
            </div>
            {onNewTab && (
              <ToolbarButton onClick={onNewTab} title="新建标签页" size="sm">
                <Plus className="h-3.5 w-3.5" />
              </ToolbarButton>
            )}
          </div>
        )}

        {/* 内容区 */}
        <div className="flex-1 overflow-hidden p-2">{children}</div>
      </div>
    )
  },
)
WorkPanel.displayName = 'WorkPanel'

/** 工具栏按钮(内部组件,图标垂直对齐由全局 CSS 自动处理) */
interface ToolbarButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'sm' | 'md'
}
const ToolbarButton = React.forwardRef<HTMLButtonElement, ToolbarButtonProps>(
  ({ className, size = 'md', ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40',
        size === 'sm' ? 'h-6 w-6' : 'h-7 w-7',
        className,
      )}
      {...props}
    />
  ),
)
ToolbarButton.displayName = 'ToolbarButton'
