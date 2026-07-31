'use client'
/* eslint-disable jsx-a11y/no-static-element-interactions -- 桌面端窗口控制(拖拽/resize/双击最大化)是鼠标专用交互,不适用于键盘/屏幕阅读器 */

import * as React from 'react'
import { createPortal } from 'react-dom'
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
import { useIsMobile } from '@/hooks/use-media-query'

type PlusMenuAction = {
  /** 唯一 key,i18n 标签用 `topBar.<key>` 解析 */
  key:
    | 'document'
    | 'browser'
    | 'terminal'
    | 'editor'
    | 'codeChanges'
    | 'agent'
    | 'mcp'
    | 'settings'
    | 'skill'
  icon: LucideIcon
  /** 跳转路径(相对路径,会经 next/navigation 解析) */
  href?: string
  /** 切换 IDE 顶 tab(可选,触发 useIDEWorkspace.setActiveTopTab) */
  setIdeTab?:
    | 'editor'
    | 'document'
    | 'terminal'
    | 'browser'
    | 'code-changes'
    | 'figma'
    | 'agent'
    | 'mcp'
    | 'settings'
  /** 触发 WorkPanel 切换(可选,内置浏览器复用) */
  toggleWorkPanel?: boolean
  /** 全局直接快捷键(可选,显示在菜单项右侧)
   * 2026-07-30 用户规则:"可以做快捷键 组合键 你深度思考分析设计去做好"
   * 设计原则(做减法):只为最高频入口(设置)标独立快捷键,其他 7 项通过 Ctrl+Shift+P 命令面板搜索触发
   * 避免快捷键爆炸(用户记不住 + 浏览器冲突);Ctrl+, 是 VS Code 标准,用户最熟悉 */
  shortcut?: string
}

const PLUS_MENU_GROUPS: Array<{
  titleKey: 'groupView' | 'groupTools' | 'groupSettings'
  items: PlusMenuAction[]
}> = [
  {
    titleKey: 'groupView',
    items: [
      { key: 'document', icon: FileText, href: '/docs' },
      { key: 'browser', icon: Globe, toggleWorkPanel: true },
    ],
  },
  {
    titleKey: 'groupTools',
    items: [
      // 2026-07-31 修复路由断裂:原 href:'/workspace'(项目列表页,不渲染 IDELayout)
      // → 改为 '/developer/ide'(真正渲染 IDELayout 的路由,app/(main)/developer/ide/page.tsx)
      // 否则 setIdeTab 设置的 store 状态无人消费,5 项点击后只看到项目列表
      { key: 'editor', icon: Code2, href: '/developer/ide', setIdeTab: 'editor' },
      { key: 'terminal', icon: Terminal, href: '/developer/ide', setIdeTab: 'terminal' },
      { key: 'codeChanges', icon: GitCompare, href: '/developer/ide', setIdeTab: 'code-changes' },
      { key: 'agent', icon: Bot, href: '/developer/ide', setIdeTab: 'agent' },
      { key: 'mcp', icon: Plug, href: '/developer/ide', setIdeTab: 'mcp' },
    ],
  },
  {
    titleKey: 'groupSettings',
    items: [
      { key: 'skill', icon: Sparkles, href: '/ai-skills' },
      // 2026-07-30 Ctrl+, 直接打开设置(VS Code 标准,已在 useGlobalShortcuts 注册全局快捷键)
      { key: 'settings', icon: Settings, href: '/settings', shortcut: 'Ctrl+,' },
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
/**
 * GlobalTopBar — 顶栏 flex 顺序契约(2026-07-31 第十三轮):
 *   0. <MobileMenuSlot>  ← 移动端汉堡菜单按钮(GlobalShell 通过 prop 注入,仅 lg 以下显示)
 *   1. TagsViewSearchButton    ← 搜索按钮(36x36)
 *   2. <Plus>                  ← 添加视图 36x36(从原第 3 位上移)
 *   3. TagsViewChevronButton   ← 关闭其他/全部 36x36(tags.length===0 不渲染,从原第 2 位下移)
 *   4. <TagsView>              ← 标签栏(a 标签)flex-1 占满剩余空间
 */
export function GlobalTopBar({ mobileMenu }: { mobileMenu?: React.ReactNode } = {}) {
  const { isDesktop } = useDesktop()
  const isMobile = useIsMobile()
  const t = useTranslations('ide')
  const tNav = useTranslations('nav')
  const router = useRouter()
  const setActiveTopTab = useIDEWorkspace((s) => s.setActiveTopTab)
  const toggleWorkPanel = useWorkPanelStore((s) => s.toggle)

  const [plusOpen, setPlusOpen] = React.useState(false)
  const [plusQuery, setPlusQuery] = React.useState('')
  // 2026-07-30 用户反馈:"点击后的下拉窗被ai对话框容器裁掉了一半 层级不对啊"
  // 根因:work-area-portal-root 父容器 overflow-hidden 裁剪 Plus 弹窗(absolute top-full)
  // 修复:弹窗用 createPortal 渲染到 document.body + fixed 定位,不受祖先 overflow 限制
  const [plusRect, setPlusRect] = React.useState<{ top: number; left: number } | null>(null)
  // 2026-07-30 用户规则:"可以做快捷键 组合键 你深度思考分析设计去做好"
  // 键盘导航:↑↓ 切换选中项 / Enter 确认 / Ctrl+Shift+P 全局打开
  const [activeIndex, setActiveIndex] = React.useState(0)
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

  // 过滤菜单项(按 label / id 模糊匹配)
  const filteredGroups = React.useMemo(() => {
    const q = plusQuery.trim().toLowerCase()
    if (!q) return PLUS_MENU_GROUPS
    return PLUS_MENU_GROUPS.map((g) => ({
      ...g,
      items: g.items.filter(
        (i) => i.key.toLowerCase().includes(q) || t(`topBar.${i.key}`).toLowerCase().includes(q),
      ),
    })).filter((g) => g.items.length > 0)
  }, [plusQuery, t])

  // flatItems:展开为一维数组,用于键盘导航 ↑↓←→ 计算 activeIndex + 九宫格渲染
  const flatItems = React.useMemo(() => filteredGroups.flatMap((g) => g.items), [filteredGroups])

  // 处理菜单项点击(键盘 Enter 或鼠标点击共用)
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

  // Plus 弹窗:打开后聚焦搜索框 + 重置 activeIndex
  React.useEffect(() => {
    if (!plusOpen) return
    setPlusQuery('')
    setActiveIndex(0)
    const id = requestAnimationFrame(() => plusInputRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [plusOpen])

  // 过滤结果变化时重置 activeIndex(避免超出范围)
  React.useEffect(() => {
    if (activeIndex >= flatItems.length) {
      setActiveIndex(0)
    }
  }, [flatItems.length, activeIndex])

  // 2026-07-30 用户规则:"可以做快捷键 组合键 你深度思考分析设计去做好"
  // 接入 useGlobalShortcuts 系统(AGENTS.md §3 共享层优先):
  // - 删除原硬编码 keydown 监听,改为监听 'global-shortcut:open-plus' CustomEvent
  // - 由 useGlobalShortcuts 统一派发,享有:① 帮助面板(Ctrl+/)自动收录 ② 作用域过滤(输入框聚焦不触发)
  //   ③ 跨平台 modifier 处理 ④ 与其他快捷键统一 preventDefault
  // - 快捷键:Ctrl+Shift+P(Win/Linux)/ Cmd+Shift+P(Mac)
  // - Mac 兼容性(2026-07-30 已完成):matchShortcut 在 Mac 上 wantCtrl 接受 ctrlKey || metaKey(Cmd),
  //   Mac 用户按 Cmd+Shift+P 能正常触发,与 Tooltip 显示 ⌘⇧P 一致(VS Code 标准行为)
  React.useEffect(() => {
    const onOpenPlus = () => {
      // 关闭时打开 / 打开时关闭(切换语义,与 VS Code 命令面板行为一致)
      setPlusOpen((o) => {
        if (!o && plusRef.current) {
          const r = plusRef.current.getBoundingClientRect()
          setPlusRect({ top: r.bottom + 4, left: r.left })
        }
        return !o
      })
    }
    window.addEventListener('global-shortcut:open-plus', onOpenPlus)
    return () => window.removeEventListener('global-shortcut:open-plus', onOpenPlus)
  }, [])

  // Plus 弹窗:↑↓←→ 九宫格导航 / Enter 确认 / Esc 关闭(合并到单一监听器,避免多个 keydown)
  // 2026-07-30 九宫格改造:↓↑ 按行跳(±3 列数),←→ 按列跳(±1),环形回绕适配过滤后非 9 项场景
  React.useEffect(() => {
    if (!plusOpen) return
    const COLS = 3 // 九宫格列数,与 grid-cols-3 对齐
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setPlusOpen(false)
        setPlusQuery('')
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((i) => (flatItems.length ? (i + COLS) % flatItems.length : 0))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((i) =>
          flatItems.length ? (i - COLS + flatItems.length) % flatItems.length : 0,
        )
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        setActiveIndex((i) => (flatItems.length ? (i + 1) % flatItems.length : 0))
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setActiveIndex((i) =>
          flatItems.length ? (i - 1 + flatItems.length) % flatItems.length : 0,
        )
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const item = flatItems[activeIndex]
        if (item) handleAction(item)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plusOpen, flatItems, activeIndex])

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
  // 2026-07-30 用户规则:"可以做快捷键 组合键 你深度思考分析设计去做好"
  // Tooltip 显示快捷键提示(Ctrl+Shift+P 打开,VS Code 命令面板模式)
  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform)
  const plusShortcut = isMac ? '⌘⇧P' : 'Ctrl+Shift+P'

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
          第十一轮 flex 顺序: 搜索 → chevron → Plus → 标签栏(a 标签)
          第十二轮 flex 顺序(本轮,2026-07-31 用户反馈"这两个按钮对换一下"): 搜索 → Plus → chevron → 标签栏
          为实现新顺序,搜索 + chevron 抽出为独立组件 TagsViewSearchButton / TagsViewChevronButton
          (TagsView.tsx),直接放在 GlobalTopBar 内层 flex 内,顺序由 JSX 顺序控制;
          主 TagsView 退化为只渲染 a 标签 + 关闭按钮,顺序由父级 flex 控制。

          根因(用户原话):"把 button button 这两个按钮挪到 button 后面 a 前面" → 后续"这两个按钮对换一下"
          → button(搜索) → button(添加视图) → button(更多Actions) → a(首页) → ...

          总高 50px = 8(外层 pt-2) + 36(内层 h-9) + 6(外层 pb-1.5,与下方工作区卡片间距,2026-07-30 立)。
          垂直间距统一归 GlobalTopBar 管理(MainShell 注释契约:顶部间距由 GlobalTopBar 提供)。 */}
      <div
        className="pt-2 pb-1.5 shrink-0 select-none cursor-default"
        onMouseDown={handleDragRegionMouseDown}
        onMouseUp={cancelDragTimer}
        onMouseLeave={cancelDragTimer}
      >
        {/* 第十二轮 flex 顺序契约(2026-07-31 用户反馈"这两个按钮对换一下",由 JSX 顺序控制):
            1. TagsViewSearchButton    ← 搜索按钮(36x36)
            2. <Plus>                  ← 添加视图 36x36(从原第 3 位上移)
            3. TagsViewChevronButton   ← 关闭其他/全部 36x36(tags.length===0 不渲染,从原第 2 位下移)
            4. <TagsView>              ← 标签栏(a 标签)flex-1 占满剩余空间 */}
        <div className="flex h-9 items-center gap-1">
          {/* 0. 移动端汉堡菜单按钮(2026-07-31 第十三轮立,GlobalShell 注入)
              - 物理上作为顶栏 flex 第一个元素,跟 TagsViewSearchButton 36x36 尺寸一致,
                杜绝 absolute 定位与顶栏子元素 z-index/stacking-context 冲突(原 bug:z-modal 也无法覆盖)
              - 桌面端 lg:flex 隐藏,移动端 lg 以下显示 */}
          {mobileMenu}

          {/* 1. 搜索按钮(从 TagsView 抽出) */}
          <React.Suspense fallback={null}>
            <TagsViewSearchButton />
          </React.Suspense>

          {/* 2. Plus 弹窗按钮(2026-07-30 立,替代原 Globe 按钮)
            - 视觉风格与窗口控制按钮一致(h-full w-9 rounded-md hover bg-muted/50,2026-07-30
              深度修复:之前 h-7 w-7 (28px) 跟顶栏 h-9 (36px) 矮 8px,导致"标签栏高度不对"
              的视觉效果 — Plus 按钮底部露出 4px 空隙,标签栏高度看起来参差不齐。改 h-full w-9
              后跟顶栏 36px 严格一致 36x36 正方形,消除"双重高度设定/冲突设定"问题(用户原话))
            - hover 显示加号图标 + 向下箭头
            - 点击展开 9 项菜单(分 3 组:视图/工具/设置)
            - 弹窗内含搜索框(过滤菜单项)+ 快捷键提示
            - 走 workPanel toggle / IDE setActiveTopTab / router.push 三类动作 */}
          <div ref={plusRef} className="relative h-full shrink-0">
            <Tooltip content={`${plusLabel} (${plusShortcut})`} side="bottom">
              <button
                type="button"
                onClick={() => {
                  setPlusOpen((o) => {
                    if (!o && plusRef.current) {
                      // 打开时计算 Plus 按钮位置(fixed 定位用)
                      const r = plusRef.current.getBoundingClientRect()
                      setPlusRect({ top: r.bottom + 4, left: r.left })
                    }
                    return !o
                  })
                }}
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

            {plusOpen &&
              plusRect &&
              createPortal(
                <div
                  role="menu"
                  aria-label={plusLabel}
                  data-testid="global-topbar-plus-menu"
                  style={{
                    position: 'fixed',
                    top: plusRect.top,
                    left: plusRect.left,
                    zIndex: 50,
                  }}
                  className={cn(
                    'rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md',
                    // 移动端:弹窗宽度约束为视口宽度减去边距,最大 288px
                    isMobile ? 'w-[calc(100vw-2rem)] max-w-72' : 'w-72',
                  )}
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
                  {flatItems.length === 0 ? (
                    <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                      {t('viewSwitcher.noMatch')}
                    </div>
                  ) : (
                    // 2026-07-30 九宫格改造(用户规则:"把这个下拉窗里的一行行按钮编程九宫格的样式 9个正方形")
                    // 9 项菜单 3×3 网格排列,每个格子 aspect-square 正方形(图标在上 + 文字在下)
                    // 空间利用:垂直列表 376px 高 → 九宫格 288px 高,节省 23%;宽度 256→288(+12px 容纳 3 列)
                    // 分组标题去掉(九宫格本身就是视觉组织,分组标题在 9 项场景下增加阅读噪音)
                    <div className="grid grid-cols-3 gap-1 p-1">
                      {flatItems.map((item, idx) => {
                        const Icon = item.icon
                        const isActive = idx === activeIndex
                        return (
                          <button
                            key={item.key}
                            type="button"
                            role="menuitem"
                            aria-current={isActive ? 'true' : undefined}
                            onClick={() => handleAction(item)}
                            // 鼠标 hover 时同步 activeIndex(键盘 ↑↓←→ 跟鼠标 hover 联动)
                            onMouseEnter={() => setActiveIndex(idx)}
                            className={cn(
                              'relative flex aspect-square flex-col items-center justify-center gap-1 rounded-md p-2 text-center transition-colors focus:outline-none',
                              isActive
                                ? 'bg-accent text-foreground'
                                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground focus:bg-muted/50 focus:text-foreground',
                            )}
                          >
                            <Icon className="h-4 w-4 shrink-0" />
                            <span className="text-[10px] leading-tight">
                              {t(`topBar.${item.key}`)}
                            </span>
                            {/* 快捷键角标(仅"设置"项):右上角小标,不占格子主空间 */}
                            {item.shortcut && (
                              <span className="absolute right-1 top-1 text-[9px] opacity-40">
                                {item.shortcut}
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
                  {/* 底部快捷键提示(2026-07-30 用户规则:"做好快捷键写上也行啊")
                  无 border-t(§4 禁止分割线),用 mt-1 间距 + 低对比度文字视觉分隔
                  2026-07-30 升级:加入 Ctrl+Shift+P 全局打开提示,让用户知道命令面板入口
                  (VS Code 用户最熟悉的快捷键,接入 useGlobalShortcuts 后被 Ctrl+/ 帮助面板自动收录) */}
                  <div className="mt-1 flex items-center gap-3 px-3 py-1.5 text-[10px] text-muted-foreground/70">
                    <span>↑↓←→ 导航</span>
                    <span>↵ 确认</span>
                    <span>Esc 关闭</span>
                    <span className="ml-auto">{plusShortcut} 打开</span>
                  </div>
                </div>,
                document.body,
              )}
          </div>

          {/* 3. chevron 关闭其他/全部 按钮(从 TagsView 抽出,2026-07-31 第十二轮挪到 Plus 后面) */}
          <React.Suspense fallback={null}>
            <TagsViewChevronButton />
          </React.Suspense>

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
                  isMaximized ? <RestoreIcon className="h-3 w-3" /> : <Square className="h-3 w-3" />
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
        variant === 'close' ? 'hover:bg-red-500/15 hover:text-red-600 dark:hover:text-red-400' : '',
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
