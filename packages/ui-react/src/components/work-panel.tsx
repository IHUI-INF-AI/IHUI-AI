// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
import { cn } from '../lib/utils'
import { Input } from './input'
import { CloseButton } from './close-button'
import { ResizableHandle } from './resizable'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from './tooltip'

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
  /** 面板宽度(px,可选 — 不传时 w-full 填充父容器,用于嵌入工作区场景) */
  width?: number
  /** 拖拽调整宽度回调(可选 — 不传时不渲染 resize handle,用于嵌入工作区场景) */
  onResize?: (delta: number) => void
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
  /** 拖拽 Tab 排序回调(P3++:HTML5 DnD)
   * - position='before' (默认):从 fromId 移到 toId 位置(原行为)
   * - position='after':从 fromId 移到 toId 之后 */
  onTabReorder?: (fromId: string, toId: string, position?: 'before' | 'after') => void
  /** i18n 文案(P4-3:不传则回退英文默认值,跨端共享友好;各端应注入本地化 labels) */
  labels?: Partial<WorkPanelLabels>
  /** 内容区(各端注入 WebViewFrame 或自定义实现) */
  children?: React.ReactNode
  className?: string
}

/** i18n 文案接口(P4-3:统一收口界面文案,供跨端/跨语言注入) */
export interface WorkPanelLabels {
  back: string
  forward: string
  reload: string
  stop: string
  addressPlaceholder: string
  favorite: string
  unfavorite: string
  favoritesAndHistory: string
  openExternal: string
  closePanel: string
  newTab: string
  removeFavorite: string
  tabFavorites: string
  tabHistory: string
  emptyFavorites: string
  emptyHistory: string
  clearHistory: string
  /** P4-5:拖拽指示线 a11y 标签 */
  dragInsertBefore: string
  dragInsertAfter: string
  /** 关闭单个 tab 的按钮 a11y 标签(改造前是无名 span[role=button],现降生为真 button 必须有名) */
  closeTab: string
}

/** i18n 默认值(不传 labels 时回退到英文;界面语言文案一律由调用端 labels 注入) */
const DEFAULT_LABELS: WorkPanelLabels = {
  back: 'Back',
  forward: 'Forward',
  reload: 'Reload',
  stop: 'Stop',
  addressPlaceholder: 'Enter URL or search...',
  favorite: 'Add bookmark',
  unfavorite: 'Remove bookmark',
  favoritesAndHistory: 'Bookmarks & history',
  openExternal: 'Open in external browser',
  closePanel: 'Close panel',
  newTab: 'New tab',
  removeFavorite: 'Remove bookmark',
  tabFavorites: 'Bookmarks',
  tabHistory: 'History',
  emptyFavorites: 'No bookmarks yet',
  emptyHistory: 'No history yet',
  clearHistory: 'Clear history',
  dragInsertBefore: 'Insert before this tab',
  dragInsertAfter: 'Insert after this tab',
  closeTab: 'Close tab',
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
      labels: labelsProp,
      children,
      className,
    },
    ref,
  ) => {
    // P4-3:合并 labels(传参 > 英文默认),一次解析到处用
    const labels = React.useMemo<WorkPanelLabels>(
      () => ({ ...DEFAULT_LABELS, ...labelsProp }),
      [labelsProp],
    )
    // P3+:收藏 + 历史 dropdown 面板状态
    const [dropdownOpen, setDropdownOpen] = React.useState(false)
    const [dropdownTab, setDropdownTab] = React.useState<'favorites' | 'history'>('favorites')
    const dropdownRef = React.useRef<HTMLDivElement>(null)
    const dropdownTriggerRef = React.useRef<HTMLButtonElement>(null)

    // P3++:Tab 拖拽状态(记录被拖动的 tab id,用于半透明 + 防止自己 drop 到自己)
    const [draggedTabId, setDraggedTabId] = React.useState<string | null>(null)
    // P4-5:drop indicator 状态 — 在哪个 tab 的哪一侧显示插入指示线
    const [dropTargetId, setDropTargetId] = React.useState<string | null>(null)
    const [dropPosition, setDropPosition] = React.useState<'before' | 'after'>('before')

    // click-away 关闭 dropdown
    React.useEffect(() => {
      if (!dropdownOpen) return
      const handler = (e: MouseEvent) => {
        const target = e.target as Node
        if (dropdownRef.current?.contains(target) || dropdownTriggerRef.current?.contains(target)) {
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
    const dropdownEnabled = !!onSelectFromList && (!!favorites || !!recentUrls)

    // 当前 tab 列表数据
    const dropdownItems = dropdownTab === 'favorites' ? (favorites ?? []) : (recentUrls ?? [])

    return (
      <div
        ref={ref}
        className={cn(
          // 2026-08-01 用户反馈:"背景色应该跟 ai 对话框背景色一致,圆角度也是应该一致"
          // - bg-card → bg-transparent:让外层 WebWorkPanel 的 bg-shell-panel 透出来(对齐 AI 对话框)
          // - border-l 去掉:嵌入工作区场景不需要左边框(AI 对话框也无 border)
          // - rounded-xl 对齐 AI 对话框圆角度(AI 对话框 L929 rounded-xl)
          // - overflow-hidden 保留:彻底干掉外层滚动条(2026-07-25 用户反馈)
          'relative flex h-full flex-col overflow-hidden rounded-xl bg-transparent',
          'animate-in slide-in-from-right duration-(--duration-unified) ease-unified',
          className,
        )}
        style={width ? { width } : undefined}
      >
        {/* 左侧拖拽手柄(仅在传入 onResize 时渲染 — 嵌入工作区场景无 resize) */}
        {onResize && (
          <ResizableHandle
            direction="left"
            onResize={onResize}
            onResizeStart={onResizeStart}
            onResizeEnd={onResizeEnd}
          />
        )}

        {/* 顶部工具栏:导航按钮 + 地址栏 + 动作 */}
        <div className="flex items-center gap-1 px-2 py-1.5">
          <ToolbarButton onClick={onBack} disabled={!canBack} title={labels.back}>
            <ArrowLeft className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={onForward} disabled={!canForward} title={labels.forward}>
            <ArrowRight className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={isLoading ? onStop : onReload}
            title={isLoading ? labels.stop : labels.reload}
          >
            {isLoading ? <X className="h-4 w-4" /> : <RotateCw className="h-4 w-4" />}
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
                placeholder={labels.addressPlaceholder}
                className="h-5 border-0 bg-transparent px-0 text-xs shadow-none focus-visible:ring-0"
              />
              {isLoading && (
                <Loader2 className="h-3 w-3 shrink-0 animate-spin text-muted-foreground" />
              )}
            </div>
          </form>

          {onToggleFavorite && (
            <ToolbarButton
              onClick={onToggleFavorite}
              title={isFavorite ? labels.unfavorite : labels.favorite}
              className={isFavorite ? 'text-amber-500 hover:text-amber-500' : undefined}
            >
              <Star className={cn('h-4 w-4', isFavorite && 'fill-current')} />
            </ToolbarButton>
          )}
          {dropdownEnabled && (
            <ToolbarButton
              ref={dropdownTriggerRef}
              onClick={() => setDropdownOpen((v) => !v)}
              title={labels.favoritesAndHistory}
              className={dropdownOpen ? 'bg-muted text-foreground' : undefined}
            >
              <ChevronDown className="h-4 w-4" />
            </ToolbarButton>
          )}
          {onOpenExternal && (
            <ToolbarButton onClick={onOpenExternal} title={labels.openExternal}>
              <ExternalLink className="h-4 w-4" />
            </ToolbarButton>
          )}
          {/* 2026-09-16 全项目统一关闭按钮 token(标题栏行内,不加 POSITION) */}
          <CloseButton aria-label={labels.closePanel} title={labels.closePanel} onClick={onClose} />
        </div>

        {/* P3+:收藏 + 历史 dropdown 面板 */}
        {dropdownOpen && dropdownEnabled && (
          <div
            ref={dropdownRef}
            role="dialog"
            aria-label={labels.favoritesAndHistory}
            className="absolute right-2 top-11 z-50 flex w-72 flex-col rounded-md border border-border bg-popover p-1.5 shadow-md animate-in fade-in-0 zoom-in-95 duration-(--duration-unified) ease-unified"
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
                <span>{labels.tabFavorites}</span>
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
                <span>{labels.tabHistory}</span>
                {recentUrls && recentUrls.length > 0 && (
                  <span className="text-[10px] text-muted-foreground">{recentUrls.length}</span>
                )}
              </button>
            </div>

            {/* 列表(2026-07-25 用户反馈:彻底隐藏滚动条,鼠标滚轮/触摸板足够) */}
            <div className="hover-scroll max-h-60 overflow-y-auto py-0.5">
              {dropdownItems.length === 0 ? (
                <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                  {dropdownTab === 'favorites' ? labels.emptyFavorites : labels.emptyHistory}
                </div>
              ) : (
                dropdownItems.map((item) => (
                  <div
                    key={item.url}
                    className="group flex items-center gap-1 rounded px-1.5 py-1 hover:bg-muted"
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => {
                            onSelectFromList?.(item.url)
                            setDropdownOpen(false)
                          }}
                          className="flex-1 truncate text-left text-xs text-foreground"
                        >
                          {item.title || item.url}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{item.url}</TooltipContent>
                    </Tooltip>
                    {dropdownTab === 'favorites' && onRemoveFavorite && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              onRemoveFavorite(item.url)
                            }}
                            className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 group-focus-within:opacity-100"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>{labels.removeFavorite}</TooltipContent>
                      </Tooltip>
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
                  <span>{labels.clearHistory}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 栏(仅多 Tab 时显示) */}
        {tabs.length > 0 && (
          <div className="flex items-center gap-0.5 px-2 pb-1">
            {/* 2026-07-25 用户反馈:横向滚动条也彻底隐藏,鼠标滚轮/触摸板左右滑足够 */}
            <div className="hover-scroll flex flex-1 items-center gap-0.5 overflow-x-auto">
              {tabs.map((tab, idx) => {
                // P4-5:本 tab 是否在拖动中 / 是 drop 目标
                const isDragging = draggedTabId === tab.id
                const isDropTarget = dropTargetId === tab.id
                return (
                  <React.Fragment key={tab.id}>
                    {/* P4-5:before 侧 drop indicator(蓝色细线,与 tab 等高)
                        关键:pointer-events-none 让 drag 事件穿透到兄弟 tab,
                        否则 indicator 会拦截 dragover,导致目标 tab 失焦。 */}
                    {isDropTarget && dropPosition === 'before' && (
                      <DropIndicator aria-label={labels.dragInsertBefore} />
                    )}
                    {/* 2026-09-22 非法嵌套根治:原外层 <button> 内嵌 <span role="button">
                        (button 内容模型禁止 interactive content,且形成双 Tab 停靠点)。
                        外层降级为承载 hover/drag/drop 语义的容器 div,内部并列两个真 <button>:
                        激活钮 + 关闭钮。
                        关键:拖拽五件套 handler 与 draggable 必须留在**外层容器**,
                        这样 onDragLeave 的 contains(relatedTarget) 判定域 == 改造前的整颗 pill
                        (鼠标移到关闭钮上仍算"在 tab 内",指示线不抖);
                        onDragOver 的 rect/中点取位也与改造前逐像素等价。 */}
                    <div
                      data-testid="work-panel-tab"
                      draggable={!!onTabReorder}
                      onDragStart={(e) => {
                        if (!onTabReorder) return
                        e.dataTransfer.setData('text/plain', tab.id)
                        e.dataTransfer.effectAllowed = 'move'
                        setDraggedTabId(tab.id)
                      }}
                      onDragEnd={() => {
                        setDraggedTabId(null)
                        setDropTargetId(null)
                      }}
                      onDragOver={(e) => {
                        if (!onTabReorder) return
                        // 必须 preventDefault 才能触发 onDrop
                        e.preventDefault()
                        e.dataTransfer.dropEffect = 'move'
                        // P4-5:基于鼠标 X 在 tab 内的位置决定 before / after
                        const rect = e.currentTarget.getBoundingClientRect()
                        const midpoint = rect.left + rect.width / 2
                        const pos: 'before' | 'after' = e.clientX < midpoint ? 'before' : 'after'
                        if (dropTargetId !== tab.id || dropPosition !== pos) {
                          setDropTargetId(tab.id)
                          setDropPosition(pos)
                        }
                      }}
                      onDragLeave={(e) => {
                        // P4-5:只有真正离开 tab(relatedTarget 不在 tab 内)才清掉 indicator
                        // 防止鼠标移到子元素(spans/X icon)时误清
                        if (
                          !e.currentTarget.contains(e.relatedTarget as Node | null) &&
                          dropTargetId === tab.id
                        ) {
                          setDropTargetId(null)
                        }
                      }}
                      onDrop={(e) => {
                        if (!onTabReorder) return
                        e.preventDefault()
                        const fromId = e.dataTransfer.getData('text/plain')
                        const pos = dropPosition
                        setDraggedTabId(null)
                        setDropTargetId(null)
                        if (fromId && fromId !== tab.id) {
                          onTabReorder(fromId, tab.id, pos)
                        }
                      }}
                      className={cn(
                        'group inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-all duration-150',
                        tab.id === activeTabId
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:bg-muted',
                        // P3++:拖动中半透明
                        isDragging && 'opacity-40',
                        // P4-5:drop target 时:背景加亮 + 缩放反馈
                        !isDragging && isDropTarget && 'bg-muted text-foreground scale-105',
                      )}
                    >
                      {/* 激活钮:承载改造前外层 button 的 onClick + 标题,类名为原 pill 的内联布局子集,
                          pill 的背景/圆角/padding/hover/scale 仍留在外层容器上 → 视觉零变化 */}
                      <button
                        type="button"
                        onClick={() => onTabChange(tab.id)}
                        className="inline-flex items-center"
                      >
                        <span className="max-w-[120px] truncate">{tab.title}</span>
                      </button>
                      {onTabClose && (
                        <button
                          type="button"
                          data-testid="work-panel-tab-close"
                          aria-label={labels.closeTab}
                          onClick={(e) => {
                            // 保留 stopPropagation:改造前它压制的是外层 button 的 onTabChange;
                            // 改造后激活钮是关闭钮的**兄弟**(同属这颗 pill),冒泡链上本就不会再经过它,
                            // 该调用成为"点击关闭绝不触发激活"的第二重保险,语义与改造前一致。
                            e.stopPropagation()
                            onTabClose(tab.id)
                          }}
                          className="rounded p-0.5 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100 group-focus-within:opacity-100"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    {/* P4-5:after 侧 drop indicator(只对最后一个 tab 显示,作为"放到末尾"位置) */}
                    {isDropTarget && dropPosition === 'after' && idx === tabs.length - 1 && (
                      <DropIndicator aria-label={labels.dragInsertAfter} />
                    )}
                  </React.Fragment>
                )
              })}
            </div>
            {onNewTab && (
              <ToolbarButton onClick={onNewTab} title={labels.newTab} size="sm">
                <Plus className="h-3.5 w-3.5" />
              </ToolbarButton>
            )}
          </div>
        )}

        {/* 内容区(2026-07-25 用户反馈:彻底隐藏滚动条,鼠标滚轮/触摸板足够)
            - 加 work-panel-content 类,globals.css 用 !important 强制干掉 Webkit/Firefox/IE 滚动条
            - 改用 overflow-hidden(原 overflow-y-auto):即使内容溢出也不显示原生滚动条,
              鼠标滚轮/触摸板驱动外层 / iframe 内部滚动
            - 2026-08-01 bg-background → bg-transparent:让外层 WebWorkPanel bg-shell-panel 透出来
              (对齐 AI 对话框背景色,用户反馈"背景色应该跟 ai 对话框背景色一致")
              外层 WebWorkPanel 已有 bg-shell-panel 不透明,内容区无需再设 bg */}
        <div className="work-panel-content hover-scroll flex-1 overflow-hidden bg-transparent p-2">
          {children}
        </div>
      </div>
    )
  },
)
WorkPanel.displayName = 'WorkPanel'

/** 工具栏按钮(内部组件,图标垂直对齐由全局 CSS 自动处理) */
interface ToolbarButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'sm' | 'md'
}
/**
 * 工具条图标钮。`title` 在这里**不再落到原生属性**(AGENTS.md §4 禁原生提示窗),
 * 而是:①作为缺省可访问名(调用方显式传 aria-label 时以其为准);②经包内 Tooltip 渲染成
 * 与全站一致的提示样式。Radix Trigger 用 asChild,不额外插 DOM 节点 → 尺寸/布局零变化。
 */
const ToolbarButton = React.forwardRef<HTMLButtonElement, ToolbarButtonProps>(
  ({ className, size = 'md', title, ...props }, ref) => {
    const button = (
      <button
        ref={ref}
        type="button"
        {...props}
        aria-label={props['aria-label'] ?? (typeof title === 'string' ? title : undefined)}
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40',
          size === 'sm' ? 'h-6 w-6' : 'h-7 w-7',
          className,
        )}
      />
    )
    if (typeof title !== 'string' || title === '') return button
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent side="bottom">{title}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  },
)
ToolbarButton.displayName = 'ToolbarButton'

/** P4-5:拖拽插入指示线(2px 宽、与 tab 同高的 vertical bar)
 *  使用 pointer-events-none + self-stretch + shrink-0:
 *  - pointer-events-none 让 drag 事件穿透,indicator 不抢 dragover
 *  - self-stretch 让高度匹配 tab 高度
 *  - shrink-0 防止 flex 容器把 2px 压成 0
 *  用 bg-primary + shadow 形成醒目但不喧宾夺主的视觉反馈,带淡入动画。
 *  a11y:aria-label 由调用方传入(中英文由 labels 注入) */
function DropIndicator({ 'aria-label': ariaLabel }: { 'aria-label': string }) {
  return (
    <div
      role="presentation"
      aria-label={ariaLabel}
      className="pointer-events-none self-stretch shrink-0 w-0.5 rounded-sm bg-primary shadow-[0_0_4px_var(--color-primary)] animate-in fade-in-0 zoom-in-95 duration-100"
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
