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
  Star,
  ChevronDown,
  Trash2,
  Clock,
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

/** 收藏项(跨端共享,与 stores/work-panel.ts FavoriteItem 一致) */
export interface WorkPanelFavoriteItem {
  url: string
  title: string
  addedAt?: number
}

/** 最近访问项(跨端共享,与 stores/work-panel.ts RecentUrlItem 一致) */
export interface WorkPanelRecentUrlItem {
  url: string
  title: string
  visitedAt?: number
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
  /** 当前页是否已收藏 */
  isFavorite?: boolean
  /** 切换收藏状态 */
  onToggleFavorite?: () => void
  /** 收藏夹列表(P3+:用于 dropdown 面板) */
  favorites?: WorkPanelFavoriteItem[]
  /** 最近访问列表(P3+:用于 dropdown 面板) */
  recentUrls?: WorkPanelRecentUrlItem[]
  /** 从 dropdown 列表选择 URL 时触发(导航) */
  onSelectFromList?: (url: string) => void
  /** 从 dropdown 移除收藏 */
  onRemoveFavorite?: (url: string) => void
  /** 清空历史记录 */
  onClearHistory?: () => void
  /** Tab 列表 */
  tabs: WorkPanelTabItem[]
  activeTabId: string | null
  onTabChange: (id: string) => void
  onTabClose?: (id: string) => void
  onNewTab?: () => void
  /** 拖拽 Tab 排序回调(P3++:HTML5 DnD) */
  onTabReorder?: (fromId: string, toId: string) => void
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
      isFavorite,
      onToggleFavorite,
      favorites,
      recentUrls,
      onSelectFromList,
      onRemoveFavorite,
      onClearHistory,
      tabs,
      activeTabId,
      onTabChange,
      onTabClose,
      onNewTab,
      onTabReorder,
      children,
      className,
    },
    ref,
  ) => {
    // P3+:收藏 + 历史 dropdown 面板状态
    const [dropdownOpen, setDropdownOpen] = React.useState(false)
    const [dropdownTab, setDropdownTab] = React.useState<'favorites' | 'history'>('favorites')
    const dropdownRef = React.useRef<HTMLDivElement>(null)
    const dropdownTriggerRef = React.useRef<HTMLButtonElement>(null)

    // P3++:Tab 拖拽状态(记录被拖动的 tab id,用于半透明 + 防止自己 drop 到自己)
    const [draggedTabId, setDraggedTabId] = React.useState<string | null>(null)

    // click-away 关闭 dropdown
    React.useEffect(() => {
      if (!dropdownOpen) return
      const handler = (e: MouseEvent) => {
        const target = e.target as Node
        if (
          dropdownRef.current?.contains(target) ||
          dropdownTriggerRef.current?.contains(target)
        ) {
          return
        }
        setDropdownOpen(false)
      }
      document.addEventListener('mousedown', handler)
      return () => document.removeEventListener('mousedown', handler)
    }, [dropdownOpen])

    // ESC 关闭 dropdown
    React.useEffect(() => {
      if (!dropdownOpen) return
      const handler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setDropdownOpen(false)
      }
      document.addEventListener('keydown', handler)
      return () => document.removeEventListener('keydown', handler)
    }, [dropdownOpen])

    if (!open) return null

    // 是否启用 dropdown(需要 onSelectFromList + 至少一个列表数据源)
    const dropdownEnabled =
      !!onSelectFromList && (!!favorites || !!recentUrls)

    // 当前 tab 列表数据
    const dropdownItems =
      dropdownTab === 'favorites' ? favorites ?? [] : recentUrls ?? []

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

          {onToggleFavorite && (
            <ToolbarButton
              onClick={onToggleFavorite}
              title={isFavorite ? '取消收藏' : '添加收藏'}
              className={isFavorite ? 'text-amber-500 hover:text-amber-500' : undefined}
            >
              <Star className={cn('h-4 w-4', isFavorite && 'fill-current')} />
            </ToolbarButton>
          )}
          {dropdownEnabled && (
            <ToolbarButton
              ref={dropdownTriggerRef}
              onClick={() => setDropdownOpen((v) => !v)}
              title="收藏和历史"
              className={dropdownOpen ? 'bg-muted text-foreground' : undefined}
            >
              <ChevronDown className="h-4 w-4" />
            </ToolbarButton>
          )}
          {onOpenExternal && (
            <ToolbarButton onClick={onOpenExternal} title="在外部浏览器打开">
              <ExternalLink className="h-4 w-4" />
            </ToolbarButton>
          )}
          <ToolbarButton onClick={onClose} title="关闭面板">
            <X className="h-4 w-4" />
          </ToolbarButton>
        </div>

        {/* P3+:收藏 + 历史 dropdown 面板 */}
        {dropdownOpen && dropdownEnabled && (
          <div
            ref={dropdownRef}
            role="dialog"
            aria-label="收藏和历史"
            className="absolute right-2 top-11 z-50 flex w-72 flex-col rounded-md border border-border bg-popover p-1.5 shadow-md animate-in fade-in-0 zoom-in-95 duration-100"
          >
            {/* tab 切换 */}
            <div className="flex items-center gap-0.5 px-1 pb-1">
              <button
                type="button"
                onClick={() => setDropdownTab('favorites')}
                className={cn(
                  'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors',
                  dropdownTab === 'favorites'
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Star className="h-3 w-3" />
                <span>收藏</span>
                {favorites && favorites.length > 0 && (
                  <span className="text-[10px] text-muted-foreground">{favorites.length}</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setDropdownTab('history')}
                className={cn(
                  'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors',
                  dropdownTab === 'history'
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Clock className="h-3 w-3" />
                <span>历史</span>
                {recentUrls && recentUrls.length > 0 && (
                  <span className="text-[10px] text-muted-foreground">{recentUrls.length}</span>
                )}
              </button>
            </div>

            {/* 列表 */}
            <div className="max-h-60 overflow-y-auto py-0.5">
              {dropdownItems.length === 0 ? (
                <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                  暂无{dropdownTab === 'favorites' ? '收藏' : '历史'}
                </div>
              ) : (
                dropdownItems.map((item) => (
                  <div
                    key={item.url}
                    className="group flex items-center gap-1 rounded px-1.5 py-1 hover:bg-muted"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onSelectFromList?.(item.url)
                        setDropdownOpen(false)
                      }}
                      className="flex-1 truncate text-left text-xs text-foreground"
                      title={item.url}
                    >
                      {item.title || item.url}
                    </button>
                    {dropdownTab === 'favorites' && onRemoveFavorite && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onRemoveFavorite(item.url)
                        }}
                        className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                        title="移除收藏"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* footer:清空(仅历史 tab 且非空) */}
            {dropdownTab === 'history' && dropdownItems.length > 0 && onClearHistory && (
              <div className="mt-1 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    onClearHistory()
                    setDropdownOpen(false)
                  }}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>清空历史</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 栏(仅多 Tab 时显示) */}
        {tabs.length > 0 && (
          <div className="flex items-center gap-0.5 px-2 pb-1">
            <div className="flex flex-1 items-center gap-0.5 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onTabChange(tab.id)}
                  draggable={!!onTabReorder}
                  onDragStart={(e) => {
                    if (!onTabReorder) return
                    e.dataTransfer.setData('text/plain', tab.id)
                    e.dataTransfer.effectAllowed = 'move'
                    setDraggedTabId(tab.id)
                  }}
                  onDragEnd={() => setDraggedTabId(null)}
                  onDragOver={(e) => {
                    if (!onTabReorder) return
                    // 必须 preventDefault 才能触发 onDrop
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                  }}
                  onDrop={(e) => {
                    if (!onTabReorder) return
                    e.preventDefault()
                    const fromId = e.dataTransfer.getData('text/plain')
                    setDraggedTabId(null)
                    if (fromId && fromId !== tab.id) {
                      onTabReorder(fromId, tab.id)
                    }
                  }}
                  className={cn(
                    'group inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors',
                    tab.id === activeTabId
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-muted',
                    // P3++:拖动中半透明,drop target 高亮
                    draggedTabId === tab.id && 'opacity-40',
                    draggedTabId && draggedTabId !== tab.id && 'ring-1 ring-primary/30',
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
