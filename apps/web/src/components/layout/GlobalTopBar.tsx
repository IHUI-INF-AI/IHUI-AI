'use client'
/* eslint-disable jsx-a11y/no-static-element-interactions -- 桌面端窗口控制(拖拽/resize/双击最大化)是鼠标专用交互,不适用于键盘/屏幕阅读器 */

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  Plus,
  Globe,
  FileText,
  Terminal,
  Code2,
  GitCompare,
  Bot,
  Plug,
  Settings,
  Sparkles,
  X,
  Square,
  Minus,
  Search,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDesktop } from '@/hooks/use-desktop'
import { useIDEWorkspace } from '@/stores/ide-workspace'
import { useWorkPanelStore } from '@/stores/work-panel'
import {
  minimizeWindow,
  toggleMaximizeWindow,
  closeWindow,
  startWindowDrag,
  startResize,
  onMaximizeChange,
} from '@/lib/tauri-bridge'
import { TOPBAR_BTN_BASE, TOPBAR_BTN_W9 } from '@/lib/nav-styles'
import { TagsView, TagsViewSearchButton, TagsViewChevronButton } from './TagsView'
import { Tooltip } from '@/components/feedback'

type PlusMenuAction = {
  /** 唯一 key,i18n 标签用 `topBar.<key>` 解析 */
  key: 'document' | 'browser' | 'terminal' | 'editor' | 'codeChanges' | 'agent' | 'mcp' | 'settings' | 'skill'
  icon: LucideIcon
  /** 跳转路径(相对路径,会经 next/navigation 解析) */
  href?: string
  /** 切换 IDE 顶 tab(可选,触发 useIDEWorkspace.setActiveTopTab) */
  setIdeTab?: 'editor' | 'document' | 'terminal' | 'browser' | 'code-changes' | 'figma' | 'agent' | 'mcp' | 'settings'
  /** 触发 WorkPanel 切换(可选,内置浏览器复用) */
  toggleWorkPanel?: boolean
  /** 快捷键提示文案 */
  shortcut?: string
}

const PLUS_MENU_GROUPS: Array<{ titleKey: 'groupView' | 'groupTools' | 'groupSettings'; items: PlusMenuAction[] }> = [
  {
    titleKey: 'groupView',
    items: [
      { key: 'document', icon: FileText, href: '/docs', shortcut: 'G D' },
      { key: 'browser', icon: Globe, toggleWorkPanel: true, shortcut: 'G B' },
    ],
  },
  {
    titleKey: 'groupTools',
    items: [
      { key: 'editor', icon: Code2, href: '/workspace', setIdeTab: 'editor', shortcut: 'G E' },
      { key: 'terminal', icon: Terminal, href: '/workspace', setIdeTab: 'terminal', shortcut: 'G T' },
      { key: 'codeChanges', icon: GitCompare, href: '/workspace', setIdeTab: 'code-changes', shortcut: 'G C' },
      { key: 'agent', icon: Bot, href: '/workspace', setIdeTab: 'agent', shortcut: 'G A' },
      { key: 'mcp', icon: Plug, href: '/workspace', setIdeTab: 'mcp', shortcut: 'G M' },
    ],
  },
  {
    titleKey: 'groupSettings',
    items: [
      { key: 'skill', icon: Sparkles, href: '/ai-skills', shortcut: 'G K' },
      { key: 'settings', icon: Settings, href: '/settings', shortcut: 'G S' },
    ],
  },
]

/**
 * GlobalTopBar — 全站常驻的顶栏(2026-07-30 立)
 *
 * 设计目标:
 * - 把原先仅在 (main) 路由组 MainShell 内部渲染的标签栏 + 内置浏览器入口 + 窗口控制
 *   提升到 GlobalShell 全局层级,让 marketing / auth / sso / forbidden / login 等所有路由
 *   都能看到常驻顶栏(用户决策:严格全站显示含 marketing/auth)。
 * - 替代原 MainShell 顶栏的 Globe 入口:统一从 Plus 弹窗触发"内置浏览器"(workPanel toggle)。
 * - 桌面端(Tauri)能力:8 方向 resize + 窗口控制按钮 + 拖拽区域 + 双击最大化
 *   全部跟原 MainShell 保持一致,只是位置上移到 GlobalTopBar。
 *
 * 布局:
 *   <div h-9 px-4 select-none cursor-default>          ← 外层容器(单层 h-9 = 36px,水平 16px 与 main p-4 对齐)
 *     <TagsView flex-1 />                                ← 标签栏
 *     <Plus 弹窗按钮>                                    ← 9 项菜单(文档/浏览器/终端/编辑/代码变更/Agent/MCP/Skill/设置)
 *     <WindowControls>                                   ← 仅桌面端:Min/Max/Close
 *   </div>
 *
 * 与 MainShell 的分工:
 * - GlobalTopBar:负责全站顶栏(标签 + Plus 弹窗 + 窗口控制 + 桌面端拖拽/resize)
 * - MainShell:仅保留工作区卡片容器(bg-shell-panel rounded-xl),不再渲染顶栏
 * - (main) 路由组以外:children 直接渲染到 work-area-portal-root,
 *   标签栏仍可见(TagsView 永远走 addTag 派生自 pathname,无论在哪个路由组)
 *
 * 平台独占:仅 web 端(AGENTS.md §9 显式标注)。
 * 其他端(api/ai-service/desktop/extension/mobile-rn/miniapp-taro/cli)无此概念,无须同步。
 */
export function GlobalTopBar() {
  const { isDesktop } = useDesktop()
  const t = useTranslations('ide')
  const tNav = useTranslations('nav')
  const router = useRouter()
  const setActiveTopTab = useIDEWorkspace((s) => s.setActiveTopTab)
  const toggleWorkPanel = useWorkPanelStore((s) => s.toggle)

  const [plusOpen, setPlusOpen] = React.useState(false)
  const [plusQuery, setPlusQuery] = React.useState('')
  const plusRef = React.useRef<HTMLDivElement>(null)
  const plusInputRef = React.useRef<HTMLInputElement>(null)

  // 桌面端:窗口最大化状态(Tauri onResized 事件)
  const [isMaximized, setIsMaximized] = React.useState(false)

  // 拖拽 + 双击最大化统一状态机(2026-07-28 sidebar.tsx 已验证模式,直接复用)
  const dragTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastMouseDownAt = React.useRef<number>(0)
  const DOUBLE_CLICK_MS = 250

  // 监听 Tauri 最大化事件
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

  // 清理拖拽 timer
  React.useEffect(() => {
    return () => {
      if (dragTimer.current) {
        clearTimeout(dragTimer.current)
        dragTimer.current = null
      }
    }
  }, [])

  // Plus 弹窗:点击外部关闭
  React.useEffect(() => {
    if (!plusOpen) return
    const handler = (e: MouseEvent) => {
      if (plusRef.current && !plusRef.current.contains(e.target as Node)) {
        setPlusOpen(false)
        setPlusQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [plusOpen])

  // Plus 弹窗:打开后聚焦搜索框
  React.useEffect(() => {
    if (!plusOpen) return
    setPlusQuery('')
    const id = requestAnimationFrame(() => plusInputRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [plusOpen])

  // Plus 弹窗:Esc 关闭
  React.useEffect(() => {
    if (!plusOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setPlusOpen(false)
        setPlusQuery('')
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [plusOpen])

  // 过滤菜单项(按 label / id 模糊匹配)
  const filteredGroups = React.useMemo(() => {
    const q = plusQuery.trim().toLowerCase()
    if (!q) return PLUS_MENU_GROUPS
    return PLUS_MENU_GROUPS
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (i) =>
            i.key.toLowerCase().includes(q) ||
            t(`topBar.${i.key}`).toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.items.length > 0)
  }, [plusQuery, t])

  // 处理菜单项点击
  const handleAction = (action: PlusMenuAction) => {
    setPlusOpen(false)
    setPlusQuery('')
    if (action.setIdeTab) {
      setActiveTopTab(action.setIdeTab)
    }
    if (action.toggleWorkPanel) {
      toggleWorkPanel()
    }
    if (action.href) {
      router.push(action.href)
    }
  }

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
   * 状态机与 MainShell 原始实现完全一致(2026-07-28 sidebar.tsx 已验证模式):
   * - 第一次 mousedown:启动 250ms timer,到期触发 startWindowDrag
   * - 250ms 内 mouseup:取消 timer(纯点击,不拖拽)
   * - 250ms 内第二次 mousedown:取消 timer + 触发 toggleMaximizeWindow(双击最大化)
   * - 跳过交互元素(标签/按钮/输入框),让它们的点击正常触发
   */
  const handleDragRegionMouseDown = (e: React.MouseEvent) => {
    if (!isDesktop || e.button !== 0) return
    const target = e.target as HTMLElement
    if (target.closest('a, button, [role="button"], input, textarea, select')) return

    const now = Date.now()
    const sinceLast = now - lastMouseDownAt.current

    if (sinceLast < DOUBLE_CLICK_MS && dragTimer.current) {
      clearTimeout(dragTimer.current)
      dragTimer.current = null
      lastMouseDownAt.current = 0
      void handleToggleMax()
      return
    }

    lastMouseDownAt.current = now
    if (dragTimer.current) clearTimeout(dragTimer.current)
    dragTimer.current = setTimeout(() => {
      void startWindowDrag()
      dragTimer.current = null
    }, DOUBLE_CLICK_MS)
  }

  const cancelDragTimer = () => {
    if (dragTimer.current) {
      clearTimeout(dragTimer.current)
      dragTimer.current = null
    }
  }

  const plusLabel = t('topBar.plus')

  return (
    <>
      {/* P0-1:8 方向 resize 区域(仅桌面端 + 非最大化状态)
          z-index 与 MainShell 原始实现保持一致:边 9999 / 角 10000 / 窗口控制按钮 10001。 */}
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

      {/* 顶栏(2026-07-30 第十一轮"做减法 v7"用户反馈"取消 bg-shell-panel + 把 chevron/Plus 挪到搜索按钮后面 a 标签前面"后版本)
          第十轮曾加 bg-shell-panel 跟工作区/AI 面板背景色一致(用户上一轮要求),本轮用户推翻:
          "谁让你把这个设置了背景色的?取消掉" — 顶栏恢复透明,只保留内层 36px h-9 高度。

          第十轮 flex 顺序: 搜索(在 TagsView 内) → 标签栏(在 TagsView 内) → chevron(在 TagsView 内) → Plus
          第十一轮 flex 顺序(本轮): 搜索 → chevron → Plus → 标签栏(a 标签)
          为实现新顺序,搜索 + chevron 抽出为独立组件 TagsViewSearchButton / TagsViewChevronButton
          (TagsView.tsx),直接放在 GlobalTopBar 内层 flex 内,顺序由 JSX 顺序控制;
          主 TagsView 退化为只渲染 a 标签 + 关闭按钮,顺序由父级 flex 控制。

          根因(用户原话):"把 button button 这两个按钮挪到 button 后面 a 前面"
          → button(搜索) → button(更多Actions) → button(添加视图) → a(首页) → ...

          总高 44px = 8(外层 pt-2) + 36(内层 h-9) — 单一职责,跟 v4 契约一致。 */}
      <div
        className="pt-2 shrink-0 select-none cursor-default"
        onMouseDown={handleDragRegionMouseDown}
        onMouseUp={cancelDragTimer}
        onMouseLeave={cancelDragTimer}
      >
        {/* 第十一轮 flex 顺序契约(由 JSX 顺序控制):
            1. TagsViewSearchButton    ← 搜索按钮(36x36)
            2. TagsViewChevronButton   ← 关闭其他/全部 36x36(tags.length===0 不渲染)
            3. <Plus>                  ← 添加视图 36x36
            4. <TagsView>              ← 标签栏(a 标签)flex-1 占满剩余空间 */}
        <div className="flex h-9 items-center gap-1">
          {/* 1. 搜索按钮(从 TagsView 抽出) */}
          <React.Suspense fallback={null}>
            <TagsViewSearchButton />
          </React.Suspense>

          {/* 2. chevron 关闭其他/全部 按钮(从 TagsView 抽出) */}
          <React.Suspense fallback={null}>
            <TagsViewChevronButton />
          </React.Suspense>

          {/* 3. Plus 弹窗按钮(2026-07-30 立,替代原 Globe 按钮)
            - 视觉风格与窗口控制按钮一致(h-full w-9 rounded-md hover bg-muted/50,2026-07-30
              深度修复:之前 h-7 w-7 (28px) 跟顶栏 h-9 (36px) 矮 8px,导致"标签栏高度不对"
              的视觉效果 — Plus 按钮底部露出 4px 空隙,标签栏高度看起来参差不齐。改 h-full w-9
              后跟顶栏 36px 严格一致 36x36 正方形,消除"双重高度设定/冲突设定"问题(用户原话))
            - hover 显示加号图标 + 向下箭头
            - 点击展开 9 项菜单(分 3 组:视图/工具/设置)
            - 弹窗内含搜索框(过滤菜单项)+ 快捷键提示
            - 走 workPanel toggle / IDE setActiveTopTab / router.push 三类动作 */}
        <div ref={plusRef} className="relative h-full shrink-0">
          <Tooltip content={plusLabel} side="bottom">
            <button
              type="button"
              onClick={() => setPlusOpen((o) => !o)}
              aria-label={plusLabel}
              aria-haspopup="menu"
              aria-expanded={plusOpen}
              // 2026-07-30 第十轮"做减法 v6"(用户反馈"Plus/chevron-down/窗口控制 按钮应跟搜索按钮一致"):
              // - 改 w-7 → w-9(36px) 跟搜索按钮对齐,4 类按钮全部 36x36 正方形
              // 2026-07-30 用户规则:"应该有背景色设定啊 全局统一 hover时突出"
              //   - 默认 bg + hover 已提到 TOPBAR_BTN_BASE 统一
              //   - active 态:plusOpen 时 bg-accent text-foreground(属于状态指示,保留覆盖)
              className={cn(
                TOPBAR_BTN_BASE,
                TOPBAR_BTN_W9,
                plusOpen ? 'bg-accent text-foreground' : '',
              )}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </Tooltip>

          {plusOpen && (
            <div
              role="menu"
              aria-label={plusLabel}
              data-testid="global-topbar-plus-menu"
              className="absolute right-0 top-full z-popover mt-1 w-64 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
            >
              {/* 搜索框 */}
              <div className="px-1 pb-1 pt-0.5">
                <div className="flex items-center gap-1.5 rounded-sm bg-muted/50 px-2 py-1">
                  <Search className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <input
                    ref={plusInputRef}
                    value={plusQuery}
                    onChange={(e) => setPlusQuery(e.target.value)}
                    placeholder={t('viewSwitcher.searchPlaceholder')}
                    className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
                  />
                </div>
              </div>
              {filteredGroups.length === 0 ? (
                <div className="px-3 py-3 text-center text-xs text-muted-foreground">
                  {t('viewSwitcher.noMatch')}
                </div>
              ) : (
                filteredGroups.map((group) => (
                  <div key={group.titleKey} className="px-1 pb-1 pt-1">
                    <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {t(`viewSwitcher.${group.titleKey}`)}
                    </div>
                    {group.items.map((item) => {
                      const Icon = item.icon
                      return (
                        <button
                          key={item.key}
                          type="button"
                          role="menuitem"
                          onClick={() => handleAction(item)}
                          className={cn(
                            'flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs',
                            'text-muted-foreground transition-colors',
                            'hover:bg-muted/50 hover:text-foreground',
                            'focus:bg-muted/50 focus:text-foreground focus:outline-none',
                          )}
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          <span className="flex-1 text-left">{t(`topBar.${item.key}`)}</span>
                          {item.shortcut && (
                            <span className="text-[10px] text-muted-foreground/80">
                              {item.shortcut}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* 4. 标签栏(2026-07-30 第十一轮"做减法 v7"用户反馈"a 标签在 chevron/Plus 后面"后位置)
            flex-1 占满剩余空间,只渲染 a 标签 + 关闭按钮(无搜索/无 chevron,已抽出为独立组件) */}
        <React.Suspense fallback={null}>
          <div className="flex h-full min-w-0 flex-1 items-center overflow-hidden">
            <TagsView />
          </div>
        </React.Suspense>

        {/* 窗口控制按钮(Min/Max/Close),仅桌面端 isDesktop
            z-[10001]:高于 8 方向 resize 区域(z-9999/10000)
            2026-07-30 深度修复"双重高度设定/冲突设定"(用户反馈):之前容器 h-7 (28px) 跟
            顶栏 h-9 (36px) 矮 8px,导致桌面端窗口控制按钮区域"塌陷",跟右侧 Plus 按钮
            视觉参差。改 h-full 后容器跟顶栏 36px 严格一致,内部 WindowControlButton 同步
            h-full 撑满容器,消除容器+按钮的"双重高度"残留风险。 */}
        {isDesktop && (
          <div
            className="relative z-[10001] flex h-full shrink-0 items-center gap-0.5 rounded-md"
            data-window-controls
          >
            <WindowControlButton
              onClick={handleMinimize}
              ariaLabel={tNav('minimize')}
              icon={<Minus className="h-3.5 w-3.5" />}
            />
            <WindowControlButton
              onClick={handleToggleMax}
              ariaLabel={isMaximized ? tNav('restore') : tNav('maximize')}
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
              ariaLabel={tNav('close')}
              icon={<X className="h-3.5 w-3.5" />}
              variant="close"
            />
          </div>
        )}
        </div>
      </div>
    </>
  )
}

// ================== 子组件 ==================

/** 窗口控制按钮(Min/Max/Close) — 2026-07-30 第十轮"做减法 v6"
 *  - 改用共享 TOPBAR_BTN_BASE + TOPBAR_BTN_W9(36px 方块,跟搜索/Plus/chevron-down 4 类按钮全部正方形)
 *  - variant === 'close' 保留红色 hover 样式(差异项,关闭按钮需特别视觉警示) */
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
        TOPBAR_BTN_BASE,
        TOPBAR_BTN_W9,
        // 2026-07-30 用户规则:"应该有背景色设定啊 全局统一 hover时突出"
        //   - 默认 bg + hover 已提到 TOPBAR_BTN_BASE 统一
        //   - close 变体保留红色 hover(差异项:关闭按钮需特别视觉警示),覆盖默认 hover:bg-muted
        variant === 'close'
          ? 'hover:bg-red-500/15 hover:text-red-600 dark:hover:text-red-400'
          : '',
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

export default GlobalTopBar
